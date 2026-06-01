# AIDC Carbon Monitoring Methodology

This platform implements a site-and-grid monitoring boundary for AI data centers. It combines near-real-time activity data, lifecycle inventory, data center resource KPIs, hourly carbon-free electricity matching, and auditable digital MRV evidence.

## Accounting Standards

- Corporate inventory: GHG Protocol Corporate Standard and ISO 14064-1 compatible Scope 1, Scope 2, and Scope 3 separation.
- Scope 2: location-based and market-based results are always reported separately. Certificates, PPAs, and offsets never reduce the location-based physical grid metric.
- Product/lifecycle carbon: ISO 14040/14044 and ISO 14067 style lifecycle allocation for hardware and construction assets.
- Software carbon intensity: ISO/IEC 21031 / Green Software Foundation SCI formula, using location-based grid intensity and allocated embodied emissions.
- Data center KPIs: ISO/IEC 30134 style PUE, REF, and WUE, plus CUE as a carbon performance KPI.

## Core Formulas

- `PUE = facility_energy_kWh / IT_energy_kWh`
- `CUE = location_based_scope2_kgCO2e / IT_energy_kWh`
- `WUE = water_liters / IT_energy_kWh`
- `REF = renewable_energy_kWh / facility_energy_kWh`
- `SCI = (energy_kWh * location_grid_gCO2e_per_kWh + embodied_gCO2e) / functional_units`
- `24/7 CFE Score = sum(min(load_h, eligible_CFE_h)) / sum(load_h)`
- `Avoided emissions = sum(matched_CFE_h * marginal_emissions_h)`

## Cabinet / Server Layer Audit

The digital twin adds a physical allocation hierarchy:

`campus -> building -> room -> rack -> server`

Server-layer audit lines are calculated per interval:

- `server_energy_kWh = current_power_kW * interval_hours`
- `cooling_overhead_kWh = server_energy_kWh * (rack_pue_overhead_factor - 1)`
- `server_scope2_location_kg = (server_energy_kWh + cooling_overhead_kWh) * location_grid_factor`
- `server_scope2_market_kg = (server_energy_kWh + cooling_overhead_kWh) * market_grid_factor`
- `server_embodied_kg = server_embodied_kgCO2e / lca_lifetime_hours * interval_hours`

Rack, room, building, and campus totals are rollups of child audit lines. The allocation path must be evidence-backed: facility meter, room busway, rack PDU, server power, model geometry reference, and LCA record.

## Data Quality

Every calculated metric carries:

- `method_version`
- `data_quality_flag`
- `uncertainty_range`
- evidence references suitable for audit packaging

The API uses the following quality flags: `measured`, `estimated`, `contractual`, `substituted`, and `missing`.

## Decarbonization Logic

The optimizer recommends only physical or operational reduction levers:

- cooling digital twin and MPC setpoint optimization
- carbon-aware scheduling for deferrable workloads
- GPU utilization, batching, quantization, distillation, and cache optimization
- renewable procurement and storage portfolio improvements
- quota-aware dispatch constraints

Offsets are disclosed separately and do not reduce SCI, location-based Scope 2, CUE, or physical inventory totals.
