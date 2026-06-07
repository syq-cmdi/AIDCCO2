"""Cross-layer energy-efficiency engine for the AIDC carbon platform.

This module implements the system-level efficiency levers from data-center
energy-efficiency research as deterministic, auditable estimators:

1. Virtualization and QoS-aware workload co-location (improved Xen-style
   proportional-share + boost scheduler that runs SLA-sensitive services and
   deferrable batch jobs on the same nodes).
2. Active thermal management that predicts chip hotspots and co-schedules
   workload placement with fan/cooling setpoints.
3. Distributed server-level LiFePO4 UPS peak shaving that lets more servers
   fit inside the same grid power budget than a central UPS.
4. Green-aware global energy routing across geo-distributed sites using green
   forecasts and wide-area migration.
5. A high-speed optical migration fabric (40G/100G+/DWDM) for efficient data
   movement and congestion relief.

Efficiency estimates are operational guidance only. They never reduce the
audited physical Scope 1/2/3 inventory, SCI, or server-layer carbon metrics.
"""

from __future__ import annotations

from datetime import UTC, datetime
from statistics import median

from .calculations import CalculationError
from .models import (
    ColocationServerPlan,
    CoolingEquipmentTwin,
    DistributedBatteryResponse,
    FanZoneSetpoint,
    GlobalEnergyRoutingResponse,
    HotspotPrediction,
    MigrationJob,
    MigrationPlan,
    OpticalFabricResponse,
    OpticalLink,
    OpticalLinkLoad,
    PeakWindow,
    RegionEnergyState,
    RegionRoutingPlan,
    ServerTwin,
    ThermalManagementResponse,
    WorkloadClass,
    WorkloadSchedulingResponse,
)

METHOD_WORKLOAD = "xen-colocation-qos-scheduler-v0.1"
METHOD_THERMAL = "active-thermal-coscheduling-v0.1"
METHOD_BATTERY = "distributed-lfp-ups-peak-shaving-v0.1"
METHOD_GLOBAL = "green-aware-wan-routing-v0.1"
METHOD_OPTICAL = "optical-dc-fabric-v0.1"
METHOD_SUMMARY = "cross-layer-efficiency-v0.1"

# Server energy proportionality gap: an idle server still draws a large share
# of its rated power, which is exactly what co-location and parking exploit.
IDLE_POWER_FRACTION = 0.52
PARKED_POWER_FRACTION = 0.06
DEFAULT_SLA_UTIL_CAP = 0.85
DEFAULT_SLA_TARGET_QOS = 0.98

# Research reference headlines (cited targets, not the engine's own estimate).
REFERENCE_WORKLOAD_GAIN_PCT = 0.70
REFERENCE_BATTERY_EXTRA_PCT = 0.24
REFERENCE_INTERRUPTION_X = 5.0

# Illustrative interconnect energy intensity (optical links move bits far more
# efficiently than electrical switching/transit per transported byte).
ENERGY_PER_GB_OPTICAL_J = 0.016
ENERGY_PER_GB_ELECTRICAL_J = 0.12


def _server_power_kw(rated_kw: float, utilization: float) -> float:
    util = max(0.0, min(utilization, 1.0))
    return rated_kw * (IDLE_POWER_FRACTION + (1 - IDLE_POWER_FRACTION) * util)


def _consolidation_gain(utilization: float) -> float:
    """Work-per-watt gain from serving batch work in an existing node's idle
    headroom (only the dynamic power is added) instead of on a standalone
    server that must also pay its idle baseline."""
    util = max(0.0, min(utilization, 1.0))
    return IDLE_POWER_FRACTION / (IDLE_POWER_FRACTION + (1 - IDLE_POWER_FRACTION) * util)


# --------------------------------------------------------------------------
# 1. Virtualization and QoS-aware workload scheduling
# --------------------------------------------------------------------------


def calculate_workload_scheduling(
    servers: list[ServerTwin],
    site_id: str = "aidc-sg-01",
    sla_util_cap: float = DEFAULT_SLA_UTIL_CAP,
    sla_target_qos: float = DEFAULT_SLA_TARGET_QOS,
    allow_colocation: bool = True,
) -> WorkloadSchedulingResponse:
    if not servers:
        raise CalculationError("workload scheduling requires at least one server")

    sla_servers = [s for s in servers if s.workload_pool == "inference"]
    batch_servers = [s for s in servers if s.workload_pool != "inference"]

    baseline_power = sum(_server_power_kw(s.rated_power_kw, s.utilization) for s in servers)

    # Batch work to place, expressed as kW of compute demand. It must run
    # somewhere; co-location only changes whether SLA nodes absorb part of it.
    batch_demand_kw = sum(s.utilization * s.rated_power_kw for s in batch_servers)
    remaining_batch = batch_demand_kw

    server_plans: list[ColocationServerPlan] = []
    qos_values: list[float] = []
    sla_violations = 0

    # Pack batch work into SLA servers' headroom under an improved Xen-style
    # proportional-share + boost scheduler that keeps latency-critical VMs
    # prioritized so their measured QoS ratio stays at target.
    for server in sla_servers:
        headroom_kw = max(sla_util_cap - server.utilization, 0.0) * server.rated_power_kw if allow_colocation else 0.0
        absorbed = min(headroom_kw, remaining_batch)
        remaining_batch -= absorbed
        new_util = server.utilization + (absorbed / server.rated_power_kw if server.rated_power_kw else 0.0)
        # QoS ratio (achieved/target) degrades only if packing pushes a node
        # past the safe latency ceiling; the boost scheduler holds it at 1.0
        # while combined utilization stays at or below the cap.
        qos = round(min(1.0, 1.0 - max(new_util - sla_util_cap, 0.0) * 1.5), 4)
        respected = qos >= sla_target_qos
        if not respected:
            sla_violations += 1
        qos_values.append(qos)
        server_plans.append(
            ColocationServerPlan(
                server_id=server.id,
                foreground_class=WorkloadClass.SLA_SENSITIVE,
                background_class=WorkloadClass.BATCH if absorbed > 0 else None,
                baseline_utilization=round(server.utilization, 4),
                colocated_utilization=round(new_util, 4),
                absorbed_batch_kw=round(absorbed, 4),
                qos_ratio=qos,
                sla_respected=respected,
                scheduler_mode="credit-boost-sla-priority" if absorbed > 0 else "credit-default",
                baseline_power_kw=round(_server_power_kw(server.rated_power_kw, server.utilization), 4),
                colocated_power_kw=round(_server_power_kw(server.rated_power_kw, new_util), 4),
                state="host",
            )
        )

    # Keep enough batch servers powered to serve any residual batch demand and
    # suspend (park) the rest. Busy nodes are retained first.
    servers_parked = 0
    optimized_batch_power = 0.0
    for server in sorted(batch_servers, key=lambda s: s.utilization, reverse=True):
        if remaining_batch > 1e-9:
            run_kw = min(server.utilization * server.rated_power_kw, remaining_batch)
            remaining_batch -= run_kw
            run_util = run_kw / server.rated_power_kw if server.rated_power_kw else 0.0
            power = _server_power_kw(server.rated_power_kw, run_util)
            state = "host"
            scheduler_mode = "credit-default"
        else:
            run_util = 0.0
            power = server.rated_power_kw * PARKED_POWER_FRACTION
            state = "parked"
            scheduler_mode = "suspend-to-park"
            servers_parked += 1
        optimized_batch_power += power
        server_plans.append(
            ColocationServerPlan(
                server_id=server.id,
                foreground_class=WorkloadClass.BATCH,
                background_class=None,
                baseline_utilization=round(server.utilization, 4),
                colocated_utilization=round(run_util, 4),
                absorbed_batch_kw=0.0,
                qos_ratio=1.0,
                sla_respected=True,
                scheduler_mode=scheduler_mode,
                baseline_power_kw=round(_server_power_kw(server.rated_power_kw, server.utilization), 4),
                colocated_power_kw=round(power, 4),
                state=state,
            )
        )

    optimized_sla_power = sum(
        plan.colocated_power_kw for plan in server_plans if plan.foreground_class == WorkloadClass.SLA_SENSITIVE
    )
    optimized_power = optimized_sla_power + optimized_batch_power
    energy_saving_pct = round((baseline_power - optimized_power) / baseline_power, 4) if baseline_power > 0 else 0.0
    peak_gain = max((_consolidation_gain(s.utilization) for s in batch_servers), default=0.0)

    fleet_qos = round(sum(qos_values) / len(qos_values), 4) if qos_values else 1.0
    min_qos = round(min(qos_values), 4) if qos_values else 1.0

    return WorkloadSchedulingResponse(
        site_id=site_id,
        generated_at=datetime.now(UTC),
        scheduler="Improved Xen credit scheduler with SLA boost + batch co-location",
        method_version=METHOD_WORKLOAD,
        reference_efficiency_gain_pct=REFERENCE_WORKLOAD_GAIN_PCT,
        servers_total=len(servers),
        sla_servers=len(sla_servers),
        batch_servers=len(batch_servers),
        servers_parked=servers_parked,
        fleet_qos_ratio=fleet_qos,
        min_qos_ratio=min_qos,
        sla_target_qos=sla_target_qos,
        sla_violations=sla_violations,
        baseline_power_kw=round(baseline_power, 4),
        optimized_power_kw=round(optimized_power, 4),
        energy_saving_pct=energy_saving_pct,
        peak_node_efficiency_gain_pct=round(peak_gain, 4),
        server_plans=server_plans,
        safety_constraints=[
            "SLA-sensitive VMs keep scheduler boost priority; batch is preemptible.",
            "Combined node utilization stays at or below the QoS-safe cap.",
            "Parked nodes retain failover wake capacity; N+1 power/cooling preserved.",
            "QoS ratio is monitored in real time; batch is throttled on any SLA dip.",
        ],
        notes=[
            "Co-location exploits the server energy-proportionality gap: idle nodes still draw a large share of rated power.",
            "Net fleet saving is the operational estimate; per-node work-per-watt gain can reach the cited reference under low-utilization consolidation.",
        ],
    )


# --------------------------------------------------------------------------
# 2. Active thermal management and cooling co-scheduling
# --------------------------------------------------------------------------


def calculate_thermal_management(
    chips: list,
    cooling_equipment: list[CoolingEquipmentTwin],
    site_id: str = "aidc-sg-01",
    sla_temp_c: float = 75.0,
    horizon_minutes: int = 15,
    max_predictions: int = 24,
) -> ThermalManagementResponse:
    if not chips:
        raise CalculationError("thermal management requires chip telemetry")

    horizon_factor = horizon_minutes / 15
    predictions: list[HotspotPrediction] = []
    migrations: list[str] = []
    hotspots_flagged = 0

    for chip in chips:
        # Proactive prediction: hotspot drifts upward with sustained utilization
        # over the control horizon. This anticipates throttling before it happens.
        predicted = chip.hotspot_temp_c + chip.utilization * 8.0 * horizon_factor
        headroom = sla_temp_c - predicted
        if predicted >= sla_temp_c:
            risk = "throttle_risk"
            action = "Pre-stage fan ramp and migrate hot workload to a cooler node"
            hotspots_flagged += 1
            migrations.append(f"migrate workload off {chip.id} (predicted {round(predicted, 1)}C)")
        elif predicted >= sla_temp_c - 4:
            risk = "watch"
            action = "Raise local fan setpoint early; hold workload"
        else:
            risk = "nominal"
            action = "Hold current setpoint"
        predictions.append(
            HotspotPrediction(
                chip_id=chip.id,
                server_id=chip.server_id,
                chip_type=chip.chip_type,
                current_hotspot_c=round(chip.hotspot_temp_c, 2),
                predicted_hotspot_c=round(predicted, 2),
                headroom_c=round(headroom, 2),
                risk=risk,  # type: ignore[arg-type]
                recommended_action=action,
            )
        )

    current_max = max(chip.hotspot_temp_c for chip in chips)
    predicted_max = max(prediction.predicted_hotspot_c for prediction in predictions)

    # Fan/cooling co-scheduling. Reactive control chases the worst hotspot and
    # over-spins; proactive control trims overspeed and flattens the thermal
    # field by load placement. Fan power follows the affinity (cube) law.
    fan_equipment = [
        equipment
        for equipment in cooling_equipment
        if equipment.equipment_type in {"crah", "cooling_tower", "cdu", "plate_heat_exchanger"}
    ]
    fan_zones: list[FanZoneSetpoint] = []
    baseline_cooling = 0.0
    optimized_cooling = 0.0
    for equipment in fan_equipment:
        baseline_speed = min(1.0, max(0.4, (current_max - 60) / 25))
        optimized_speed = max(0.3, baseline_speed * 0.86)
        base_kw = equipment.current_kw
        opt_kw = base_kw * (optimized_speed / baseline_speed) ** 3 if baseline_speed > 0 else base_kw
        baseline_cooling += base_kw
        optimized_cooling += opt_kw
        fan_zones.append(
            FanZoneSetpoint(
                zone_id=equipment.id,
                equipment_type=equipment.equipment_type,
                baseline_speed_pct=round(baseline_speed * 100, 2),
                optimized_speed_pct=round(optimized_speed * 100, 2),
                baseline_power_kw=round(base_kw, 4),
                optimized_power_kw=round(opt_kw, 4),
                bound_by="predicted_hotspot" if predicted_max >= sla_temp_c else "setpoint",
            )
        )

    cooling_saving_pct = (
        round((baseline_cooling - optimized_cooling) / baseline_cooling, 4) if baseline_cooling > 0 else 0.0
    )

    predictions.sort(key=lambda prediction: prediction.predicted_hotspot_c, reverse=True)

    return ThermalManagementResponse(
        site_id=site_id,
        generated_at=datetime.now(UTC),
        method_version=METHOD_THERMAL,
        horizon_minutes=horizon_minutes,
        sla_temp_c=sla_temp_c,
        chips_evaluated=len(chips),
        hotspots_flagged=hotspots_flagged,
        current_max_hotspot_c=round(current_max, 2),
        predicted_max_hotspot_c=round(predicted_max, 2),
        baseline_cooling_kw=round(baseline_cooling, 4),
        optimized_cooling_kw=round(optimized_cooling, 4),
        cooling_saving_pct=cooling_saving_pct,
        workload_migrations=migrations[:max_predictions],
        hotspot_predictions=predictions[:max_predictions],
        fan_zones=fan_zones,
        safety_constraints=[
            "Junction/hotspot stays below the chip SLA temperature limit.",
            "Fan reductions keep N+1 cooling redundancy and avoid chiller short-cycling.",
            "Workload migration respects SLA placement and data-residency rules.",
        ],
    )


# --------------------------------------------------------------------------
# 3. Distributed server-level battery peak shaving
# --------------------------------------------------------------------------


def calculate_distributed_battery(
    hourly_power_kw: list[float],
    power_budget_kw: float,
    battery_energy_kwh: float,
    max_discharge_kw: float,
    per_server_kw: float,
    site_id: str = "aidc-sg-01",
    centralized_ridethrough_minutes: float = 8.0,
    chemistry: str = "LiFePO4 (LFP)",
) -> DistributedBatteryResponse:
    if not hourly_power_kw:
        raise CalculationError("battery analysis requires a power profile")
    if power_budget_kw <= 0:
        raise CalculationError("power budget must be greater than zero")
    if per_server_kw <= 0:
        raise CalculationError("per-server power must be greater than zero")

    observed_peak = max(hourly_power_kw)

    # Identify contiguous windows where load exceeds the grid power budget.
    peak_windows: list[PeakWindow] = []
    longest = 0
    index = 0
    count = len(hourly_power_kw)
    while index < count:
        if hourly_power_kw[index] > power_budget_kw:
            end = index
            energy = 0.0
            window_peak = 0.0
            while end < count and hourly_power_kw[end] > power_budget_kw:
                deficit = hourly_power_kw[end] - power_budget_kw
                energy += deficit  # 1-hour buckets
                window_peak = max(window_peak, hourly_power_kw[end])
                end += 1
            duration = end - index
            longest = max(longest, duration)
            covered = (window_peak - power_budget_kw) <= max_discharge_kw and energy <= battery_energy_kwh
            peak_windows.append(
                PeakWindow(
                    start_index=index,
                    duration_hours=duration,
                    peak_kw=round(window_peak, 3),
                    energy_above_budget_kwh=round(energy, 3),
                    covered_by_battery=covered,
                )
            )
            index = end
        else:
            index += 1

    # Sustainable shaving = power the distributed pack can hold for the longest
    # peak, bounded by both inverter power and stored energy. Distributed LFP
    # rides hours-long peaks; a central UPS only carries a short ride-through.
    longest_for_energy = max(longest, 1)
    sustainable_shave = min(max_discharge_kw, battery_energy_kwh / longest_for_energy)
    shaved_peak = (
        power_budget_kw
        if peak_windows and all(window.covered_by_battery for window in peak_windows)
        else observed_peak
    )

    centralized_energy_kwh = max_discharge_kw * (centralized_ridethrough_minutes / 60)
    centralized_sustainable = min(max_discharge_kw, centralized_energy_kwh / longest_for_energy)

    extra_servers_distributed = int(sustainable_shave // per_server_kw)
    extra_servers_centralized = int(centralized_sustainable // per_server_kw)
    extra_capacity_pct = round(sustainable_shave / power_budget_kw, 4)

    return DistributedBatteryResponse(
        site_id=site_id,
        generated_at=datetime.now(UTC),
        method_version=METHOD_BATTERY,
        chemistry=chemistry,
        reference_extra_capacity_pct=REFERENCE_BATTERY_EXTRA_PCT,
        power_budget_kw=round(power_budget_kw, 3),
        observed_peak_kw=round(observed_peak, 3),
        shaved_peak_kw=round(shaved_peak, 3),
        sustainable_shave_kw=round(sustainable_shave, 3),
        battery_energy_kwh=round(battery_energy_kwh, 3),
        max_discharge_kw=round(max_discharge_kw, 3),
        longest_peak_hours=longest,
        per_server_kw=round(per_server_kw, 3),
        extra_servers_distributed=extra_servers_distributed,
        extra_servers_centralized=extra_servers_centralized,
        extra_capacity_pct=extra_capacity_pct,
        centralized_ridethrough_minutes=centralized_ridethrough_minutes,
        peak_windows=peak_windows,
        notes=[
            "Distributed server-level LFP UPS shaves multi-hour power peaks the central UPS cannot ride through.",
            "Freed power headroom is reinvested as additional server deployment inside the same grid budget.",
            "Sized for peak shaving and backup ride-through; not a grid-export or merchant storage asset.",
        ],
    )


# --------------------------------------------------------------------------
# 4. Green-aware global energy routing
# --------------------------------------------------------------------------


def calculate_global_energy_routing(
    regions: list[RegionEnergyState],
    interruption_block_mw: float = 0.5,
) -> GlobalEnergyRoutingResponse:
    if not regions:
        raise CalculationError("global routing requires at least one region")

    total_load = sum(region.load_mw for region in regions)
    total_green = sum(region.green_forecast_mw for region in regions)
    if total_load <= 0:
        raise CalculationError("total load must be greater than zero")

    green_before = sum(min(region.load_mw, region.green_forecast_mw) for region in regions)
    coverage_before = green_before / total_load

    # Green surplus and deferrable deficit, used for forecast-aware migration.
    surplus_by_region = {
        region.site_id: max(region.green_forecast_mw - region.load_mw, 0.0) for region in regions
    }
    total_surplus = sum(surplus_by_region.values())
    movable_by_region = {
        region.site_id: (region.load_mw * region.deferrable_fraction if region.green_forecast_mw < region.load_mw else 0.0)
        for region in regions
    }
    movable = sum(movable_by_region.values())
    migrated = min(movable, total_surplus)

    # Distribute migrated load out of the deficit regions (largest first) and
    # into the surplus regions (largest first), proportionally.
    out_share = {site: 0.0 for site in (region.site_id for region in regions)}
    in_share = {site: 0.0 for site in (region.site_id for region in regions)}
    if migrated > 0 and movable > 0 and total_surplus > 0:
        for region in regions:
            if movable_by_region[region.site_id] > 0:
                out_share[region.site_id] = migrated * (movable_by_region[region.site_id] / movable)
        for region in regions:
            if surplus_by_region[region.site_id] > 0:
                in_share[region.site_id] = migrated * (surplus_by_region[region.site_id] / total_surplus)

    region_plans: list[RegionRoutingPlan] = []
    for region in regions:
        load_after = region.load_mw - out_share[region.site_id] + in_share[region.site_id]
        coverage_b = min(region.green_forecast_mw, region.load_mw) / region.load_mw if region.load_mw > 0 else 1.0
        coverage_a = min(region.green_forecast_mw, load_after) / load_after if load_after > 0 else 1.0
        region_plans.append(
            RegionRoutingPlan(
                site_id=region.site_id,
                region=region.region,
                load_before_mw=round(region.load_mw, 4),
                load_after_mw=round(load_after, 4),
                migrated_in_mw=round(in_share[region.site_id], 4),
                migrated_out_mw=round(out_share[region.site_id], 4),
                green_coverage_before=round(coverage_b, 4),
                green_coverage_after=round(coverage_a, 4),
                grid_ci_kg_per_kwh=region.grid_ci_kg_per_kwh,
            )
        )

    coverage_after = min(1.0, (green_before + migrated) / total_load)

    # Baseline interruptions ~ deferrable work stranded on a browning grid.
    # Forecast-aware routing pre-migrates most of it, cutting interruptions.
    interruptions_before = max(1, round(movable / interruption_block_mw))
    interruptions_after = max(1, round((movable - migrated) / interruption_block_mw))
    interruption_reduction_x = round(interruptions_before / interruptions_after, 2)

    return GlobalEnergyRoutingResponse(
        generated_at=datetime.now(UTC),
        method_version=METHOD_GLOBAL,
        reference_interruption_reduction_x=REFERENCE_INTERRUPTION_X,
        total_load_mw=round(total_load, 4),
        total_green_mw=round(total_green, 4),
        green_coverage_before=round(coverage_before, 4),
        green_coverage_after=round(coverage_after, 4),
        migrated_load_mw=round(migrated, 4),
        job_interruptions_before=interruptions_before,
        job_interruptions_after=interruptions_after,
        interruption_reduction_x=interruption_reduction_x,
        avoided_brown_mwh_per_hour=round(migrated, 4),
        region_plans=region_plans,
        safety_constraints=[
            "Migration respects data-residency, sovereignty, and latency-class limits.",
            "Only deferrable workloads move; SLA-sensitive services stay pinned.",
            "Green forecasts carry uncertainty; routing keeps a brown-power fallback.",
            "Avoided brown energy is a separate disclosure, not an inventory deduction.",
        ],
    )


# --------------------------------------------------------------------------
# 5. High-speed optical migration fabric
# --------------------------------------------------------------------------


def _select_link(job: MigrationJob, links: list[OpticalLink]) -> OpticalLink:
    same_site = job.source.split("-")[0] == job.target.split("-")[0]
    scope = "intra_dc" if same_site else "inter_region"
    exact = [
        link
        for link in links
        if {link.endpoint_a, link.endpoint_b} == {job.source, job.target}
    ]
    if exact:
        return max(exact, key=lambda link: link.capacity_gbps)
    scoped = [link for link in links if link.scope == scope]
    if scoped:
        return max(scoped, key=lambda link: link.capacity_gbps)
    return max(links, key=lambda link: link.capacity_gbps)


def calculate_optical_fabric(
    links: list[OpticalLink],
    jobs: list[MigrationJob],
    site_id: str = "aidc-sg-01",
    legacy_link_gbps: float = 10.0,
) -> OpticalFabricResponse:
    if not links:
        raise CalculationError("optical fabric requires at least one link")
    if not jobs:
        raise CalculationError("optical fabric requires at least one migration job")

    offered: dict[str, float] = {link.link_id: 0.0 for link in links}
    migration_plans: list[MigrationPlan] = []
    jobs_meeting_deadline = 0
    speedups: list[float] = []

    for job in jobs:
        link = _select_link(job, links)
        throughput = link.capacity_gbps
        transfer_s = (job.data_gb * 8) / throughput
        legacy_s = (job.data_gb * 8) / legacy_link_gbps
        speedup = round(legacy_s / transfer_s, 3) if transfer_s > 0 else 0.0
        meets = transfer_s <= job.deadline_s
        if meets:
            jobs_meeting_deadline += 1
        speedups.append(speedup)
        # Sustained rate the job needs to hold over its deadline contributes to
        # the link's offered load (concurrent demand).
        offered[link.link_id] += (job.data_gb * 8) / job.deadline_s
        migration_plans.append(
            MigrationPlan(
                job_id=job.job_id,
                link_id=link.link_id,
                data_gb=job.data_gb,
                throughput_gbps=round(throughput, 3),
                transfer_seconds=round(transfer_s, 3),
                meets_deadline=meets,
                legacy_transfer_seconds=round(legacy_s, 3),
                speedup_x=speedup,
            )
        )

    link_loads: list[OpticalLinkLoad] = []
    congested_links = 0
    for link in links:
        utilization = offered[link.link_id] / link.capacity_gbps if link.capacity_gbps > 0 else 0.0
        congested = utilization > 0.9
        if congested:
            congested_links += 1
        link_loads.append(
            OpticalLinkLoad(
                link_id=link.link_id,
                scope=link.scope,
                capacity_gbps=round(link.capacity_gbps, 3),
                offered_gbps=round(offered[link.link_id], 3),
                utilization=round(utilization, 4),
                congested=congested,
            )
        )

    aggregate_capacity = sum(link.capacity_gbps for link in links)
    aggregate_offered = sum(offered.values())

    return OpticalFabricResponse(
        site_id=site_id,
        generated_at=datetime.now(UTC),
        method_version=METHOD_OPTICAL,
        legacy_link_gbps=legacy_link_gbps,
        aggregate_capacity_gbps=round(aggregate_capacity, 3),
        aggregate_offered_gbps=round(aggregate_offered, 3),
        fabric_utilization=round(aggregate_offered / aggregate_capacity, 4) if aggregate_capacity > 0 else 0.0,
        congested_links=congested_links,
        jobs_meeting_deadline=jobs_meeting_deadline,
        jobs_total=len(jobs),
        median_speedup_x=round(median(speedups), 3) if speedups else 0.0,
        energy_per_gb_optical_j=ENERGY_PER_GB_OPTICAL_J,
        energy_per_gb_electrical_j=ENERGY_PER_GB_ELECTRICAL_J,
        link_loads=link_loads,
        migration_plans=migration_plans,
        notes=[
            "High-speed optical links (40G/100G+/DWDM) shrink intra-DC and cross-region migration time.",
            "Wavelength capacity relieves congestion so SLA-sensitive transfers meet deadlines under load.",
            "Optical transport energy-per-byte is far below electrical switching; values shown are illustrative.",
        ],
    )
