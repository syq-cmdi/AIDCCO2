from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, Field


class DataQualityFlag(StrEnum):
    MEASURED = "measured"
    ESTIMATED = "estimated"
    CONTRACTUAL = "contractual"
    SUBSTITUTED = "substituted"
    MISSING = "missing"


class MeterStream(StrEnum):
    FACILITY_ENERGY = "facility_energy_kwh"
    IT_ENERGY = "it_energy_kwh"
    COOLING_ENERGY = "cooling_energy_kwh"
    WATER = "water_liters"
    RENEWABLE_ENERGY = "renewable_energy_kwh"
    BACKUP_FUEL = "backup_fuel_liters"
    REFRIGERANT = "refrigerant_kg"
    GPU_UTILIZATION = "gpu_utilization"
    WORKLOAD_ENERGY = "workload_energy_kwh"
    STORAGE_CHARGE = "storage_charge_kwh"
    STORAGE_DISCHARGE = "storage_discharge_kwh"


class ScopeName(StrEnum):
    SCOPE_1 = "scope_1"
    SCOPE_2_LOCATION = "scope_2_location_based"
    SCOPE_2_MARKET = "scope_2_market_based"
    SCOPE_3 = "scope_3"
    OUT_OF_SCOPE_OFFSET = "offsets_separate_disclosure"


class MethodMetric(BaseModel):
    value: float
    unit: str
    method_version: str
    data_quality_flag: DataQualityFlag
    uncertainty_range: tuple[float, float]


class Site(BaseModel):
    id: str
    name: str
    region: str
    grid_zone: str
    timezone: str
    design_power_mw: float
    latitude: float
    longitude: float


class Asset(BaseModel):
    id: str
    site_id: str
    name: str
    asset_type: str
    rated_power_kw: float | None = None
    commissioned_at: date | None = None


class MeterReading(BaseModel):
    timestamp: datetime
    site_id: str
    stream: MeterStream
    value: float = Field(ge=0)
    unit: str
    source: str
    asset_id: str | None = None
    data_quality_flag: DataQualityFlag = DataQualityFlag.MEASURED


class GridCarbonIntensity(BaseModel):
    timestamp: datetime
    grid_zone: str
    average_kg_co2e_per_kwh: float = Field(ge=0)
    marginal_kg_co2e_per_kwh: float = Field(ge=0)
    source: str
    data_quality_flag: DataQualityFlag = DataQualityFlag.ESTIMATED


class EmissionFactor(BaseModel):
    id: str
    category: str
    factor_kg_co2e_per_unit: float
    unit: str
    source: str
    scope: ScopeName
    valid_from: date
    valid_to: date | None = None


class EnergyCertificate(BaseModel):
    certificate_id: str
    site_id: str
    energy_kwh: float = Field(ge=0)
    start_time: datetime
    end_time: datetime
    technology: str
    grid_zone: str
    issuer: str
    is_granular: bool
    retired_for_site_id: str | None = None


class PPAContract(BaseModel):
    id: str
    site_id: str
    counterparty: str
    technology: str
    grid_zone: str
    contracted_capacity_mw: float
    start_date: date
    end_date: date
    hourly_delivery_required: bool = True


class AIWorkloadRun(BaseModel):
    id: str
    site_id: str
    workload_type: Literal["training", "fine_tuning", "inference", "batch"]
    started_at: datetime
    ended_at: datetime
    gpu_hours: float
    energy_kwh: float
    functional_units: float
    functional_unit_name: str
    deferrable: bool
    sla_minutes: int | None = None


class LCAComponent(BaseModel):
    component_id: str
    site_id: str
    asset_id: str | None = None
    category: str
    total_embodied_kg_co2e: float = Field(ge=0)
    expected_lifetime_hours: float = Field(gt=0)
    installed_at: date
    resource_total: float = Field(gt=0)
    data_quality_flag: DataQualityFlag = DataQualityFlag.ESTIMATED


class EmissionRecord(BaseModel):
    scope: ScopeName
    category: str
    kg_co2e: float
    method_version: str
    data_quality_flag: DataQualityFlag
    uncertainty_range: tuple[float, float]
    evidence_refs: list[str] = Field(default_factory=list)


class QuotaPolicy(BaseModel):
    policy_id: str
    site_id: str
    name: str
    period_start: date
    period_end: date
    quota_kg_co2e: float = Field(gt=0)
    carbon_price_usd_per_tonne: float = Field(ge=0)
    rule_set: str


class QuotaAllocation(BaseModel):
    allocation_id: str
    policy_id: str
    owner: str
    owner_type: Literal["site", "department", "customer", "workload"]
    quota_kg_co2e: float = Field(gt=0)


class HourlyEnergy(BaseModel):
    timestamp: datetime
    load_kwh: float = Field(ge=0)
    eligible_cfe_kwh: float = Field(ge=0)
    marginal_emissions_kg_per_kwh: float = Field(ge=0)
    certificate_id: str | None = None


class TelemetryIngestRequest(BaseModel):
    site_id: str
    readings: list[MeterReading]


class RealtimeMetricsResponse(BaseModel):
    site_id: str
    generated_at: datetime
    interval_minutes: int
    metrics: dict[str, MethodMetric]


class InventoryResponse(BaseModel):
    site_id: str
    period: str
    inventory_total_location_based_kg: float
    inventory_total_market_based_kg: float
    offsets_retired_kg: float
    records: list[EmissionRecord]


class QuotaStatusResponse(BaseModel):
    site_id: str
    policy_id: str
    used_kg_co2e: float
    quota_kg_co2e: float
    remaining_kg_co2e: float
    used_percent: float
    forecast_exceedance_date: date | None
    compliance_gap_kg_co2e: float
    carbon_price_risk_usd: float


class RenewableMatchingRequest(BaseModel):
    site_id: str
    hourly_energy: list[HourlyEnergy] | None = None


class MatchingResponse(BaseModel):
    site_id: str
    cfe_score: float
    annual_match_ratio: float
    avoided_emissions_kg_co2e: float
    unmatched_load_kwh: float
    duplicate_certificate_ids: list[str]


class OptimizerRequest(BaseModel):
    site_id: str
    max_sla_temperature_c: float = 27
    allow_deferrable_workload_shift: bool = True


class Recommendation(BaseModel):
    id: str
    title: str
    lever: Literal[
        "cooling_digital_twin",
        "carbon_aware_scheduling",
        "gpu_utilization",
        "renewable_portfolio",
        "quota_risk"
    ]
    baseline_kg_co2e: float
    estimated_reduction_kg_co2e: float
    confidence: float = Field(ge=0, le=1)
    safety_constraints: list[str]
    rationale: str


class EvidencePackage(BaseModel):
    site_id: str
    period: str
    inventory_hash: str
    method_versions: list[str]
    evidence_refs: list[str]
    data_quality_summary: dict[str, int]
    storage_uri: str


class TwinVector3(BaseModel):
    x: float
    y: float
    z: float


class DigitalTwinSource(BaseModel):
    name: str
    tool_type: Literal[
        "commercial_cad",
        "open_bim",
        "model_hub",
        "web_3d_engine",
        "point_cloud",
        "simulation"
    ]
    official_url: str
    connector: str
    supported_formats: list[str]
    integration_status: Literal["configured", "optional_license_required", "open_source_ready"]
    audit_role: str


class ChipTwin(BaseModel):
    id: str
    server_id: str
    name: str
    chip_type: Literal["gpu", "cpu", "hbm", "nic", "vrm", "dpu"]
    package: str
    die_area_mm2: float = Field(gt=0)
    tdp_w: float = Field(gt=0)
    current_power_w: float = Field(ge=0)
    utilization: float = Field(ge=0, le=1)
    junction_temp_c: float
    hotspot_temp_c: float
    coolant_flow_lpm: float = Field(ge=0)
    thermal_resistance_c_per_w: float = Field(gt=0)
    carbon_kg_co2e_per_hour: float = Field(ge=0)
    material_ref: str
    sensor_refs: list[str]
    position: TwinVector3


class ServerTwin(BaseModel):
    id: str
    rack_id: str
    name: str
    u_position: int = Field(ge=1)
    height_u: int = Field(ge=1)
    model: str
    serial_hash: str
    owner: str
    workload_pool: str
    rated_power_kw: float = Field(gt=0)
    current_power_kw: float = Field(ge=0)
    gpu_count: int = Field(ge=0)
    cpu_count: int = Field(ge=0)
    inlet_temp_c: float
    outlet_temp_c: float
    utilization: float = Field(ge=0, le=1)
    embodied_kg_co2e: float = Field(ge=0)
    lca_lifetime_hours: float = Field(gt=0)
    telemetry_quality: DataQualityFlag = DataQualityFlag.MEASURED
    position: TwinVector3
    chips: list[ChipTwin] = Field(default_factory=list)


class EnvelopeComponentTwin(BaseModel):
    id: str
    building_id: str
    room_id: str | None = None
    component_type: Literal[
        "exterior_wall",
        "roof",
        "slab",
        "raised_floor",
        "hot_aisle_containment",
        "cold_aisle_containment",
        "fire_door",
        "vapor_barrier",
        "cable_penetration",
        "acoustic_panel"
    ]
    material: str
    area_m2: float = Field(gt=0)
    u_value_w_m2k: float = Field(gt=0)
    leakage_class: str
    embodied_kg_co2e: float = Field(ge=0)
    surface_temp_c: float
    geometry_ref: str
    material_ref: str
    sensor_refs: list[str]
    position: TwinVector3


class CoolingEquipmentTwin(BaseModel):
    id: str
    building_id: str
    equipment_type: Literal[
        "water_cooled_chiller",
        "cooling_tower",
        "primary_chilled_water_pump",
        "condenser_water_pump",
        "plate_heat_exchanger",
        "cdu",
        "crah",
        "valve",
        "pipe_loop",
        "strainer"
    ]
    loop: Literal["primary_chilled_water", "condenser_water", "secondary_liquid", "airside"]
    name: str
    current_kw: float = Field(ge=0)
    cooling_load_kw: float = Field(ge=0)
    flow_lps: float = Field(ge=0)
    supply_temp_c: float
    return_temp_c: float
    delta_p_kpa: float = Field(ge=0)
    cop: float | None = None
    status: Literal["running", "standby", "alarm", "maintenance"]
    geometry_ref: str
    sensor_refs: list[str]
    position: TwinVector3


class ElectricalEquipmentTwin(BaseModel):
    id: str
    building_id: str
    equipment_type: Literal[
        "utility_incomer",
        "mv_switchgear",
        "transformer",
        "lv_switchgear",
        "ups",
        "battery_string",
        "ats",
        "busway",
        "pdu",
        "revenue_meter",
        "branch_meter"
    ]
    name: str
    upstream_id: str | None
    voltage_v: float = Field(gt=0)
    current_a: float = Field(ge=0)
    real_power_kw: float = Field(ge=0)
    power_factor: float = Field(ge=0, le=1)
    loss_kw: float = Field(ge=0)
    meter_class: str
    status: Literal["energized", "standby", "alarm", "maintenance"]
    geometry_ref: str
    sensor_refs: list[str]
    position: TwinVector3


class RackTwin(BaseModel):
    id: str
    room_id: str
    name: str
    row: str
    column: int
    height_u: int
    design_kw: float = Field(gt=0)
    current_kw: float = Field(ge=0)
    inlet_temp_c: float
    outlet_temp_c: float
    pressure_pa: float
    pue_overhead_factor: float = Field(ge=1)
    carbon_kg_co2e_per_hour: float = Field(ge=0)
    geometry_ref: str
    position: TwinVector3
    rotation_deg: float = 0
    servers: list[ServerTwin]


class RoomTwin(BaseModel):
    id: str
    building_id: str
    name: str
    floor: str
    cooling_topology: Literal["hot_aisle_containment", "cold_aisle_containment", "liquid_cooling_hybrid"]
    geometry_ref: str
    point_cloud_ref: str
    racks: list[RackTwin]


class BuildingTwin(BaseModel):
    id: str
    site_id: str
    name: str
    geometry_ref: str
    rooms: list[RoomTwin]


class CampusTwin(BaseModel):
    site_id: str
    name: str
    coordinate_system: str
    buildings: list[BuildingTwin]


class CarbonAuditLine(BaseModel):
    node_level: Literal["campus", "building", "room", "rack", "server"]
    node_id: str
    parent_id: str | None
    allocation_path: list[str]
    energy_kwh: float
    cooling_overhead_kwh: float
    scope2_location_kg: float
    scope2_market_kg: float
    embodied_kg: float
    total_location_kg: float
    total_market_kg: float
    method_version: str
    data_quality_flag: DataQualityFlag
    evidence_refs: list[str]


class DigitalTwinResponse(BaseModel):
    site_id: str
    generated_at: datetime
    refresh_seconds: int
    model_sources: list[DigitalTwinSource]
    campus: CampusTwin
    envelope_components: list[EnvelopeComponentTwin]
    primary_cooling_system: list[CoolingEquipmentTwin]
    electrical_metering_system: list[ElectricalEquipmentTwin]
    rack_count: int
    server_count: int
    chip_count: int
    aggregate_location_kg_per_hour: float
    aggregate_market_kg_per_hour: float
    server_layer_audit: list[CarbonAuditLine]


class ChipSimulationResponse(BaseModel):
    site_id: str
    generated_at: datetime
    rack_id: str
    server_id: str
    solver_method: str
    timestep_ms: int
    total_chip_power_kw: float
    max_junction_temp_c: float
    max_hotspot_temp_c: float
    coolant_flow_lpm: float
    chip_count: int
    chips: list[ChipTwin]


class PhotorealToolIntegration(BaseModel):
    name: str
    category: Literal[
        "usd_platform",
        "rendering",
        "streaming",
        "model_authoring",
        "asset_validation",
        "simulation",
        "web_runtime",
        "accounting"
    ]
    official_url: str
    integration_role: str
    connector: str
    runtime_status: Literal["configured", "installed", "requires_license", "requires_external_service"]
    evidence_refs: list[str]


class PhotorealPipelineStage(BaseModel):
    stage_id: str
    name: str
    owner: str
    input_formats: list[str]
    output_formats: list[str]
    acceptance_criteria: list[str]
    automation_endpoint: str
    status: Literal["ready", "requires_license", "requires_assets", "planned"]


class PhotorealQualityGate(BaseModel):
    gate_id: str
    name: str
    target: str
    current: str
    status: Literal["pass", "warning", "blocked", "not_applicable"]
    evidence_refs: list[str]


class AccountingToolIntegration(BaseModel):
    name: str
    domain: Literal[
        "corporate_inventory",
        "scope2_energy",
        "software_carbon_intensity",
        "lifecycle_assessment",
        "marginal_emissions",
        "audit_evidence"
    ]
    official_url: str
    connector: str
    data_objects: list[str]
    verification_controls: list[str]
    runtime_status: Literal["configured", "installed", "requires_api_key", "requires_license", "planned"]


class OmniverseFidelityPolicyResponse(BaseModel):
    site_id: str
    generated_at: datetime
    target_fidelity: str
    usd_stage_uri: str
    web_runtime_uri: str
    renderer_modes: list[str]
    policy_principles: list[str]
    tool_integrations: list[PhotorealToolIntegration]
    pipeline_stages: list[PhotorealPipelineStage]
    quality_gates: list[PhotorealQualityGate]
    accounting_integrations: list[AccountingToolIntegration]


class ApiMessage(BaseModel):
    status: str
    detail: str
    data: dict[str, Any] = Field(default_factory=dict)


# --------------------------------------------------------------------------
# Cross-layer energy-efficiency upgrade
#
# These models extend the carbon platform with the system-level efficiency
# levers studied in data-center energy-efficiency research: virtualization and
# QoS-aware workload co-location, active thermal/cooling co-scheduling,
# distributed server-level battery peak shaving, green-aware global load
# routing, and a high-speed optical migration fabric. They stay separate from
# the audited carbon inventory: efficiency estimates are operational guidance
# and never reduce physical Scope 1/2/3 emissions or SCI.
# --------------------------------------------------------------------------


class WorkloadClass(StrEnum):
    SLA_SENSITIVE = "sla_sensitive"
    BATCH = "batch"


class EfficiencyLever(StrEnum):
    WORKLOAD_SCHEDULING = "workload_scheduling"
    THERMAL_MANAGEMENT = "thermal_management"
    DISTRIBUTED_BATTERY = "distributed_battery"
    GLOBAL_ENERGY_ROUTING = "global_energy_routing"
    OPTICAL_FABRIC = "optical_fabric"


# ---- 1. Virtualization and QoS-aware workload scheduling ----


class ColocationServerPlan(BaseModel):
    server_id: str
    foreground_class: WorkloadClass
    background_class: WorkloadClass | None
    baseline_utilization: float
    colocated_utilization: float
    absorbed_batch_kw: float
    qos_ratio: float
    sla_respected: bool
    scheduler_mode: str
    baseline_power_kw: float
    colocated_power_kw: float
    state: Literal["host", "parked"]


class WorkloadSchedulingResponse(BaseModel):
    site_id: str
    generated_at: datetime
    scheduler: str
    method_version: str
    reference_efficiency_gain_pct: float
    servers_total: int
    sla_servers: int
    batch_servers: int
    servers_parked: int
    fleet_qos_ratio: float
    min_qos_ratio: float
    sla_target_qos: float
    sla_violations: int
    baseline_power_kw: float
    optimized_power_kw: float
    energy_saving_pct: float
    peak_node_efficiency_gain_pct: float
    server_plans: list[ColocationServerPlan]
    safety_constraints: list[str]
    notes: list[str]


# ---- 2. Active thermal management and cooling co-scheduling ----


class HotspotPrediction(BaseModel):
    chip_id: str
    server_id: str
    chip_type: str
    current_hotspot_c: float
    predicted_hotspot_c: float
    headroom_c: float
    risk: Literal["nominal", "watch", "throttle_risk"]
    recommended_action: str


class FanZoneSetpoint(BaseModel):
    zone_id: str
    equipment_type: str
    baseline_speed_pct: float
    optimized_speed_pct: float
    baseline_power_kw: float
    optimized_power_kw: float
    bound_by: str


class ThermalManagementResponse(BaseModel):
    site_id: str
    generated_at: datetime
    method_version: str
    horizon_minutes: int
    sla_temp_c: float
    chips_evaluated: int
    hotspots_flagged: int
    current_max_hotspot_c: float
    predicted_max_hotspot_c: float
    baseline_cooling_kw: float
    optimized_cooling_kw: float
    cooling_saving_pct: float
    workload_migrations: list[str]
    hotspot_predictions: list[HotspotPrediction]
    fan_zones: list[FanZoneSetpoint]
    safety_constraints: list[str]


# ---- 3. Distributed server-level battery peak shaving ----


class PeakWindow(BaseModel):
    start_index: int
    duration_hours: int
    peak_kw: float
    energy_above_budget_kwh: float
    covered_by_battery: bool


class DistributedBatteryResponse(BaseModel):
    site_id: str
    generated_at: datetime
    method_version: str
    chemistry: str
    reference_extra_capacity_pct: float
    power_budget_kw: float
    observed_peak_kw: float
    shaved_peak_kw: float
    sustainable_shave_kw: float
    battery_energy_kwh: float
    max_discharge_kw: float
    longest_peak_hours: int
    per_server_kw: float
    extra_servers_distributed: int
    extra_servers_centralized: int
    extra_capacity_pct: float
    centralized_ridethrough_minutes: float
    peak_windows: list[PeakWindow]
    notes: list[str]


# ---- 4. Green-aware global energy routing ----


class RegionEnergyState(BaseModel):
    site_id: str
    region: str
    load_mw: float = Field(ge=0)
    green_forecast_mw: float = Field(ge=0)
    grid_ci_kg_per_kwh: float = Field(ge=0)
    latency_class: Literal["edge", "regional", "global"]
    deferrable_fraction: float = Field(ge=0, le=1)


class RegionRoutingPlan(BaseModel):
    site_id: str
    region: str
    load_before_mw: float
    load_after_mw: float
    migrated_in_mw: float
    migrated_out_mw: float
    green_coverage_before: float
    green_coverage_after: float
    grid_ci_kg_per_kwh: float


class GlobalEnergyRoutingResponse(BaseModel):
    generated_at: datetime
    method_version: str
    reference_interruption_reduction_x: float
    total_load_mw: float
    total_green_mw: float
    green_coverage_before: float
    green_coverage_after: float
    migrated_load_mw: float
    job_interruptions_before: int
    job_interruptions_after: int
    interruption_reduction_x: float
    avoided_brown_mwh_per_hour: float
    region_plans: list[RegionRoutingPlan]
    safety_constraints: list[str]


# ---- 5. High-speed optical migration fabric ----


class OpticalLink(BaseModel):
    link_id: str
    scope: Literal["intra_dc", "inter_region"]
    endpoint_a: str
    endpoint_b: str
    capacity_gbps: float = Field(gt=0)
    distance_km: float = Field(ge=0)
    wavelengths: int = Field(ge=1)


class MigrationJob(BaseModel):
    job_id: str
    source: str
    target: str
    data_gb: float = Field(gt=0)
    deadline_s: float = Field(gt=0)
    priority: WorkloadClass


class OpticalLinkLoad(BaseModel):
    link_id: str
    scope: str
    capacity_gbps: float
    offered_gbps: float
    utilization: float
    congested: bool


class MigrationPlan(BaseModel):
    job_id: str
    link_id: str
    data_gb: float
    throughput_gbps: float
    transfer_seconds: float
    meets_deadline: bool
    legacy_transfer_seconds: float
    speedup_x: float


class OpticalFabricResponse(BaseModel):
    site_id: str
    generated_at: datetime
    method_version: str
    legacy_link_gbps: float
    aggregate_capacity_gbps: float
    aggregate_offered_gbps: float
    fabric_utilization: float
    congested_links: int
    jobs_meeting_deadline: int
    jobs_total: int
    median_speedup_x: float
    energy_per_gb_optical_j: float
    energy_per_gb_electrical_j: float
    link_loads: list[OpticalLinkLoad]
    migration_plans: list[MigrationPlan]
    notes: list[str]


# ---- Combined cross-layer efficiency summary ----


class EfficiencyLeverSummary(BaseModel):
    lever: EfficiencyLever
    title: str
    headline: str
    primary_metric: str
    primary_value: float
    reference_value: float
    endpoint: str
    insight: str


class EfficiencySummaryResponse(BaseModel):
    site_id: str
    generated_at: datetime
    method_version: str
    levers: list[EfficiencyLeverSummary]
    cross_layer_insights: list[str]
    safety_constraints: list[str]
