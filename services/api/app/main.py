from __future__ import annotations

import hashlib
import json
from collections import Counter
from datetime import UTC, datetime

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .calculations import (
    CalculationError,
    allocate_embodied_component,
    calculate_cfe_matching,
    calculate_quota_status,
    calculate_realtime_metrics,
    calculate_twin_carbon_audit,
    generate_recommendations,
)
from .efficiency import (
    METHOD_SUMMARY,
    REFERENCE_BATTERY_EXTRA_PCT,
    REFERENCE_INTERRUPTION_X,
    REFERENCE_WORKLOAD_GAIN_PCT,
    calculate_distributed_battery,
    calculate_global_energy_routing,
    calculate_optical_fabric,
    calculate_thermal_management,
    calculate_workload_scheduling,
)
from .models import (
    ApiMessage,
    CarbonAuditLine,
    ChipSimulationResponse,
    DataQualityFlag,
    DigitalTwinResponse,
    DistributedBatteryResponse,
    EfficiencyLever,
    EfficiencyLeverSummary,
    EfficiencySummaryResponse,
    EmissionRecord,
    EvidencePackage,
    GlobalEnergyRoutingResponse,
    InventoryResponse,
    MatchingResponse,
    OmniverseFidelityPolicyResponse,
    MeterReading,
    MeterStream,
    OpticalFabricResponse,
    OptimizerRequest,
    QuotaStatusResponse,
    RealtimeMetricsResponse,
    RenewableMatchingRequest,
    ScopeName,
    TelemetryIngestRequest,
    ThermalManagementResponse,
    WorkloadSchedulingResponse,
)
from .sample_data import (
    BATTERY_CENTRALIZED_RIDETHROUGH_MIN,
    BATTERY_ENERGY_KWH,
    BATTERY_MAX_DISCHARGE_KW,
    BATTERY_PER_SERVER_KW,
    BATTERY_POWER_BUDGET_KW,
    SITE,
    seed_battery_power_profile,
    seed_certificates,
    seed_campus_twin,
    seed_digital_twin_sources,
    seed_electrical_metering_system,
    seed_envelope_components,
    seed_global_energy_regions,
    seed_grid_intensity,
    seed_hourly_energy,
    seed_lca_components,
    seed_meter_readings,
    seed_migration_jobs,
    seed_omniverse_fidelity_policy,
    seed_optical_links,
    seed_primary_cooling_system,
    seed_quota_policy,
)

app = FastAPI(
    title="AIDC Carbon Monitor API",
    version="0.1.0",
    description="Near-real-time dMRV, lifecycle inventory, quota monitoring, 24/7 CFE matching, and AI decarbonization method engine.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

READINGS: list[MeterReading] = seed_meter_readings()
GRID_INTENSITY = seed_grid_intensity()
HOURLY_ENERGY = seed_hourly_energy()
LCA_COMPONENTS = seed_lca_components()
QUOTA_POLICY = seed_quota_policy()
CERTIFICATES = seed_certificates()
DIGITAL_TWIN_SOURCES = seed_digital_twin_sources()
CAMPUS_TWIN = seed_campus_twin()
ENVELOPE_COMPONENTS = seed_envelope_components()
PRIMARY_COOLING_SYSTEM = seed_primary_cooling_system()
ELECTRICAL_METERING_SYSTEM = seed_electrical_metering_system()
OMNIVERSE_FIDELITY_POLICY = seed_omniverse_fidelity_policy()
BATTERY_POWER_PROFILE = seed_battery_power_profile()
GLOBAL_ENERGY_REGIONS = seed_global_energy_regions()
OPTICAL_LINKS = seed_optical_links()
MIGRATION_JOBS = seed_migration_jobs()

BASE_USED_KG_CO2E = 1_480_000.0
OFFSETS_RETIRED_KG = 0.0


def _readings_for_site(site_id: str) -> list[MeterReading]:
    readings = [reading for reading in READINGS if reading.site_id == site_id]
    if not readings:
        raise HTTPException(status_code=404, detail=f"No readings found for site {site_id}")
    return readings


def _average_grid_factor() -> float:
    return sum(item.average_kg_co2e_per_kwh for item in GRID_INTENSITY) / len(GRID_INTENSITY)


def _market_factor() -> float:
    hourly_load = sum(hour.load_kwh for hour in HOURLY_ENERGY)
    matched = calculate_cfe_matching(HOURLY_ENERGY)["cfe_score"]
    average_factor = _average_grid_factor()
    return average_factor * max(1 - float(matched), 0)


def _current_metrics(site_id: str) -> dict:
    return calculate_realtime_metrics(_readings_for_site(site_id), _average_grid_factor(), _market_factor())


def _twin_rooms(site_id: str):
    if site_id != CAMPUS_TWIN.site_id:
        raise HTTPException(status_code=404, detail=f"No digital twin found for site {site_id}")
    return [room for building in CAMPUS_TWIN.buildings for room in building.rooms]


def _twin_audit_lines(site_id: str) -> list[CarbonAuditLine]:
    metrics = _current_metrics(site_id)
    pue = metrics["pue"].value
    location_factor = _average_grid_factor()
    market_factor = _market_factor()
    rooms = _twin_rooms(site_id)
    server_room_rack_lines = calculate_twin_carbon_audit(
        rooms,
        interval_hours=1,
        location_grid_kg_per_kwh=location_factor,
        market_grid_kg_per_kwh=market_factor,
    )
    building_lines: list[CarbonAuditLine] = []
    for building in CAMPUS_TWIN.buildings:
        building_room_ids = {room.id for room in building.rooms}
        room_children = [
            line
            for line in server_room_rack_lines
            if line.node_level == "room" and line.node_id in building_room_ids
        ]
        building_lines.append(
            CarbonAuditLine(
                node_level="building",
                node_id=building.id,
                parent_id=building.site_id,
                allocation_path=["sum", "building", building.id],
                energy_kwh=round(sum(line.energy_kwh for line in room_children), 6),
                cooling_overhead_kwh=round(sum(line.cooling_overhead_kwh for line in room_children), 6),
                scope2_location_kg=round(sum(line.scope2_location_kg for line in room_children), 6),
                scope2_market_kg=round(sum(line.scope2_market_kg for line in room_children), 6),
                embodied_kg=round(sum(line.embodied_kg for line in room_children), 6),
                total_location_kg=round(sum(line.total_location_kg for line in room_children), 6),
                total_market_kg=round(sum(line.total_market_kg for line in room_children), 6),
                method_version="rack-server-twin-carbon-audit-v0.1",
                data_quality_flag=DataQualityFlag.ESTIMATED,
                evidence_refs=[f"bim://geometry/{building.geometry_ref}"],
            )
        )
    campus_children = building_lines
    campus_line = CarbonAuditLine(
        node_level="campus",
        node_id=site_id,
        parent_id=None,
        allocation_path=["campus", "building", "room", "rack", "server"],
        energy_kwh=round(sum(line.energy_kwh for line in campus_children), 6),
        cooling_overhead_kwh=round(sum(line.energy_kwh for line in campus_children) * max(pue - 1, 0), 6),
        scope2_location_kg=round(sum(line.scope2_location_kg for line in campus_children), 6),
        scope2_market_kg=round(sum(line.scope2_market_kg for line in campus_children), 6),
        embodied_kg=round(sum(line.embodied_kg for line in campus_children), 6),
        total_location_kg=round(sum(line.total_location_kg for line in campus_children), 6),
        total_market_kg=round(sum(line.total_market_kg for line in campus_children), 6),
        method_version="rack-server-twin-carbon-audit-v0.1",
        data_quality_flag=DataQualityFlag.ESTIMATED,
        evidence_refs=["campus://aidc-sg-01", "model://rhino-speckle-ifc", "dcim://site/aidc-sg-01"],
    )
    return [campus_line, *building_lines, *server_room_rack_lines]


@app.get("/health", response_model=ApiMessage)
def health() -> ApiMessage:
    return ApiMessage(status="ok", detail="AIDC carbon method engine is running")


@app.post("/ingest/telemetry", response_model=ApiMessage)
def ingest_telemetry(payload: TelemetryIngestRequest) -> ApiMessage:
    mismatched = [reading.site_id for reading in payload.readings if reading.site_id != payload.site_id]
    if mismatched:
        raise HTTPException(status_code=400, detail="All readings must match payload.site_id")

    READINGS.extend(payload.readings)
    return ApiMessage(
        status="accepted",
        detail="Telemetry readings ingested",
        data={
            "site_id": payload.site_id,
            "accepted": len(payload.readings),
            "method_version": "nrt-dmrv-v0.1",
        },
    )


@app.get("/metrics/realtime", response_model=RealtimeMetricsResponse)
def metrics_realtime(
    site_id: str = Query(default=SITE.id),
    interval_minutes: int = Query(default=5, ge=1, le=60),
) -> RealtimeMetricsResponse:
    return RealtimeMetricsResponse(
        site_id=site_id,
        generated_at=datetime.now(UTC),
        interval_minutes=interval_minutes,
        metrics=_current_metrics(site_id),
    )


@app.get("/digital-twin/{site_id}", response_model=DigitalTwinResponse)
def digital_twin(site_id: str) -> DigitalTwinResponse:
    audit_lines = _twin_audit_lines(site_id)
    racks = [rack for room in _twin_rooms(site_id) for rack in room.racks]
    servers = [server for rack in racks for server in rack.servers]
    chip_count = sum(len(server.chips) for server in servers)
    campus_line = audit_lines[0]

    return DigitalTwinResponse(
        site_id=site_id,
        generated_at=datetime.now(UTC),
        refresh_seconds=1,
        model_sources=DIGITAL_TWIN_SOURCES,
        campus=CAMPUS_TWIN,
        envelope_components=ENVELOPE_COMPONENTS,
        primary_cooling_system=PRIMARY_COOLING_SYSTEM,
        electrical_metering_system=ELECTRICAL_METERING_SYSTEM,
        rack_count=len(racks),
        server_count=len(servers),
        chip_count=chip_count,
        aggregate_location_kg_per_hour=campus_line.total_location_kg,
        aggregate_market_kg_per_hour=campus_line.total_market_kg,
        server_layer_audit=audit_lines,
    )


@app.get("/digital-twin/{site_id}/chip-simulation", response_model=ChipSimulationResponse)
def chip_simulation(
    site_id: str,
    rack_id: str | None = Query(default=None),
    server_id: str | None = Query(default=None),
) -> ChipSimulationResponse:
    racks = [rack for room in _twin_rooms(site_id) for rack in room.racks]
    if not racks:
        raise HTTPException(status_code=404, detail=f"No racks found for site {site_id}")

    selected_rack = next((rack for rack in racks if rack.id == rack_id), racks[0] if rack_id is None else None)
    if selected_rack is None:
        raise HTTPException(status_code=404, detail=f"No rack found for id {rack_id}")

    selected_server = next(
        (server for server in selected_rack.servers if server.id == server_id),
        selected_rack.servers[0] if server_id is None and selected_rack.servers else None,
    )
    if selected_server is None:
        raise HTTPException(status_code=404, detail=f"No server found for id {server_id}")

    chips = selected_server.chips
    return ChipSimulationResponse(
        site_id=site_id,
        generated_at=datetime.now(UTC),
        rack_id=selected_rack.id,
        server_id=selected_server.id,
        solver_method="reduced-order liquid/air thermal network + NVML/Redfish telemetry binding v0.1",
        timestep_ms=1000,
        total_chip_power_kw=round(sum(chip.current_power_w for chip in chips) / 1000, 6),
        max_junction_temp_c=round(max((chip.junction_temp_c for chip in chips), default=0), 2),
        max_hotspot_temp_c=round(max((chip.hotspot_temp_c for chip in chips), default=0), 2),
        coolant_flow_lpm=round(sum(chip.coolant_flow_lpm for chip in chips), 3),
        chip_count=len(chips),
        chips=chips,
    )


@app.get("/carbon-audit/server-layer", response_model=list[CarbonAuditLine])
def carbon_audit_server_layer(site_id: str = Query(default=SITE.id), level: str = Query(default="server")) -> list[CarbonAuditLine]:
    allowed = {"campus", "building", "room", "rack", "server", "all"}
    if level not in allowed:
        raise HTTPException(status_code=400, detail=f"level must be one of {sorted(allowed)}")
    lines = _twin_audit_lines(site_id)
    if level == "all":
        return lines
    return [line for line in lines if line.node_level == level]


@app.get("/photorealism/omniverse-policy/{site_id}", response_model=OmniverseFidelityPolicyResponse)
def omniverse_fidelity_policy(site_id: str) -> OmniverseFidelityPolicyResponse:
    if site_id != OMNIVERSE_FIDELITY_POLICY.site_id:
        raise HTTPException(status_code=404, detail=f"No photorealism policy found for site {site_id}")
    return OMNIVERSE_FIDELITY_POLICY.model_copy(update={"generated_at": datetime.now(UTC)})


@app.get("/inventory", response_model=InventoryResponse)
def inventory(site_id: str = Query(default=SITE.id), period: str = Query(default="2026-06")) -> InventoryResponse:
    readings = _readings_for_site(site_id)
    metrics = calculate_realtime_metrics(readings, _average_grid_factor(), _market_factor())

    backup_fuel_liters = sum(reading.value for reading in readings if reading.stream == MeterStream.BACKUP_FUEL)
    refrigerant_kg = sum(reading.value for reading in readings if reading.stream == MeterStream.REFRIGERANT)
    scope1_kg = backup_fuel_liters * 2.68 + refrigerant_kg * 1430
    scope3_kg = sum(
        allocate_embodied_component(component, time_reserved_hours=720, resources_reserved=component.resource_total)
        for component in LCA_COMPONENTS
        if component.site_id == site_id
    )

    scope2_location = metrics["location_based_emissions_kg"].value
    scope2_market = metrics["market_based_emissions_kg"].value

    records = [
        EmissionRecord(
            scope=ScopeName.SCOPE_1,
            category="Backup fuel and refrigerants",
            kg_co2e=scope1_kg,
            method_version="ghgp-scope1-v0.1",
            data_quality_flag=DataQualityFlag.MEASURED,
            uncertainty_range=(scope1_kg * 0.92, scope1_kg * 1.08),
            evidence_refs=["fuel-ledger://site/aidc-sg-01", "bms://refrigerant-log"],
        ),
        EmissionRecord(
            scope=ScopeName.SCOPE_2_LOCATION,
            category="Purchased electricity, location-based",
            kg_co2e=scope2_location,
            method_version=metrics["location_based_emissions_kg"].method_version,
            data_quality_flag=metrics["location_based_emissions_kg"].data_quality_flag,
            uncertainty_range=metrics["location_based_emissions_kg"].uncertainty_range,
            evidence_refs=["meter://dcim.main_meter", "grid://electricity-maps-compatible-feed"],
        ),
        EmissionRecord(
            scope=ScopeName.SCOPE_2_MARKET,
            category="Purchased electricity, market-based",
            kg_co2e=scope2_market,
            method_version=metrics["market_based_emissions_kg"].method_version,
            data_quality_flag=metrics["market_based_emissions_kg"].data_quality_flag,
            uncertainty_range=metrics["market_based_emissions_kg"].uncertainty_range,
            evidence_refs=[f"certificate://{certificate.certificate_id}" for certificate in CERTIFICATES[:4]],
        ),
        EmissionRecord(
            scope=ScopeName.SCOPE_3,
            category="Embodied carbon amortization for AI compute infrastructure",
            kg_co2e=scope3_kg,
            method_version="iso-14067-lca-v0.1",
            data_quality_flag=DataQualityFlag.ESTIMATED,
            uncertainty_range=(scope3_kg * 0.75, scope3_kg * 1.35),
            evidence_refs=["lca://gpu-cluster-h100-a", "lca://network-spine-a"],
        ),
    ]

    return InventoryResponse(
        site_id=site_id,
        period=period,
        inventory_total_location_based_kg=scope1_kg + scope2_location + scope3_kg,
        inventory_total_market_based_kg=scope1_kg + scope2_market + scope3_kg,
        offsets_retired_kg=OFFSETS_RETIRED_KG,
        records=records,
    )


@app.get("/quota/status", response_model=QuotaStatusResponse)
def quota_status(site_id: str = Query(default=SITE.id)) -> QuotaStatusResponse:
    metrics = _current_metrics(site_id)
    forecast_daily = metrics["location_based_emissions_kg"].value
    result = calculate_quota_status(
        site_id=site_id,
        policy_id=QUOTA_POLICY.policy_id,
        used_kg_co2e=BASE_USED_KG_CO2E + forecast_daily,
        quota_kg_co2e=QUOTA_POLICY.quota_kg_co2e,
        forecast_daily_kg_co2e=forecast_daily,
        carbon_price_usd_per_tonne=QUOTA_POLICY.carbon_price_usd_per_tonne,
    )
    return QuotaStatusResponse(**result)


@app.post("/renewables/matching", response_model=MatchingResponse)
def renewable_matching(payload: RenewableMatchingRequest) -> MatchingResponse:
    hourly_energy = payload.hourly_energy or HOURLY_ENERGY
    result = calculate_cfe_matching(hourly_energy)
    return MatchingResponse(site_id=payload.site_id, **result)


@app.post("/optimizer/recommendations", response_model=list)
def optimizer_recommendations(payload: OptimizerRequest) -> list:
    metrics = _current_metrics(payload.site_id)
    matching = calculate_cfe_matching(HOURLY_ENERGY)
    quota = quota_status(payload.site_id)
    gpu_utilization = 0.58
    return generate_recommendations(
        metrics=metrics,
        cfe_score=float(matching["cfe_score"]),
        quota_used_percent=quota.used_percent,
        gpu_utilization=gpu_utilization,
        allow_deferrable_workload_shift=payload.allow_deferrable_workload_shift,
    )


def _twin_servers(site_id: str) -> list:
    return [server for room in _twin_rooms(site_id) for rack in room.racks for server in rack.servers]


def _twin_chips(site_id: str) -> list:
    return [chip for server in _twin_servers(site_id) for chip in server.chips]


@app.get("/efficiency/workload-scheduling", response_model=WorkloadSchedulingResponse)
def efficiency_workload_scheduling(
    site_id: str = Query(default=SITE.id),
    sla_util_cap: float = Query(default=0.85, ge=0.5, le=0.98),
    allow_colocation: bool = Query(default=True),
) -> WorkloadSchedulingResponse:
    """Virtualization and QoS-aware co-location of SLA-sensitive services with
    deferrable batch jobs using an improved Xen-style boost scheduler."""
    try:
        return calculate_workload_scheduling(
            _twin_servers(site_id),
            site_id=site_id,
            sla_util_cap=sla_util_cap,
            allow_colocation=allow_colocation,
        )
    except CalculationError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.get("/efficiency/thermal-management", response_model=ThermalManagementResponse)
def efficiency_thermal_management(
    site_id: str = Query(default=SITE.id),
    sla_temp_c: float = Query(default=75.0, ge=50, le=110),
    horizon_minutes: int = Query(default=15, ge=1, le=120),
) -> ThermalManagementResponse:
    """Active thermal management: predict chip hotspots and co-schedule
    workload placement with fan/cooling setpoints."""
    try:
        return calculate_thermal_management(
            _twin_chips(site_id),
            PRIMARY_COOLING_SYSTEM,
            site_id=site_id,
            sla_temp_c=sla_temp_c,
            horizon_minutes=horizon_minutes,
        )
    except CalculationError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.get("/efficiency/distributed-battery", response_model=DistributedBatteryResponse)
def efficiency_distributed_battery(
    site_id: str = Query(default=SITE.id),
    power_budget_kw: float = Query(default=BATTERY_POWER_BUDGET_KW, gt=0),
) -> DistributedBatteryResponse:
    """Distributed server-level LiFePO4 UPS peak shaving that frees grid power
    headroom for additional server deployment."""
    try:
        return calculate_distributed_battery(
            BATTERY_POWER_PROFILE,
            power_budget_kw=power_budget_kw,
            battery_energy_kwh=BATTERY_ENERGY_KWH,
            max_discharge_kw=BATTERY_MAX_DISCHARGE_KW,
            per_server_kw=BATTERY_PER_SERVER_KW,
            site_id=site_id,
            centralized_ridethrough_minutes=BATTERY_CENTRALIZED_RIDETHROUGH_MIN,
        )
    except CalculationError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.get("/efficiency/global-energy-routing", response_model=GlobalEnergyRoutingResponse)
def efficiency_global_energy_routing() -> GlobalEnergyRoutingResponse:
    """Green-aware global energy routing across geo-distributed sites using
    renewable forecasts and wide-area workload migration."""
    try:
        return calculate_global_energy_routing(GLOBAL_ENERGY_REGIONS)
    except CalculationError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.get("/efficiency/optical-fabric", response_model=OpticalFabricResponse)
def efficiency_optical_fabric(site_id: str = Query(default=SITE.id)) -> OpticalFabricResponse:
    """High-speed optical migration fabric (40G/100G+/DWDM) for efficient data
    movement and congestion relief."""
    try:
        return calculate_optical_fabric(OPTICAL_LINKS, MIGRATION_JOBS, site_id=site_id)
    except CalculationError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.get("/efficiency/summary", response_model=EfficiencySummaryResponse)
def efficiency_summary(site_id: str = Query(default=SITE.id)) -> EfficiencySummaryResponse:
    """Cross-layer efficiency overview tying together all five system levers."""
    workload = calculate_workload_scheduling(_twin_servers(site_id), site_id=site_id)
    thermal = calculate_thermal_management(_twin_chips(site_id), PRIMARY_COOLING_SYSTEM, site_id=site_id)
    battery = calculate_distributed_battery(
        BATTERY_POWER_PROFILE,
        power_budget_kw=BATTERY_POWER_BUDGET_KW,
        battery_energy_kwh=BATTERY_ENERGY_KWH,
        max_discharge_kw=BATTERY_MAX_DISCHARGE_KW,
        per_server_kw=BATTERY_PER_SERVER_KW,
        site_id=site_id,
        centralized_ridethrough_minutes=BATTERY_CENTRALIZED_RIDETHROUGH_MIN,
    )
    routing = calculate_global_energy_routing(GLOBAL_ENERGY_REGIONS)
    optical = calculate_optical_fabric(OPTICAL_LINKS, MIGRATION_JOBS, site_id=site_id)

    levers = [
        EfficiencyLeverSummary(
            lever=EfficiencyLever.WORKLOAD_SCHEDULING,
            title="虚拟化与工作负载调度",
            headline="SLA-sensitive + batch co-location on an improved Xen boost scheduler",
            primary_metric="energy_saving_pct",
            primary_value=workload.energy_saving_pct,
            reference_value=REFERENCE_WORKLOAD_GAIN_PCT,
            endpoint="/efficiency/workload-scheduling",
            insight="Real-time QoS-ratio monitoring lets servers run hot without breaking SLAs, removing the need for overprovisioning.",
        ),
        EfficiencyLeverSummary(
            lever=EfficiencyLever.THERMAL_MANAGEMENT,
            title="热管理与冷却优化",
            headline="Predictive hotspot detection co-scheduled with fan/cooling setpoints",
            primary_metric="cooling_saving_pct",
            primary_value=thermal.cooling_saving_pct,
            reference_value=thermal.cooling_saving_pct,
            endpoint="/efficiency/thermal-management",
            insight="Anticipating hotspots avoids reactive fan overspeed; cooling power follows the affinity (cube) law.",
        ),
        EfficiencyLeverSummary(
            lever=EfficiencyLever.DISTRIBUTED_BATTERY,
            title="分布式电池技术",
            headline="Distributed server-level LiFePO4 UPS shaves multi-hour power peaks",
            primary_metric="extra_capacity_pct",
            primary_value=battery.extra_capacity_pct,
            reference_value=REFERENCE_BATTERY_EXTRA_PCT,
            endpoint="/efficiency/distributed-battery",
            insight="The data center becomes an energy-storage hub: batteries buffer peaks and renewable supply/demand mismatch.",
        ),
        EfficiencyLeverSummary(
            lever=EfficiencyLever.GLOBAL_ENERGY_ROUTING,
            title="全局分布式能源管理",
            headline="Green forecast + green-aware WAN routing across geo-distributed sites",
            primary_metric="interruption_reduction_x",
            primary_value=routing.interruption_reduction_x,
            reference_value=REFERENCE_INTERRUPTION_X,
            endpoint="/efficiency/global-energy-routing",
            insight="Software-defined efficiency: place compute where and when green energy is available, with a brown-power fallback.",
        ),
        EfficiencyLeverSummary(
            lever=EfficiencyLever.OPTICAL_FABRIC,
            title="光通信技术",
            headline="High-speed optical links (40G/100G+/DWDM) for migration and congestion relief",
            primary_metric="median_speedup_x",
            primary_value=optical.median_speedup_x,
            reference_value=optical.median_speedup_x,
            endpoint="/efficiency/optical-fabric",
            insight="Optical bandwidth is the enabler that makes intra-DC and cross-region workload mobility practical.",
        ),
    ]

    return EfficiencySummaryResponse(
        site_id=site_id,
        generated_at=datetime.now(UTC),
        method_version=METHOD_SUMMARY,
        levers=levers,
        cross_layer_insights=[
            "能效与性能平衡：用实时 QoS 比率监控取代过度配置，是释放能效潜力的关键。",
            "绿能利用的动态性：数据中心正演变为'储能中心'，分布式储能既削峰也平抑绿能供需错配。",
            "软件定义的能效：硬件趋于固定能耗后，节能取决于软件如何感知温度、电力合约与网络带宽，动态调整算力的物理位置。",
            "数据中心能效已是跨层协同的系统工程，而非单点硬件升级。",
        ],
        safety_constraints=[
            "Efficiency estimates are operational guidance and never reduce audited Scope 1/2/3 emissions or SCI.",
            "All levers preserve SLA, redundancy (N+1), data-residency, and chip thermal limits.",
        ],
    )


@app.get("/evidence/packages/{period}", response_model=EvidencePackage)
def evidence_package(period: str, site_id: str = Query(default=SITE.id)) -> EvidencePackage:
    inv = inventory(site_id=site_id, period=period)
    serialized = json.dumps(inv.model_dump(mode="json"), sort_keys=True)
    inventory_hash = hashlib.sha256(serialized.encode("utf-8")).hexdigest()
    quality_counts = Counter(record.data_quality_flag.value for record in inv.records)

    return EvidencePackage(
        site_id=site_id,
        period=period,
        inventory_hash=inventory_hash,
        method_versions=sorted({record.method_version for record in inv.records}),
        evidence_refs=sorted({ref for record in inv.records for ref in record.evidence_refs}),
        data_quality_summary=dict(quality_counts),
        storage_uri=f"s3://aidc-carbon-evidence/{site_id}/{period}/{inventory_hash}.json",
    )
