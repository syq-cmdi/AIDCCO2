from __future__ import annotations

from collections import Counter, defaultdict
from datetime import UTC, date, timedelta
from math import ceil

from .models import CarbonAuditLine, DataQualityFlag, HourlyEnergy, LCAComponent, MethodMetric, MeterReading, MeterStream, RackTwin, Recommendation, RoomTwin, ServerTwin

METHOD_NRT = "nrt-dmrv-v0.1"
METHOD_KPI = "iso-iec-30134-v0.1"
METHOD_SCOPE2_LOCATION = "ghgp-scope2-location-v0.1"
METHOD_SCOPE2_MARKET = "ghgp-scope2-market-v0.1"
METHOD_SCI = "iso-iec-21031-v0.1"
METHOD_CFE = "24-7-cfe-v0.1"
METHOD_TWIN_AUDIT = "rack-server-twin-carbon-audit-v0.1"


class CalculationError(ValueError):
    pass


def _safe_ratio(numerator: float, denominator: float, name: str) -> float:
    if denominator <= 0:
        raise CalculationError(f"{name} denominator must be greater than zero")
    return numerator / denominator


def _quality(readings: list[MeterReading]) -> DataQualityFlag:
    flags = {reading.data_quality_flag for reading in readings}
    if DataQualityFlag.MISSING in flags:
        return DataQualityFlag.MISSING
    if DataQualityFlag.SUBSTITUTED in flags:
        return DataQualityFlag.SUBSTITUTED
    if DataQualityFlag.ESTIMATED in flags:
        return DataQualityFlag.ESTIMATED
    if DataQualityFlag.CONTRACTUAL in flags:
        return DataQualityFlag.CONTRACTUAL
    return DataQualityFlag.MEASURED


def _metric(value: float, unit: str, method_version: str, quality: DataQualityFlag, uncertainty_pct: float) -> MethodMetric:
    spread = abs(value) * uncertainty_pct
    return MethodMetric(
        value=round(value, 6),
        unit=unit,
        method_version=method_version,
        data_quality_flag=quality,
        uncertainty_range=(round(value - spread, 6), round(value + spread, 6)),
    )


def aggregate_readings(readings: list[MeterReading]) -> dict[str, float]:
    totals: dict[str, float] = defaultdict(float)
    for reading in readings:
        totals[reading.stream.value] += reading.value
    return dict(totals)


def calculate_realtime_metrics(
    readings: list[MeterReading],
    average_grid_kg_per_kwh: float,
    market_based_kg_per_kwh: float,
) -> dict[str, MethodMetric]:
    aggregates = aggregate_readings(readings)
    quality = _quality(readings)

    facility = aggregates.get(MeterStream.FACILITY_ENERGY.value, 0)
    it = aggregates.get(MeterStream.IT_ENERGY.value, 0)
    cooling = aggregates.get(MeterStream.COOLING_ENERGY.value, 0)
    water = aggregates.get(MeterStream.WATER.value, 0)
    renewable = aggregates.get(MeterStream.RENEWABLE_ENERGY.value, 0)

    pue = _safe_ratio(facility, it, "PUE")
    location_emissions = facility * average_grid_kg_per_kwh
    market_emissions = facility * market_based_kg_per_kwh
    cue = _safe_ratio(location_emissions, it, "CUE")
    wue = _safe_ratio(water, it, "WUE")
    ref = min(_safe_ratio(renewable, facility, "REF"), 1.5)

    return {
        "facility_energy_kwh": _metric(facility, "kWh", METHOD_NRT, quality, 0.03),
        "it_energy_kwh": _metric(it, "kWh", METHOD_NRT, quality, 0.03),
        "cooling_energy_kwh": _metric(cooling, "kWh", METHOD_NRT, quality, 0.05),
        "pue": _metric(pue, "ratio", METHOD_KPI, quality, 0.025),
        "cue": _metric(cue, "kgCO2e/IT-kWh", "cue-ghgp-v0.1", DataQualityFlag.ESTIMATED, 0.12),
        "wue": _metric(wue, "L/IT-kWh", METHOD_KPI, quality, 0.08),
        "ref": _metric(ref, "ratio", METHOD_KPI, DataQualityFlag.CONTRACTUAL, 0.05),
        "location_based_emissions_kg": _metric(
            location_emissions,
            "kgCO2e",
            METHOD_SCOPE2_LOCATION,
            DataQualityFlag.ESTIMATED,
            0.12,
        ),
        "market_based_emissions_kg": _metric(
            market_emissions,
            "kgCO2e",
            METHOD_SCOPE2_MARKET,
            DataQualityFlag.CONTRACTUAL,
            0.15,
        ),
    }


def allocate_embodied_component(
    component: LCAComponent,
    time_reserved_hours: float,
    resources_reserved: float,
) -> float:
    time_share = _safe_ratio(time_reserved_hours, component.expected_lifetime_hours, "embodied time share")
    resource_share = _safe_ratio(resources_reserved, component.resource_total, "embodied resource share")
    return component.total_embodied_kg_co2e * time_share * resource_share


def calculate_sci(
    energy_kwh: float,
    location_grid_kg_per_kwh: float,
    embodied_kg_co2e: float,
    functional_units: float,
) -> MethodMetric:
    operational_g = energy_kwh * location_grid_kg_per_kwh * 1000
    embodied_g = embodied_kg_co2e * 1000
    sci = _safe_ratio(operational_g + embodied_g, functional_units, "SCI")
    return _metric(sci, "gCO2e/functional-unit", METHOD_SCI, DataQualityFlag.ESTIMATED, 0.15)


def calculate_cfe_matching(hourly_energy: list[HourlyEnergy]) -> dict[str, float | list[str]]:
    if not hourly_energy:
        raise CalculationError("hourly energy data is required")

    total_load = sum(hour.load_kwh for hour in hourly_energy)
    if total_load <= 0:
        raise CalculationError("total hourly load must be greater than zero")

    certificate_counts = Counter(hour.certificate_id for hour in hourly_energy if hour.certificate_id)
    duplicate_certificate_ids = sorted([certificate_id for certificate_id, count in certificate_counts.items() if count > 1])
    used_certificates: set[str] = set()

    matched = 0.0
    total_cfe = 0.0
    avoided = 0.0
    unmatched = 0.0

    for hour in hourly_energy:
        eligible = hour.eligible_cfe_kwh
        if hour.certificate_id:
            if hour.certificate_id in used_certificates:
                eligible = 0.0
            used_certificates.add(hour.certificate_id)
        matched_hour = min(hour.load_kwh, eligible)
        matched += matched_hour
        total_cfe += eligible
        avoided += matched_hour * hour.marginal_emissions_kg_per_kwh
        unmatched += max(hour.load_kwh - matched_hour, 0)

    return {
        "cfe_score": matched / total_load,
        "annual_match_ratio": total_cfe / total_load,
        "avoided_emissions_kg_co2e": avoided,
        "unmatched_load_kwh": unmatched,
        "duplicate_certificate_ids": duplicate_certificate_ids,
    }


def calculate_quota_status(
    site_id: str,
    policy_id: str,
    used_kg_co2e: float,
    quota_kg_co2e: float,
    forecast_daily_kg_co2e: float,
    carbon_price_usd_per_tonne: float,
    as_of: date | None = None,
) -> dict[str, float | date | None | str]:
    as_of = as_of or date.today()
    remaining = quota_kg_co2e - used_kg_co2e
    gap = max(used_kg_co2e - quota_kg_co2e, 0)
    if remaining < 0:
        exceedance_date = as_of
    elif forecast_daily_kg_co2e > 0:
        exceedance_date = as_of + timedelta(days=ceil(remaining / forecast_daily_kg_co2e))
    else:
        exceedance_date = None

    return {
        "site_id": site_id,
        "policy_id": policy_id,
        "used_kg_co2e": used_kg_co2e,
        "quota_kg_co2e": quota_kg_co2e,
        "remaining_kg_co2e": remaining,
        "used_percent": (used_kg_co2e / quota_kg_co2e) * 100,
        "forecast_exceedance_date": exceedance_date,
        "compliance_gap_kg_co2e": gap,
        "carbon_price_risk_usd": (gap / 1000) * carbon_price_usd_per_tonne,
    }


def generate_recommendations(
    metrics: dict[str, MethodMetric],
    cfe_score: float,
    quota_used_percent: float,
    gpu_utilization: float,
    allow_deferrable_workload_shift: bool,
) -> list[Recommendation]:
    recommendations: list[Recommendation] = []
    pue = metrics["pue"].value
    location_emissions = metrics["location_based_emissions_kg"].value

    if pue > 1.18:
        recommendations.append(
            Recommendation(
                id="cooling-mpc-001",
                title="冷却数字孪生 + MPC 设定点优化",
                lever="cooling_digital_twin",
                baseline_kg_co2e=location_emissions,
                estimated_reduction_kg_co2e=location_emissions * min((pue - 1.12) * 0.18, 0.08),
                confidence=0.72,
                safety_constraints=["Maintain rack inlet <= SLA limit", "Keep N+1 cooling redundancy", "No chiller short-cycling"],
                rationale="PUE is above the target band and cooling energy is a material share of facility load.",
            )
        )

    if allow_deferrable_workload_shift and cfe_score < 0.85:
        recommendations.append(
            Recommendation(
                id="carbon-aware-queue-001",
                title="可延迟训练任务迁移到低边际排放窗口",
                lever="carbon_aware_scheduling",
                baseline_kg_co2e=location_emissions,
                estimated_reduction_kg_co2e=location_emissions * 0.045,
                confidence=0.81,
                safety_constraints=["Respect workload SLA minutes", "Do not move regulated data across forbidden regions"],
                rationale="Hourly CFE score leaves unmatched load that can be reduced through time-shifting.",
            )
        )

    if gpu_utilization < 0.65:
        recommendations.append(
            Recommendation(
                id="gpu-batch-cache-001",
                title="GPU 批处理、缓存与低利用率合并",
                lever="gpu_utilization",
                baseline_kg_co2e=location_emissions,
                estimated_reduction_kg_co2e=location_emissions * 0.035,
                confidence=0.68,
                safety_constraints=["No degradation to online inference p95 latency", "Keep failover capacity reserved"],
                rationale="Low accelerator utilization increases SCI by spreading embodied and idle energy over fewer functional units.",
            )
        )

    if quota_used_percent > 75:
        recommendations.append(
            Recommendation(
                id="quota-risk-001",
                title="配额风险约束加入调度器",
                lever="quota_risk",
                baseline_kg_co2e=location_emissions,
                estimated_reduction_kg_co2e=location_emissions * 0.025,
                confidence=0.64,
                safety_constraints=["Quota rule set remains auditable", "No offset netting against physical metrics"],
                rationale="Quota consumption is approaching the internal control threshold.",
            )
        )

    return recommendations


def calculate_server_carbon_line(
    server: ServerTwin,
    parent_rack: RackTwin,
    interval_hours: float,
    location_grid_kg_per_kwh: float,
    market_grid_kg_per_kwh: float,
) -> CarbonAuditLine:
    energy_kwh = server.current_power_kw * interval_hours
    cooling_overhead_kwh = max(parent_rack.pue_overhead_factor - 1, 0) * energy_kwh
    allocatable_kwh = energy_kwh + cooling_overhead_kwh
    embodied_kg = (server.embodied_kg_co2e / server.lca_lifetime_hours) * interval_hours
    scope2_location = allocatable_kwh * location_grid_kg_per_kwh
    scope2_market = allocatable_kwh * market_grid_kg_per_kwh

    return CarbonAuditLine(
        node_level="server",
        node_id=server.id,
        parent_id=server.rack_id,
        allocation_path=[
            "facility_meter",
            "room_busway",
            parent_rack.id,
            server.id,
            "server_power_kw",
        ],
        energy_kwh=round(energy_kwh, 6),
        cooling_overhead_kwh=round(cooling_overhead_kwh, 6),
        scope2_location_kg=round(scope2_location, 6),
        scope2_market_kg=round(scope2_market, 6),
        embodied_kg=round(embodied_kg, 6),
        total_location_kg=round(scope2_location + embodied_kg, 6),
        total_market_kg=round(scope2_market + embodied_kg, 6),
        method_version=METHOD_TWIN_AUDIT,
        data_quality_flag=server.telemetry_quality,
        evidence_refs=[
            f"dcim://rack/{parent_rack.id}/server/{server.id}/power",
            f"bim://geometry/{parent_rack.geometry_ref}",
            f"lca://server/{server.model}/{server.serial_hash}",
        ],
    )


def rollup_audit_lines(
    node_level: str,
    node_id: str,
    parent_id: str | None,
    children: list[CarbonAuditLine],
    evidence_refs: list[str],
) -> CarbonAuditLine:
    quality_order = {
        DataQualityFlag.MEASURED: 0,
        DataQualityFlag.CONTRACTUAL: 1,
        DataQualityFlag.ESTIMATED: 2,
        DataQualityFlag.SUBSTITUTED: 3,
        DataQualityFlag.MISSING: 4,
    }
    worst_quality = max((child.data_quality_flag for child in children), key=lambda flag: quality_order[flag])
    return CarbonAuditLine(
        node_level=node_level,  # type: ignore[arg-type]
        node_id=node_id,
        parent_id=parent_id,
        allocation_path=["sum", node_level, node_id],
        energy_kwh=round(sum(child.energy_kwh for child in children), 6),
        cooling_overhead_kwh=round(sum(child.cooling_overhead_kwh for child in children), 6),
        scope2_location_kg=round(sum(child.scope2_location_kg for child in children), 6),
        scope2_market_kg=round(sum(child.scope2_market_kg for child in children), 6),
        embodied_kg=round(sum(child.embodied_kg for child in children), 6),
        total_location_kg=round(sum(child.total_location_kg for child in children), 6),
        total_market_kg=round(sum(child.total_market_kg for child in children), 6),
        method_version=METHOD_TWIN_AUDIT,
        data_quality_flag=worst_quality,
        evidence_refs=evidence_refs,
    )


def calculate_twin_carbon_audit(
    rooms: list[RoomTwin],
    interval_hours: float,
    location_grid_kg_per_kwh: float,
    market_grid_kg_per_kwh: float,
) -> list[CarbonAuditLine]:
    server_lines: list[CarbonAuditLine] = []
    rack_lines: list[CarbonAuditLine] = []
    room_lines: list[CarbonAuditLine] = []

    for room in rooms:
        room_children: list[CarbonAuditLine] = []
        for rack in room.racks:
            rack_children = [
                calculate_server_carbon_line(server, rack, interval_hours, location_grid_kg_per_kwh, market_grid_kg_per_kwh)
                for server in rack.servers
            ]
            server_lines.extend(rack_children)
            rack_line = rollup_audit_lines(
                "rack",
                rack.id,
                room.id,
                rack_children,
                [f"dcim://rack/{rack.id}/pdu", f"bim://geometry/{rack.geometry_ref}"],
            )
            rack_lines.append(rack_line)
            room_children.append(rack_line)

        room_lines.append(
            rollup_audit_lines(
                "room",
                room.id,
                room.building_id,
                room_children,
                [f"bim://geometry/{room.geometry_ref}", f"pointcloud://{room.point_cloud_ref}"],
            )
        )

    return [*room_lines, *rack_lines, *server_lines]
