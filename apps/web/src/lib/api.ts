export type RealtimeMetrics = {
  site_id: string;
  generated_at: string;
  interval_minutes: number;
  metrics: Record<
    string,
    {
      value: number;
      unit: string;
      method_version: string;
      data_quality_flag: string;
      uncertainty_range: [number, number];
    }
  >;
};

export type QuotaStatus = {
  site_id: string;
  policy_id: string;
  used_kg_co2e: number;
  quota_kg_co2e: number;
  remaining_kg_co2e: number;
  used_percent: number;
  forecast_exceedance_date: string | null;
  compliance_gap_kg_co2e: number;
  carbon_price_risk_usd: number;
};

export type MatchingResult = {
  site_id: string;
  cfe_score: number;
  annual_match_ratio: number;
  avoided_emissions_kg_co2e: number;
  unmatched_load_kwh: number;
  duplicate_certificate_ids: string[];
};

export type TwinVector3 = {
  x: number;
  y: number;
  z: number;
};

export type DigitalTwinSource = {
  name: string;
  tool_type: string;
  official_url: string;
  connector: string;
  supported_formats: string[];
  integration_status: string;
  audit_role: string;
};

export type ChipTwin = {
  id: string;
  server_id: string;
  name: string;
  chip_type: "gpu" | "cpu" | "hbm" | "nic" | "vrm" | "dpu";
  package: string;
  die_area_mm2: number;
  tdp_w: number;
  current_power_w: number;
  utilization: number;
  junction_temp_c: number;
  hotspot_temp_c: number;
  coolant_flow_lpm: number;
  thermal_resistance_c_per_w: number;
  carbon_kg_co2e_per_hour: number;
  material_ref: string;
  sensor_refs: string[];
  position: TwinVector3;
};

export type ServerTwin = {
  id: string;
  rack_id: string;
  name: string;
  u_position: number;
  height_u: number;
  model: string;
  serial_hash: string;
  owner: string;
  workload_pool: string;
  rated_power_kw: number;
  current_power_kw: number;
  gpu_count: number;
  cpu_count: number;
  inlet_temp_c: number;
  outlet_temp_c: number;
  utilization: number;
  embodied_kg_co2e: number;
  lca_lifetime_hours: number;
  telemetry_quality: string;
  position: TwinVector3;
  chips: ChipTwin[];
};

export type EnvelopeComponentTwin = {
  id: string;
  building_id: string;
  room_id: string | null;
  component_type: string;
  material: string;
  area_m2: number;
  u_value_w_m2k: number;
  leakage_class: string;
  embodied_kg_co2e: number;
  surface_temp_c: number;
  geometry_ref: string;
  material_ref: string;
  sensor_refs: string[];
  position: TwinVector3;
};

export type CoolingEquipmentTwin = {
  id: string;
  building_id: string;
  equipment_type: string;
  loop: string;
  name: string;
  current_kw: number;
  cooling_load_kw: number;
  flow_lps: number;
  supply_temp_c: number;
  return_temp_c: number;
  delta_p_kpa: number;
  cop: number | null;
  status: string;
  geometry_ref: string;
  sensor_refs: string[];
  position: TwinVector3;
};

export type ElectricalEquipmentTwin = {
  id: string;
  building_id: string;
  equipment_type: string;
  name: string;
  upstream_id: string | null;
  voltage_v: number;
  current_a: number;
  real_power_kw: number;
  power_factor: number;
  loss_kw: number;
  meter_class: string;
  status: string;
  geometry_ref: string;
  sensor_refs: string[];
  position: TwinVector3;
};

export type RackTwin = {
  id: string;
  room_id: string;
  name: string;
  row: string;
  column: number;
  height_u: number;
  design_kw: number;
  current_kw: number;
  inlet_temp_c: number;
  outlet_temp_c: number;
  pressure_pa: number;
  pue_overhead_factor: number;
  carbon_kg_co2e_per_hour: number;
  geometry_ref: string;
  position: TwinVector3;
  rotation_deg: number;
  servers: ServerTwin[];
};

export type RoomTwin = {
  id: string;
  building_id: string;
  name: string;
  floor: string;
  cooling_topology: string;
  geometry_ref: string;
  point_cloud_ref: string;
  racks: RackTwin[];
};

export type BuildingTwin = {
  id: string;
  site_id: string;
  name: string;
  geometry_ref: string;
  rooms: RoomTwin[];
};

export type CampusTwin = {
  site_id: string;
  name: string;
  coordinate_system: string;
  buildings: BuildingTwin[];
};

export type CarbonAuditLine = {
  node_level: "campus" | "building" | "room" | "rack" | "server";
  node_id: string;
  parent_id: string | null;
  allocation_path: string[];
  energy_kwh: number;
  cooling_overhead_kwh: number;
  scope2_location_kg: number;
  scope2_market_kg: number;
  embodied_kg: number;
  total_location_kg: number;
  total_market_kg: number;
  method_version: string;
  data_quality_flag: string;
  evidence_refs: string[];
};

export type DigitalTwinResponse = {
  site_id: string;
  generated_at: string;
  refresh_seconds: number;
  model_sources: DigitalTwinSource[];
  campus: CampusTwin;
  envelope_components: EnvelopeComponentTwin[];
  primary_cooling_system: CoolingEquipmentTwin[];
  electrical_metering_system: ElectricalEquipmentTwin[];
  rack_count: number;
  server_count: number;
  chip_count: number;
  aggregate_location_kg_per_hour: number;
  aggregate_market_kg_per_hour: number;
  server_layer_audit: CarbonAuditLine[];
};

export type ChipSimulationResponse = {
  site_id: string;
  generated_at: string;
  rack_id: string;
  server_id: string;
  solver_method: string;
  timestep_ms: number;
  total_chip_power_kw: number;
  max_junction_temp_c: number;
  max_hotspot_temp_c: number;
  coolant_flow_lpm: number;
  chip_count: number;
  chips: ChipTwin[];
};

export type PhotorealToolIntegration = {
  name: string;
  category: string;
  official_url: string;
  integration_role: string;
  connector: string;
  runtime_status: string;
  evidence_refs: string[];
};

export type PhotorealPipelineStage = {
  stage_id: string;
  name: string;
  owner: string;
  input_formats: string[];
  output_formats: string[];
  acceptance_criteria: string[];
  automation_endpoint: string;
  status: string;
};

export type PhotorealQualityGate = {
  gate_id: string;
  name: string;
  target: string;
  current: string;
  status: "pass" | "warning" | "blocked" | "not_applicable";
  evidence_refs: string[];
};

export type AccountingToolIntegration = {
  name: string;
  domain: string;
  official_url: string;
  connector: string;
  data_objects: string[];
  verification_controls: string[];
  runtime_status: string;
};

export type OmniverseFidelityPolicy = {
  site_id: string;
  generated_at: string;
  target_fidelity: string;
  usd_stage_uri: string;
  web_runtime_uri: string;
  renderer_modes: string[];
  policy_principles: string[];
  tool_integrations: PhotorealToolIntegration[];
  pipeline_stages: PhotorealPipelineStage[];
  quality_gates: PhotorealQualityGate[];
  accounting_integrations: AccountingToolIntegration[];
};

// ---- Cross-layer energy-efficiency upgrade ----

export type ColocationServerPlan = {
  server_id: string;
  foreground_class: "sla_sensitive" | "batch";
  background_class: "sla_sensitive" | "batch" | null;
  baseline_utilization: number;
  colocated_utilization: number;
  absorbed_batch_kw: number;
  qos_ratio: number;
  sla_respected: boolean;
  scheduler_mode: string;
  baseline_power_kw: number;
  colocated_power_kw: number;
  state: "host" | "parked";
};

export type WorkloadSchedulingResponse = {
  site_id: string;
  generated_at: string;
  scheduler: string;
  method_version: string;
  reference_efficiency_gain_pct: number;
  servers_total: number;
  sla_servers: number;
  batch_servers: number;
  servers_parked: number;
  fleet_qos_ratio: number;
  min_qos_ratio: number;
  sla_target_qos: number;
  sla_violations: number;
  baseline_power_kw: number;
  optimized_power_kw: number;
  energy_saving_pct: number;
  peak_node_efficiency_gain_pct: number;
  server_plans: ColocationServerPlan[];
  safety_constraints: string[];
  notes: string[];
};

export type HotspotPrediction = {
  chip_id: string;
  server_id: string;
  chip_type: string;
  current_hotspot_c: number;
  predicted_hotspot_c: number;
  headroom_c: number;
  risk: "nominal" | "watch" | "throttle_risk";
  recommended_action: string;
};

export type FanZoneSetpoint = {
  zone_id: string;
  equipment_type: string;
  baseline_speed_pct: number;
  optimized_speed_pct: number;
  baseline_power_kw: number;
  optimized_power_kw: number;
  bound_by: string;
};

export type ThermalManagementResponse = {
  site_id: string;
  generated_at: string;
  method_version: string;
  horizon_minutes: number;
  sla_temp_c: number;
  chips_evaluated: number;
  hotspots_flagged: number;
  current_max_hotspot_c: number;
  predicted_max_hotspot_c: number;
  baseline_cooling_kw: number;
  optimized_cooling_kw: number;
  cooling_saving_pct: number;
  workload_migrations: string[];
  hotspot_predictions: HotspotPrediction[];
  fan_zones: FanZoneSetpoint[];
  safety_constraints: string[];
};

export type PeakWindow = {
  start_index: number;
  duration_hours: number;
  peak_kw: number;
  energy_above_budget_kwh: number;
  covered_by_battery: boolean;
};

export type DistributedBatteryResponse = {
  site_id: string;
  generated_at: string;
  method_version: string;
  chemistry: string;
  reference_extra_capacity_pct: number;
  power_budget_kw: number;
  observed_peak_kw: number;
  shaved_peak_kw: number;
  sustainable_shave_kw: number;
  battery_energy_kwh: number;
  max_discharge_kw: number;
  longest_peak_hours: number;
  per_server_kw: number;
  extra_servers_distributed: number;
  extra_servers_centralized: number;
  extra_capacity_pct: number;
  centralized_ridethrough_minutes: number;
  peak_windows: PeakWindow[];
  notes: string[];
};

export type RegionRoutingPlan = {
  site_id: string;
  region: string;
  load_before_mw: number;
  load_after_mw: number;
  migrated_in_mw: number;
  migrated_out_mw: number;
  green_coverage_before: number;
  green_coverage_after: number;
  grid_ci_kg_per_kwh: number;
};

export type GlobalEnergyRoutingResponse = {
  generated_at: string;
  method_version: string;
  reference_interruption_reduction_x: number;
  total_load_mw: number;
  total_green_mw: number;
  green_coverage_before: number;
  green_coverage_after: number;
  migrated_load_mw: number;
  job_interruptions_before: number;
  job_interruptions_after: number;
  interruption_reduction_x: number;
  avoided_brown_mwh_per_hour: number;
  region_plans: RegionRoutingPlan[];
  safety_constraints: string[];
};

export type OpticalLinkLoad = {
  link_id: string;
  scope: string;
  capacity_gbps: number;
  offered_gbps: number;
  utilization: number;
  congested: boolean;
};

export type MigrationPlan = {
  job_id: string;
  link_id: string;
  data_gb: number;
  throughput_gbps: number;
  transfer_seconds: number;
  meets_deadline: boolean;
  legacy_transfer_seconds: number;
  speedup_x: number;
};

export type OpticalFabricResponse = {
  site_id: string;
  generated_at: string;
  method_version: string;
  legacy_link_gbps: number;
  aggregate_capacity_gbps: number;
  aggregate_offered_gbps: number;
  fabric_utilization: number;
  congested_links: number;
  jobs_meeting_deadline: number;
  jobs_total: number;
  median_speedup_x: number;
  energy_per_gb_optical_j: number;
  energy_per_gb_electrical_j: number;
  link_loads: OpticalLinkLoad[];
  migration_plans: MigrationPlan[];
  notes: string[];
};

export type EfficiencyLeverSummary = {
  lever:
    | "workload_scheduling"
    | "thermal_management"
    | "distributed_battery"
    | "global_energy_routing"
    | "optical_fabric";
  title: string;
  headline: string;
  primary_metric: string;
  primary_value: number;
  reference_value: number;
  endpoint: string;
  insight: string;
};

export type EfficiencySummaryResponse = {
  site_id: string;
  generated_at: string;
  method_version: string;
  levers: EfficiencyLeverSummary[];
  cross_layer_insights: string[];
  safety_constraints: string[];
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function loadRealtimeMetrics(siteId = "aidc-sg-01") {
  return getJson<RealtimeMetrics>(`/metrics/realtime?site_id=${siteId}&interval_minutes=5`);
}

export async function loadQuotaStatus(siteId = "aidc-sg-01") {
  return getJson<QuotaStatus>(`/quota/status?site_id=${siteId}`);
}

export async function loadMatching(siteId = "aidc-sg-01") {
  try {
    const response = await fetch(`${API_BASE}/renewables/matching`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site_id: siteId }),
      cache: "no-store"
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as MatchingResult;
  } catch {
    return null;
  }
}

export async function loadDigitalTwin(siteId = "aidc-sg-01") {
  return getJson<DigitalTwinResponse>(`/digital-twin/${siteId}`);
}

export async function loadChipSimulation(siteId = "aidc-sg-01", rackId?: string, serverId?: string) {
  const params = new URLSearchParams();
  if (rackId) {
    params.set("rack_id", rackId);
  }
  if (serverId) {
    params.set("server_id", serverId);
  }
  const query = params.toString();
  return getJson<ChipSimulationResponse>(`/digital-twin/${siteId}/chip-simulation${query ? `?${query}` : ""}`);
}

export async function loadOmniversePolicy(siteId = "aidc-sg-01") {
  return getJson<OmniverseFidelityPolicy>(`/photorealism/omniverse-policy/${siteId}`);
}

export async function loadWorkloadScheduling(siteId = "aidc-sg-01") {
  return getJson<WorkloadSchedulingResponse>(`/efficiency/workload-scheduling?site_id=${siteId}`);
}

export async function loadThermalManagement(siteId = "aidc-sg-01") {
  return getJson<ThermalManagementResponse>(`/efficiency/thermal-management?site_id=${siteId}`);
}

export async function loadDistributedBattery(siteId = "aidc-sg-01") {
  return getJson<DistributedBatteryResponse>(`/efficiency/distributed-battery?site_id=${siteId}`);
}

export async function loadGlobalEnergyRouting() {
  return getJson<GlobalEnergyRoutingResponse>(`/efficiency/global-energy-routing`);
}

export async function loadOpticalFabric(siteId = "aidc-sg-01") {
  return getJson<OpticalFabricResponse>(`/efficiency/optical-fabric?site_id=${siteId}`);
}

export async function loadEfficiencySummary(siteId = "aidc-sg-01") {
  return getJson<EfficiencySummaryResponse>(`/efficiency/summary?site_id=${siteId}`);
}
