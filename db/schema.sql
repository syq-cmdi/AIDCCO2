CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  region TEXT NOT NULL,
  grid_zone TEXT NOT NULL,
  timezone TEXT NOT NULL,
  design_power_mw DOUBLE PRECISION NOT NULL CHECK (design_power_mw > 0),
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  rated_power_kw DOUBLE PRECISION,
  commissioned_at DATE
);

CREATE TABLE IF NOT EXISTS meter_readings (
  time TIMESTAMPTZ NOT NULL,
  site_id TEXT NOT NULL REFERENCES sites(id),
  asset_id TEXT REFERENCES assets(id),
  stream TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL CHECK (value >= 0),
  unit TEXT NOT NULL,
  source TEXT NOT NULL,
  data_quality_flag TEXT NOT NULL,
  evidence_ref TEXT,
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

SELECT create_hypertable('meter_readings', 'time', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS meter_readings_site_stream_time_idx ON meter_readings (site_id, stream, time DESC);

CREATE TABLE IF NOT EXISTS grid_carbon_intensity (
  time TIMESTAMPTZ NOT NULL,
  grid_zone TEXT NOT NULL,
  average_kg_co2e_per_kwh DOUBLE PRECISION NOT NULL CHECK (average_kg_co2e_per_kwh >= 0),
  marginal_kg_co2e_per_kwh DOUBLE PRECISION NOT NULL CHECK (marginal_kg_co2e_per_kwh >= 0),
  source TEXT NOT NULL,
  data_quality_flag TEXT NOT NULL
);

SELECT create_hypertable('grid_carbon_intensity', 'time', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS grid_ci_zone_time_idx ON grid_carbon_intensity (grid_zone, time DESC);

CREATE TABLE IF NOT EXISTS emission_factors (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  factor_kg_co2e_per_unit DOUBLE PRECISION NOT NULL,
  unit TEXT NOT NULL,
  source TEXT NOT NULL,
  scope TEXT NOT NULL,
  valid_from DATE NOT NULL,
  valid_to DATE
);

CREATE TABLE IF NOT EXISTS energy_certificates (
  certificate_id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  energy_kwh DOUBLE PRECISION NOT NULL CHECK (energy_kwh >= 0),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  technology TEXT NOT NULL,
  grid_zone TEXT NOT NULL,
  issuer TEXT NOT NULL,
  is_granular BOOLEAN NOT NULL,
  retired_for_site_id TEXT,
  evidence_ref TEXT,
  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS energy_certificates_site_time_idx ON energy_certificates (site_id, start_time, end_time);

CREATE TABLE IF NOT EXISTS ppa_contracts (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  counterparty TEXT NOT NULL,
  technology TEXT NOT NULL,
  grid_zone TEXT NOT NULL,
  contracted_capacity_mw DOUBLE PRECISION NOT NULL CHECK (contracted_capacity_mw > 0),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  hourly_delivery_required BOOLEAN NOT NULL DEFAULT TRUE,
  evidence_ref TEXT,
  CHECK (end_date > start_date)
);

CREATE TABLE IF NOT EXISTS ai_workload_runs (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  workload_type TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  gpu_hours DOUBLE PRECISION NOT NULL CHECK (gpu_hours >= 0),
  energy_kwh DOUBLE PRECISION NOT NULL CHECK (energy_kwh >= 0),
  functional_units DOUBLE PRECISION NOT NULL CHECK (functional_units > 0),
  functional_unit_name TEXT NOT NULL,
  deferrable BOOLEAN NOT NULL,
  sla_minutes INTEGER,
  CHECK (ended_at > started_at)
);

CREATE TABLE IF NOT EXISTS lca_components (
  component_id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  asset_id TEXT REFERENCES assets(id),
  category TEXT NOT NULL,
  total_embodied_kg_co2e DOUBLE PRECISION NOT NULL CHECK (total_embodied_kg_co2e >= 0),
  expected_lifetime_hours DOUBLE PRECISION NOT NULL CHECK (expected_lifetime_hours > 0),
  installed_at DATE NOT NULL,
  resource_total DOUBLE PRECISION NOT NULL CHECK (resource_total > 0),
  data_quality_flag TEXT NOT NULL,
  evidence_ref TEXT
);

CREATE TABLE IF NOT EXISTS emission_records (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  period TEXT NOT NULL,
  scope TEXT NOT NULL,
  category TEXT NOT NULL,
  kg_co2e DOUBLE PRECISION NOT NULL,
  method_version TEXT NOT NULL,
  data_quality_flag TEXT NOT NULL,
  uncertainty_low DOUBLE PRECISION NOT NULL,
  uncertainty_high DOUBLE PRECISION NOT NULL,
  evidence_refs TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS emission_records_site_period_idx ON emission_records (site_id, period, scope);

CREATE TABLE IF NOT EXISTS quota_policies (
  policy_id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  name TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  quota_kg_co2e DOUBLE PRECISION NOT NULL CHECK (quota_kg_co2e > 0),
  carbon_price_usd_per_tonne DOUBLE PRECISION NOT NULL CHECK (carbon_price_usd_per_tonne >= 0),
  rule_set TEXT NOT NULL,
  CHECK (period_end > period_start)
);

CREATE TABLE IF NOT EXISTS evidence_packages (
  site_id TEXT NOT NULL REFERENCES sites(id),
  period TEXT NOT NULL,
  inventory_hash TEXT NOT NULL,
  method_versions TEXT[] NOT NULL,
  evidence_refs TEXT[] NOT NULL,
  data_quality_summary JSONB NOT NULL,
  storage_uri TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (site_id, period, inventory_hash)
);

CREATE TABLE IF NOT EXISTS digital_twin_model_sources (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  name TEXT NOT NULL,
  tool_type TEXT NOT NULL,
  official_url TEXT NOT NULL,
  connector TEXT NOT NULL,
  supported_formats TEXT[] NOT NULL,
  integration_status TEXT NOT NULL,
  audit_role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS twin_buildings (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  name TEXT NOT NULL,
  geometry_ref TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS twin_rooms (
  id TEXT PRIMARY KEY,
  building_id TEXT NOT NULL REFERENCES twin_buildings(id),
  name TEXT NOT NULL,
  floor TEXT NOT NULL,
  cooling_topology TEXT NOT NULL,
  geometry_ref TEXT NOT NULL,
  point_cloud_ref TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS twin_racks (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES twin_rooms(id),
  name TEXT NOT NULL,
  row_name TEXT NOT NULL,
  column_index INTEGER NOT NULL,
  height_u INTEGER NOT NULL,
  design_kw DOUBLE PRECISION NOT NULL CHECK (design_kw > 0),
  current_kw DOUBLE PRECISION NOT NULL CHECK (current_kw >= 0),
  inlet_temp_c DOUBLE PRECISION NOT NULL,
  outlet_temp_c DOUBLE PRECISION NOT NULL,
  pressure_pa DOUBLE PRECISION NOT NULL,
  pue_overhead_factor DOUBLE PRECISION NOT NULL CHECK (pue_overhead_factor >= 1),
  carbon_kg_co2e_per_hour DOUBLE PRECISION NOT NULL CHECK (carbon_kg_co2e_per_hour >= 0),
  geometry_ref TEXT NOT NULL,
  position_x DOUBLE PRECISION NOT NULL,
  position_y DOUBLE PRECISION NOT NULL,
  position_z DOUBLE PRECISION NOT NULL,
  rotation_deg DOUBLE PRECISION NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS twin_servers (
  id TEXT PRIMARY KEY,
  rack_id TEXT NOT NULL REFERENCES twin_racks(id),
  name TEXT NOT NULL,
  u_position INTEGER NOT NULL CHECK (u_position >= 1),
  height_u INTEGER NOT NULL CHECK (height_u >= 1),
  model TEXT NOT NULL,
  serial_hash TEXT NOT NULL,
  owner TEXT NOT NULL,
  workload_pool TEXT NOT NULL,
  rated_power_kw DOUBLE PRECISION NOT NULL CHECK (rated_power_kw > 0),
  current_power_kw DOUBLE PRECISION NOT NULL CHECK (current_power_kw >= 0),
  gpu_count INTEGER NOT NULL CHECK (gpu_count >= 0),
  cpu_count INTEGER NOT NULL CHECK (cpu_count >= 0),
  inlet_temp_c DOUBLE PRECISION NOT NULL,
  outlet_temp_c DOUBLE PRECISION NOT NULL,
  utilization DOUBLE PRECISION NOT NULL CHECK (utilization >= 0 AND utilization <= 1),
  embodied_kg_co2e DOUBLE PRECISION NOT NULL CHECK (embodied_kg_co2e >= 0),
  lca_lifetime_hours DOUBLE PRECISION NOT NULL CHECK (lca_lifetime_hours > 0),
  telemetry_quality TEXT NOT NULL,
  position_x DOUBLE PRECISION NOT NULL,
  position_y DOUBLE PRECISION NOT NULL,
  position_z DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS twin_chips (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL REFERENCES twin_servers(id),
  name TEXT NOT NULL,
  chip_type TEXT NOT NULL,
  package TEXT NOT NULL,
  die_area_mm2 DOUBLE PRECISION NOT NULL CHECK (die_area_mm2 > 0),
  tdp_w DOUBLE PRECISION NOT NULL CHECK (tdp_w > 0),
  current_power_w DOUBLE PRECISION NOT NULL CHECK (current_power_w >= 0),
  utilization DOUBLE PRECISION NOT NULL CHECK (utilization >= 0 AND utilization <= 1),
  junction_temp_c DOUBLE PRECISION NOT NULL,
  hotspot_temp_c DOUBLE PRECISION NOT NULL,
  coolant_flow_lpm DOUBLE PRECISION NOT NULL CHECK (coolant_flow_lpm >= 0),
  thermal_resistance_c_per_w DOUBLE PRECISION NOT NULL CHECK (thermal_resistance_c_per_w > 0),
  carbon_kg_co2e_per_hour DOUBLE PRECISION NOT NULL CHECK (carbon_kg_co2e_per_hour >= 0),
  material_ref TEXT NOT NULL,
  sensor_refs TEXT[] NOT NULL DEFAULT '{}',
  position_x DOUBLE PRECISION NOT NULL,
  position_y DOUBLE PRECISION NOT NULL,
  position_z DOUBLE PRECISION NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS twin_chips_server_idx ON twin_chips (server_id, chip_type);

CREATE TABLE IF NOT EXISTS envelope_components (
  id TEXT PRIMARY KEY,
  building_id TEXT NOT NULL REFERENCES twin_buildings(id),
  room_id TEXT REFERENCES twin_rooms(id),
  component_type TEXT NOT NULL,
  material TEXT NOT NULL,
  area_m2 DOUBLE PRECISION NOT NULL CHECK (area_m2 > 0),
  u_value_w_m2k DOUBLE PRECISION NOT NULL CHECK (u_value_w_m2k > 0),
  leakage_class TEXT NOT NULL,
  embodied_kg_co2e DOUBLE PRECISION NOT NULL CHECK (embodied_kg_co2e >= 0),
  surface_temp_c DOUBLE PRECISION NOT NULL,
  geometry_ref TEXT NOT NULL,
  material_ref TEXT NOT NULL,
  sensor_refs TEXT[] NOT NULL DEFAULT '{}',
  position_x DOUBLE PRECISION NOT NULL,
  position_y DOUBLE PRECISION NOT NULL,
  position_z DOUBLE PRECISION NOT NULL
);

CREATE INDEX IF NOT EXISTS envelope_components_building_idx ON envelope_components (building_id, room_id, component_type);

CREATE TABLE IF NOT EXISTS cooling_equipment (
  id TEXT PRIMARY KEY,
  building_id TEXT NOT NULL REFERENCES twin_buildings(id),
  equipment_type TEXT NOT NULL,
  loop TEXT NOT NULL,
  name TEXT NOT NULL,
  current_kw DOUBLE PRECISION NOT NULL CHECK (current_kw >= 0),
  cooling_load_kw DOUBLE PRECISION NOT NULL CHECK (cooling_load_kw >= 0),
  flow_lps DOUBLE PRECISION NOT NULL CHECK (flow_lps >= 0),
  supply_temp_c DOUBLE PRECISION NOT NULL,
  return_temp_c DOUBLE PRECISION NOT NULL,
  delta_p_kpa DOUBLE PRECISION NOT NULL CHECK (delta_p_kpa >= 0),
  cop DOUBLE PRECISION,
  status TEXT NOT NULL,
  geometry_ref TEXT NOT NULL,
  sensor_refs TEXT[] NOT NULL DEFAULT '{}',
  position_x DOUBLE PRECISION NOT NULL,
  position_y DOUBLE PRECISION NOT NULL,
  position_z DOUBLE PRECISION NOT NULL
);

CREATE INDEX IF NOT EXISTS cooling_equipment_loop_idx ON cooling_equipment (building_id, loop, equipment_type);

CREATE TABLE IF NOT EXISTS electrical_equipment (
  id TEXT PRIMARY KEY,
  building_id TEXT NOT NULL REFERENCES twin_buildings(id),
  equipment_type TEXT NOT NULL,
  name TEXT NOT NULL,
  upstream_id TEXT REFERENCES electrical_equipment(id),
  voltage_v DOUBLE PRECISION NOT NULL CHECK (voltage_v > 0),
  current_a DOUBLE PRECISION NOT NULL CHECK (current_a >= 0),
  real_power_kw DOUBLE PRECISION NOT NULL CHECK (real_power_kw >= 0),
  power_factor DOUBLE PRECISION NOT NULL CHECK (power_factor >= 0 AND power_factor <= 1),
  loss_kw DOUBLE PRECISION NOT NULL CHECK (loss_kw >= 0),
  meter_class TEXT NOT NULL,
  status TEXT NOT NULL,
  geometry_ref TEXT NOT NULL,
  sensor_refs TEXT[] NOT NULL DEFAULT '{}',
  position_x DOUBLE PRECISION NOT NULL,
  position_y DOUBLE PRECISION NOT NULL,
  position_z DOUBLE PRECISION NOT NULL
);

CREATE INDEX IF NOT EXISTS electrical_equipment_topology_idx ON electrical_equipment (building_id, upstream_id, equipment_type);

CREATE TABLE IF NOT EXISTS carbon_audit_lines (
  id BIGSERIAL PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  audit_time TIMESTAMPTZ NOT NULL,
  node_level TEXT NOT NULL,
  node_id TEXT NOT NULL,
  parent_id TEXT,
  allocation_path TEXT[] NOT NULL,
  energy_kwh DOUBLE PRECISION NOT NULL,
  cooling_overhead_kwh DOUBLE PRECISION NOT NULL,
  scope2_location_kg DOUBLE PRECISION NOT NULL,
  scope2_market_kg DOUBLE PRECISION NOT NULL,
  embodied_kg DOUBLE PRECISION NOT NULL,
  total_location_kg DOUBLE PRECISION NOT NULL,
  total_market_kg DOUBLE PRECISION NOT NULL,
  method_version TEXT NOT NULL,
  data_quality_flag TEXT NOT NULL,
  evidence_refs TEXT[] NOT NULL DEFAULT '{}'
);

SELECT create_hypertable('carbon_audit_lines', 'audit_time', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS carbon_audit_lines_node_idx ON carbon_audit_lines (site_id, node_level, node_id, audit_time DESC);

CREATE TABLE IF NOT EXISTS photoreal_tool_integrations (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  official_url TEXT NOT NULL,
  integration_role TEXT NOT NULL,
  connector TEXT NOT NULL,
  runtime_status TEXT NOT NULL,
  evidence_refs TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS photoreal_pipeline_stages (
  stage_id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  name TEXT NOT NULL,
  owner TEXT NOT NULL,
  input_formats TEXT[] NOT NULL,
  output_formats TEXT[] NOT NULL,
  acceptance_criteria TEXT[] NOT NULL,
  automation_endpoint TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS photoreal_quality_gates (
  gate_id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  name TEXT NOT NULL,
  target TEXT NOT NULL,
  current TEXT NOT NULL,
  status TEXT NOT NULL,
  evidence_refs TEXT[] NOT NULL DEFAULT '{}',
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accounting_tool_integrations (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id),
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  official_url TEXT NOT NULL,
  connector TEXT NOT NULL,
  data_objects TEXT[] NOT NULL,
  verification_controls TEXT[] NOT NULL,
  runtime_status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
