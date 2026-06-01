# Cabinet-Level Digital Twin Toolchain

The platform now treats the digital twin as an auditable carbon allocation graph:

`campus -> building -> room -> rack -> server -> chip`

Every model object can carry geometry references, telemetry evidence, LCA evidence, and method versions. The API exposes this via `GET /digital-twin/{site_id}`, `GET /digital-twin/{site_id}/chip-simulation`, and `GET /carbon-audit/server-layer`.

## Tool Roles

- Rhino 8 / Grasshopper: high-fidelity NURBS authoring, hot/cold aisle containment, MEP routing, CDU/cooling pipe geometry, and CFD-ready surfaces. Official download: <https://www.rhino3d.com/download/>
- Rhino.Compute: REST access to Rhino and Grasshopper SDKs for server-side geometry checks and parametric generation. Official docs: <https://developer.rhino3d.com/guides/compute/>
- rhino3dm: license-free OpenNURBS-based 3DM read/write library for JavaScript/Python services. Official overview: <https://www.rhino3d.com/features/developer/rhino3dm/>
- Speckle: model hub and connectors for Rhino, Grasshopper, Revit, Blender, IFC, and versioned design metadata. Official connectors: <https://docs.speckle.systems/connectors>
- IFC / open BIM: vendor-neutral model identity, object GUIDs, property sets, and long-lived audit references.
- Three.js: WebGL runtime used inside the dashboard for rack/server visualization, carbon heatmaps, and telemetry overlays.
- LAS/E57 point clouds: as-built verification for rack coordinates, aisle width, sensor positions, and confidence scoring.

## Integration Contract

Model ingestion should preserve:

- `site_id`, `building_id`, `room_id`, `rack_id`, `server_id`
- `chip_id`, `chip_type`, package material reference, and thermal sensor references when modeling below server level
- geometry reference URI, e.g. `rhino://...`, `speckle://...`, `ifc://...`, `glb://...`, `e57://...`
- source coordinate system and local BIM origin transform
- rack row/column and U-position mapping
- serial hash, asset tag, owner, workload pool, and current telemetry stream
- model version, connector version, export timestamp, and evidence checksum

## Carbon Audit Allocation

For each server and each audit interval:

- `energy_kwh = current_power_kw * interval_hours`
- `cooling_overhead_kwh = energy_kwh * (rack_pue_overhead_factor - 1)`
- `scope2_location_kg = (energy_kwh + cooling_overhead_kwh) * location_grid_factor`
- `scope2_market_kg = (energy_kwh + cooling_overhead_kwh) * market_grid_factor`
- `embodied_kg = server_embodied_kg_co2e / lca_lifetime_hours * interval_hours`

Rack, room, building, and campus totals are rollups of child lines. Offsets remain separate and never reduce server-layer physical totals.

## Envelope, MEP, And Chip Expansion

The platform now includes:

- `EnvelopeComponentTwin`: exterior wall, roof, containment, and raised-floor objects with U-value, leakage class, surface temperature, material reference, and embodied carbon.
- `CoolingEquipmentTwin`: primary chilled water, condenser water, secondary liquid, and airside equipment with power, load, flow, supply/return temperatures, differential pressure, COP, and status.
- `ElectricalEquipmentTwin`: utility meter, transformer, UPS, busway, and rack PDU with meter class, topology, real power, power factor, and losses.
- `ChipTwin`: GPU, CPU, HBM, DPU, and VRM package-level power, utilization, junction/hotspot temperature, coolant flow, thermal resistance, carbon rate, and NVML/Redfish evidence.

Persistence targets are `envelope_components`, `cooling_equipment`, `electrical_equipment`, and `twin_chips`.

## Local Runtime

Installed in this repo:

- `three`
- `@types/three`
- `rhino3dm`

Commercial Rhino desktop is not installed automatically because the official Rhino 8 download requires an evaluation or licensed account and the license terms must be accepted by the user. The platform records the official download URL and supports Rhino.Compute/Speckle integration once those services are configured.
