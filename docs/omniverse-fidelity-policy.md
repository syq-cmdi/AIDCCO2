# Omniverse-Grade Digital Twin And Carbon Accounting Policy

This platform treats "photoreal" as an auditable engineering target, not a cosmetic skin. The target is an OpenUSD-first digital twin that can be rendered in NVIDIA Omniverse/RTX for sign-off and streamed or downgraded to a browser PBR runtime for daily carbon operations.

Authoritative public tool references:

- NVIDIA Omniverse documentation: <https://docs.nvidia.com/omniverse/index.html>
- Omniverse USD Composer rendering modes: <https://docs.omniverse.nvidia.com/composer/latest/feature_rendering.html>
- OpenUSD: <https://openusd.org/>
- Rhino / Rhino.Compute: <https://developer.rhino3d.com/guides/compute/>
- Speckle connectors: <https://docs.speckle.systems/connectors>
- Three.js web runtime: <https://threejs.org/>

## Fidelity Tiers

- Tier 0: tabular carbon inventory with no spatial twin.
- Tier 1: rack/server hierarchy with WebGL boxes and telemetry overlays.
- Tier 2: measured rack positions, hot/cold aisles, envelope/MEP objects, PBR materials, and click-through server/chip audit.
- Tier 3: IFC/Rhino/Speckle-derived OpenUSD scene with stable prim paths, envelope/MEP/chip metadata, and material library hashes.
- Tier 4: Omniverse RTX Real-Time review and streamed Kit app for operations.
- Tier 5: RTX Interactive Path Tracing sign-off against the audited model version, calibrated HDRI/light levels, reference material chart, and point-cloud tolerance report.

The current repo implements Tier 2 in the browser and defines the Tier 3-5 contracts through `/photorealism/omniverse-policy/{site_id}`.

## Required OpenUSD Metadata

Every carbon-relevant prim must include:

- `aidc:siteId`
- `aidc:buildingId`
- `aidc:roomId`
- `aidc:rackId`
- `aidc:serverId` when applicable
- `aidc:chipId` and `aidc:chipType` when package-level thermal/power models are present
- `aidc:envelopeComponentId`, `aidc:coolingEquipmentId`, or `aidc:electricalEquipmentId` for MEP and envelope prims
- `aidc:assetId`
- `aidc:modelVersion`
- `aidc:materialLibraryHash`
- `aidc:telemetryStream`
- `aidc:lcaComponentId`
- `aidc:evidenceRefs`

The OpenUSD scene is authoritative for model identity and geometry lineage. The accounting engine remains authoritative for emissions, allocations, and reporting.

## Render Acceptance Gates

- Geometry: rack anchor error <= 20 mm, MEP routing error <= 50 mm against registered point cloud.
- Materials: calibrated metal, glass, floor tile, cable tray, containment, pipe, and server front-panel materials with library hash.
- MEP: primary chilled water, condenser water, secondary liquid, CRAH/airside, electrical meter, UPS, transformer, busway, and PDU objects must preserve topology IDs.
- Chips: GPU/CPU/HBM/DPU/VRM packages must bind power, temperature, coolant flow, and material references to the selected server model.
- Lighting: room light fixtures, exposure, color temperature, and HDRI/environment settings recorded in render metadata.
- Scale: camera walkthrough and rack selection must preserve 1:1 rack dimensions and aisle clearance.
- Identity: GLB/Web runtime must preserve pickable rack/server IDs even when using simplified geometry.
- Audit: RTX render package must reference the same model version used by `carbon_audit_lines`.

## Accounting Tool Integration

Carbon accounting integrations are explicit and testable:

- Corporate inventory: GHG Protocol / ISO 14064 style Scope 1/2/3 split.
- Scope 2: hourly load matching, EAC/PPA evidence, duplicate certificate checks, and separate location-based/market-based reporting.
- Software carbon: SCI/ISO IEC 21031 style functional unit rates using physical/location grid intensity.
- LCA: openLCA IPC for calculation automation and ecoinvent or supplier EPDs as licensed factor sources.
- Marginal emissions: Electricity Maps or WattTime style feeds for avoided-emissions analysis, kept separate from inventory.
- Evidence: hashed packages bind model, telemetry, LCA, certificates, and allocation lines.

## Implementation Contract

- API policy endpoint: `GET /photorealism/omniverse-policy/{site_id}`
- Digital twin endpoint: `GET /digital-twin/{site_id}`
- Chip simulation endpoint: `GET /digital-twin/{site_id}/chip-simulation`
- Server audit endpoint: `GET /carbon-audit/server-layer?level=all`
- Web scene: `apps/web/src/components/TwinScene.tsx`
- DB persistence targets: `photoreal_tool_integrations`, `photoreal_pipeline_stages`, `photoreal_quality_gates`, `accounting_tool_integrations`, `envelope_components`, `cooling_equipment`, `electrical_equipment`, and `twin_chips`

Omniverse, RTX Renderer, Kit App Streaming, and Rhino desktop are not silently installed because they require external services, GPUs, user accounts, or commercial licenses. The platform exposes official URLs, runtime status, and connector boundaries so installation and license acceptance are explicit.
