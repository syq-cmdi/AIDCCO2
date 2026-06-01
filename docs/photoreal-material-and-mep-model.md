# Photoreal Material, Envelope, MEP, and Chip Twin Contract

This platform uses a two-tier fidelity model:

- Browser operations view: Three.js PBR scene with textured anti-static floor tiles, wall panels, glass containment, cable trays, pipe loops, cooling equipment, electrical cabinets, rack/server telemetry overlays, and selected-server chip heatmap.
- Engineering sign-off view: OpenUSD/Omniverse source scene with MDL/OmniPBR material libraries, RTX Real-Time 2.0 operations mode, and RTX Interactive Path Tracing for visual QA.

## Toolchain Status

Rhino desktop and Omniverse RTX runtimes are license/runtime controlled and cannot be silently installed by this repo. The implementation records the official download and integration route, installs the open `rhino3dm` npm runtime for 3DM metadata handling, and exposes the following toolchain in `/digital-twin/{site_id}` and `/photorealism/omniverse-policy/{site_id}`:

- Rhino 8 / Grasshopper: high precision NURBS, containment, equipment clearance, pipe/cable routing, and CFD-ready surface authoring.
- Rhino.Compute: stateless REST access to Rhino/Grasshopper geometry services from platform jobs.
- Speckle: versioned model exchange for Rhino, Revit, Blender, Grasshopper, IFC, 3DM, E57, STEP, FBX, OBJ, PLY, and metadata.
- OpenUSD / Omniverse Kit: high-fidelity scene graph, carbon metadata schemas, RTX render QA, and WebRTC streaming when browser WebGL is not enough.
- Three.js: installed browser runtime for the in-platform operational view.

## Envelope Model

Each `EnvelopeComponentTwin` must bind geometry, material, thermal, leakage, LCA, and sensor evidence:

- `component_type`: exterior wall, roof, slab, raised floor, containment, fire door, vapor barrier, cable penetration, or acoustic panel.
- `area_m2`, `u_value_w_m2k`, `leakage_class`, `surface_temp_c`.
- `embodied_kg_co2e` from EPD/LCA evidence.
- `geometry_ref`, `material_ref`, `sensor_refs`, and BIM/point-cloud position.

The current seed model covers exterior wall, cool roof, hot aisle containment, cold aisle containment, and raised floor. These objects are persisted in `envelope_components`.

## Cooling and Electrical MEP Model

Primary cooling uses `CoolingEquipmentTwin` for water-cooled chiller, cooling tower, primary CHW pump, plate heat exchanger, CDU, and CRAH/airside equipment. Required telemetry fields are current power, cooling load, flow, supply/return temperatures, pressure differential, COP, status, and evidence references.

Electrical metering uses `ElectricalEquipmentTwin` for the revenue meter, transformer, UPS, busway, and rack PDU. Required telemetry fields are voltage, current, real power, power factor, loss, meter class, status, upstream topology, and evidence references.

Persistence tables:

- `cooling_equipment`
- `electrical_equipment`

These MEP records are separate from carbon allocation lines so an auditor can compare meter topology against server/rack allocation paths.

## Chip-Level Simulation

The platform adds a chip twin under every server:

- 8 GPU packages, 2 CPU packages, 4 HBM packages, 1 DPU, and 1 VRM array per seeded server.
- Power, utilization, junction temperature, hotspot temperature, coolant flow, thermal resistance, material reference, and NVML/Redfish sensor references.
- API: `GET /digital-twin/{site_id}/chip-simulation?rack_id=...&server_id=...`.

The initial solver is a reduced-order thermal network suitable for monitoring and anomaly triage. It is intentionally not a replacement for detailed CFD/FEA; production deployments should bind calibrated CFD/thermal solver outputs back to `ChipTwin` and keep the solver version as evidence.

## Photoreal QA Gates

- Geometry tolerance: rack anchors <= 20 mm, MEP routes <= 50 mm against point cloud.
- Materials: calibrated PBR/MDL library hash recorded for each audited period.
- Render sign-off: Omniverse RTX path-traced frame approved for the same model version used in carbon accounting.
- Audit truth: visual LOD never changes physical emissions, SCI, or Scope 2 location/market accounting.
