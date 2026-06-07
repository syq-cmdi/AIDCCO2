from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from .models import AccountingToolIntegration, BuildingTwin, CampusTwin, ChipTwin, CoolingEquipmentTwin, DataQualityFlag, DigitalTwinSource, ElectricalEquipmentTwin, EnergyCertificate, EnvelopeComponentTwin, GridCarbonIntensity, HourlyEnergy, LCAComponent, MeterReading, MeterStream, MigrationJob, OmniverseFidelityPolicyResponse, OpticalLink, PhotorealPipelineStage, PhotorealQualityGate, PhotorealToolIntegration, QuotaPolicy, RackTwin, RegionEnergyState, RoomTwin, ServerTwin, Site, TwinVector3, WorkloadClass


SITE = Site(
    id="aidc-sg-01",
    name="AIDC Singapore Hub 01",
    region="Singapore",
    grid_zone="SG",
    timezone="Asia/Singapore",
    design_power_mw=42,
    latitude=1.3521,
    longitude=103.8198,
)


def _base_time() -> datetime:
    return datetime.now(UTC).replace(minute=0, second=0, microsecond=0) - timedelta(hours=23)


HOURLY_LOAD = [920, 880, 850, 820, 835, 900, 1040, 1180, 1290, 1340, 1380, 1420, 1470, 1500, 1540, 1580, 1660, 1720, 1680, 1580, 1450, 1280, 1110, 980]
HOURLY_IT = [760, 728, 702, 680, 690, 744, 860, 976, 1067, 1110, 1140, 1174, 1214, 1240, 1273, 1306, 1372, 1421, 1388, 1306, 1198, 1058, 918, 810]
HOURLY_CFE = [340, 350, 360, 390, 460, 560, 690, 840, 1060, 1240, 1320, 1360, 1330, 1200, 1080, 940, 760, 580, 480, 420, 400, 380, 360, 350]
HOURLY_MARGINAL_CI = [0.52, 0.50, 0.49, 0.47, 0.44, 0.41, 0.39, 0.36, 0.31, 0.28, 0.25, 0.24, 0.25, 0.28, 0.32, 0.37, 0.44, 0.49, 0.53, 0.55, 0.57, 0.56, 0.54, 0.53]


def seed_meter_readings() -> list[MeterReading]:
    start = _base_time()
    readings: list[MeterReading] = []
    for index, facility_kwh in enumerate(HOURLY_LOAD):
        timestamp = start + timedelta(hours=index)
        it_kwh = HOURLY_IT[index]
        cooling_kwh = max(facility_kwh - it_kwh, 0) * 0.72
        readings.extend(
            [
                MeterReading(
                    timestamp=timestamp,
                    site_id=SITE.id,
                    stream=MeterStream.FACILITY_ENERGY,
                    value=facility_kwh,
                    unit="kWh",
                    source="dcim.main_meter",
                ),
                MeterReading(
                    timestamp=timestamp,
                    site_id=SITE.id,
                    stream=MeterStream.IT_ENERGY,
                    value=it_kwh,
                    unit="kWh",
                    source="pdu.white_space",
                ),
                MeterReading(
                    timestamp=timestamp,
                    site_id=SITE.id,
                    stream=MeterStream.COOLING_ENERGY,
                    value=cooling_kwh,
                    unit="kWh",
                    source="bms.chiller_group",
                ),
                MeterReading(
                    timestamp=timestamp,
                    site_id=SITE.id,
                    stream=MeterStream.WATER,
                    value=it_kwh * 0.31,
                    unit="L",
                    source="bms.water_meter",
                ),
                MeterReading(
                    timestamp=timestamp,
                    site_id=SITE.id,
                    stream=MeterStream.RENEWABLE_ENERGY,
                    value=HOURLY_CFE[index],
                    unit="kWh",
                    source="energytag.gc_registry",
                ),
            ]
        )
    return readings


def seed_grid_intensity() -> list[GridCarbonIntensity]:
    start = _base_time()
    return [
        GridCarbonIntensity(
            timestamp=start + timedelta(hours=index),
            grid_zone=SITE.grid_zone,
            average_kg_co2e_per_kwh=max(marginal - 0.11, 0.18),
            marginal_kg_co2e_per_kwh=marginal,
            source="electricity-maps-compatible-feed",
        )
        for index, marginal in enumerate(HOURLY_MARGINAL_CI)
    ]


def seed_hourly_energy() -> list[HourlyEnergy]:
    start = _base_time()
    return [
        HourlyEnergy(
            timestamp=start + timedelta(hours=index),
            load_kwh=load,
            eligible_cfe_kwh=HOURLY_CFE[index],
            marginal_emissions_kg_per_kwh=HOURLY_MARGINAL_CI[index],
            certificate_id=f"GC-SG-2026-06-{index:02d}",
        )
        for index, load in enumerate(HOURLY_LOAD)
    ]


def seed_lca_components() -> list[LCAComponent]:
    return [
        LCAComponent(
            component_id="gpu-cluster-h100-a",
            site_id=SITE.id,
            category="GPU servers",
            total_embodied_kg_co2e=9_200_000,
            expected_lifetime_hours=5 * 365 * 24,
            installed_at=date(2025, 1, 15),
            resource_total=4096,
        ),
        LCAComponent(
            component_id="network-spine-a",
            site_id=SITE.id,
            category="Network fabric",
            total_embodied_kg_co2e=580_000,
            expected_lifetime_hours=7 * 365 * 24,
            installed_at=date(2024, 9, 1),
            resource_total=1,
        ),
    ]


def seed_quota_policy() -> QuotaPolicy:
    return QuotaPolicy(
        policy_id="global-internal-netzero-2026",
        site_id=SITE.id,
        name="Internal science-based carbon budget",
        period_start=date(2026, 1, 1),
        period_end=date(2026, 12, 31),
        quota_kg_co2e=2_400_000,
        carbon_price_usd_per_tonne=82,
        rule_set="global-configurable-v0.1",
    )


def seed_certificates() -> list[EnergyCertificate]:
    start = _base_time()
    return [
        EnergyCertificate(
            certificate_id=f"GC-SG-2026-06-{index:02d}",
            site_id=SITE.id,
            energy_kwh=HOURLY_CFE[index],
            start_time=start + timedelta(hours=index),
            end_time=start + timedelta(hours=index + 1),
            technology="solar+storage" if 8 <= index <= 17 else "wind",
            grid_zone=SITE.grid_zone,
            issuer="EnergyTag-compatible registry",
            is_granular=True,
            retired_for_site_id=SITE.id,
        )
        for index in range(24)
    ]


def seed_digital_twin_sources() -> list[DigitalTwinSource]:
    return [
        DigitalTwinSource(
            name="Rhino 8 / Grasshopper",
            tool_type="commercial_cad",
            official_url="https://www.rhino3d.com/download/",
            connector="Rhino.Compute REST API + Grasshopper Hops",
            supported_formats=["3DM", "GH", "STEP", "IGES", "OBJ", "FBX", "glTF via export pipeline"],
            integration_status="optional_license_required",
            audit_role="High-fidelity geometry authoring, rack clearances, containment geometry, MEP routing, and CFD-ready surfaces.",
        ),
        DigitalTwinSource(
            name="Speckle",
            tool_type="model_hub",
            official_url="https://docs.speckle.systems/connectors",
            connector="Rhino / Grasshopper / Revit / Blender connectors + REST API",
            supported_formats=["IFC", "3DM", "RVT via connector", "OBJ", "PLY", "STL", "STEP", "FBX"],
            integration_status="open_source_ready",
            audit_role="Versioned model provenance, element metadata, design change lineage, and cross-tool synchronization.",
        ),
        DigitalTwinSource(
            name="IFC / buildingSMART open BIM",
            tool_type="open_bim",
            official_url="https://technical.buildingsmart.org/standards/ifc/",
            connector="IFC import/export, object GUID mapping, and property-set extraction",
            supported_formats=["IFC2x3", "IFC4", "IFC4x3"],
            integration_status="configured",
            audit_role="Vendor-neutral asset hierarchy from campus to rack/server rooms and MEP systems.",
        ),
        DigitalTwinSource(
            name="Three.js glTF runtime",
            tool_type="web_3d_engine",
            official_url="https://threejs.org/",
            connector="Browser WebGL scene with GLB/glTF loader and telemetry overlays",
            supported_formats=["GLB", "glTF", "KTX2", "Draco-compressed meshes"],
            integration_status="configured",
            audit_role="Interactive cabinet-level scene, carbon heat map, sensor overlays, and inspection UI.",
        ),
        DigitalTwinSource(
            name="LAS / E57 point cloud",
            tool_type="point_cloud",
            official_url="https://www.asprs.org/divisions-committees/lidar-division/laser-las-file-format-exchange-activities",
            connector="Point-cloud registration to BIM origin and rack/device fiducials",
            supported_formats=["LAS", "LAZ", "E57", "PLY"],
            integration_status="configured",
            audit_role="As-built verification, rack coordinates, aisle width checks, and sensor/device location confidence.",
        ),
    ]


def seed_omniverse_fidelity_policy() -> OmniverseFidelityPolicyResponse:
    return OmniverseFidelityPolicyResponse(
        site_id=SITE.id,
        generated_at=datetime.now(UTC),
        target_fidelity="Omniverse/OpenUSD photoreal operations twin: path-traced validation, real-time web operations, rack/server carbon audit parity.",
        usd_stage_uri="omniverse://aidc-sg-01/stages/campus_root.usd",
        web_runtime_uri="glb://aidc-sg-01/web-runtime/campus_lod2.glb",
        renderer_modes=[
            "Omniverse RTX Real-Time 2.0 for operations review",
            "Omniverse RTX Interactive Path Tracing for design sign-off",
            "Three.js PBR fallback for browser-native monitoring",
            "Offline still-frame QA with calibrated exposure and material reference chart",
        ],
        policy_principles=[
            "OpenUSD is the source-of-truth scene graph; glTF/GLB is a derived web runtime artifact.",
            "Every visible object that affects carbon allocation must carry asset_id, rack_id/server_id, material_id, model_version, and evidence_ref.",
            "Photorealism cannot override audit truth: visual LOD may simplify geometry, but carbon allocations always bind to measured telemetry and LCA records.",
            "Offsets, EACs, PPAs, and avoided emissions are separate disclosures and never reduce server-layer physical emissions.",
            "Path-traced render approvals require the same geometry version and material library hash used for the audited period.",
        ],
        tool_integrations=[
            PhotorealToolIntegration(
                name="NVIDIA Omniverse Kit SDK",
                category="usd_platform",
                official_url="https://docs.nvidia.com/omniverse/index.html",
                integration_role="Build the high-fidelity OpenUSD application shell, extensions, and data panels for AIDC digital twin operations.",
                connector="Kit SDK extension: aidc.carbon.audit + aidc.telemetry.overlay",
                runtime_status="requires_license",
                evidence_refs=["official://nvidia/omniverse-kit-sdk", "usd://aidc-sg-01/extensions/aidc.carbon.audit"],
            ),
            PhotorealToolIntegration(
                name="Omniverse RTX Renderer",
                category="rendering",
                official_url="https://docs.omniverse.nvidia.com/composer/latest/feature_rendering.html",
                integration_role="Real-Time 2.0 for live operations and Interactive Path Tracing for sign-off quality stills and QA.",
                connector="OpenUSD render settings + material QA extension",
                runtime_status="requires_license",
                evidence_refs=["render://rtx-realtime-2.0", "render://rtx-interactive-path-tracing"],
            ),
            PhotorealToolIntegration(
                name="OpenUSD Exchange SDK",
                category="asset_validation",
                official_url="https://docs.nvidia.com/omniverse/index.html",
                integration_role="Author consistent USD assets from IFC/Rhino/Speckle/CAE sources and enforce metadata schemas.",
                connector="USD I/O service: /usd/convert-and-validate",
                runtime_status="requires_external_service",
                evidence_refs=["usd://schema/AIDCAsset", "usd://schema/AIDCCarbonBinding"],
            ),
            PhotorealToolIntegration(
                name="Kit App Streaming / WebRTC",
                category="streaming",
                official_url="https://docs.nvidia.com/omniverse/index.html",
                integration_role="Stream RTX-rendered Kit applications to browser clients when local WebGL fidelity is insufficient.",
                connector="WebRTC stream URL embedded behind platform auth",
                runtime_status="requires_external_service",
                evidence_refs=["stream://kit-app/aidc-carbon-twin"],
            ),
            PhotorealToolIntegration(
                name="Three.js PBR Web Runtime",
                category="web_runtime",
                official_url="https://threejs.org/",
                integration_role="Native browser operator view with PBR cabinet scene, telemetry overlays, and click-through to server carbon audit.",
                connector="apps/web/src/components/TwinScene.tsx",
                runtime_status="installed",
                evidence_refs=["npm://three", "web://localhost:3000/#孪生"],
            ),
            PhotorealToolIntegration(
                name="Rhino 8 / Grasshopper / Rhino.Compute",
                category="model_authoring",
                official_url="https://developer.rhino3d.com/guides/compute/",
                integration_role="Author high precision NURBS geometry, containment, pipes, cable trays, and parametric rack layouts.",
                connector="Rhino.Compute REST + rhino3dm metadata extraction",
                runtime_status="requires_license",
                evidence_refs=["rhino://aidc-sg-01/campus/compute-building-1.3dm", "npm://rhino3dm"],
            ),
        ],
        pipeline_stages=[
            PhotorealPipelineStage(
                stage_id="capture-01",
                name="Reality capture and coordinate lock",
                owner="BIM / survey",
                input_formats=["E57", "LAS", "LAZ", "IFC", "RVT"],
                output_formats=["registered point cloud", "BIM origin transform", "as-built delta report"],
                acceptance_criteria=[
                    "Rack anchor residual <= 20 mm against point cloud fiducials",
                    "Room coordinate transform signed by BIM owner",
                    "Every rack has row, column, and geometry_ref",
                ],
                automation_endpoint="/digital-twin/{site_id}",
                status="ready",
            ),
            PhotorealPipelineStage(
                stage_id="usd-02",
                name="OpenUSD scene composition",
                owner="3D pipeline",
                input_formats=["3DM", "IFC", "FBX", "OBJ", "Speckle object graph"],
                output_formats=["USD", "USDA", "USDC", "USDZ"],
                acceptance_criteria=[
                    "Campus, building, room, rack, and server prim paths are stable",
                    "AIDC carbon schema fields are present on every rack and server prim",
                    "Material assignments use calibrated PBR library hashes",
                ],
                automation_endpoint="/photorealism/omniverse-policy/{site_id}",
                status="requires_license",
            ),
            PhotorealPipelineStage(
                stage_id="render-03",
                name="RTX render QA and web LOD derivation",
                owner="visualization",
                input_formats=["USD", "MDL", "EXR HDRI"],
                output_formats=["RTX QA frames", "GLB LOD2", "KTX2 textures"],
                acceptance_criteria=[
                    "Path-traced QA frame approved for rack aisle and material realism",
                    "Web GLB keeps node IDs for rack/server picking",
                    "Operations view loads within dashboard budget while preserving audit IDs",
                ],
                automation_endpoint="apps/web/src/components/TwinScene.tsx",
                status="ready",
            ),
            PhotorealPipelineStage(
                stage_id="audit-04",
                name="Carbon accounting binding",
                owner="carbon MRV",
                input_formats=["telemetry", "LCA/EPD", "EAC/PPA", "grid carbon intensity", "USD prim metadata"],
                output_formats=["server audit lines", "evidence package", "SCI rates"],
                acceptance_criteria=[
                    "Server-level physical emissions reconcile to rack, room, building, and campus rollups",
                    "Market-based instruments stay separate from physical emissions and SCI",
                    "Every allocation line has telemetry, model, and LCA evidence references",
                ],
                automation_endpoint="/carbon-audit/server-layer",
                status="ready",
            ),
        ],
        quality_gates=[
            PhotorealQualityGate(
                gate_id="geo-mm",
                name="As-built geometry tolerance",
                target="<= 20 mm rack anchor error; <= 50 mm MEP route error",
                current="20 mm simulated rack anchors; MEP route evidence configured",
                status="warning",
                evidence_refs=["pointcloud://aidc-sg-01/as-built/2026-05-hall-a.e57"],
            ),
            PhotorealQualityGate(
                gate_id="usd-schema",
                name="OpenUSD carbon metadata schema",
                target="All carbon-relevant prims carry stable IDs and evidence refs",
                current="Schema policy defined; web/runtime sample has rack/server IDs",
                status="pass",
                evidence_refs=["usd://schema/AIDCCarbonBinding", "api://digital-twin/aidc-sg-01"],
            ),
            PhotorealQualityGate(
                gate_id="rtx-signoff",
                name="RTX path-traced sign-off",
                target="Approved RTX Interactive Path Tracing render per audited model version",
                current="Requires Omniverse RTX runtime and licensed workstation/cloud streaming",
                status="blocked",
                evidence_refs=["official://nvidia/omniverse-rtx-renderer"],
            ),
            PhotorealQualityGate(
                gate_id="audit-reconcile",
                name="Server-to-campus carbon reconciliation",
                target="Absolute rollup delta <= 0.1%",
                current="API tests verify 72 server lines and campus/building/room/rack/server hierarchy",
                status="pass",
                evidence_refs=["test://services/api/tests/test_api.py"],
            ),
        ],
        accounting_integrations=[
            AccountingToolIntegration(
                name="GHG Protocol / ISO 14064 inventory",
                domain="corporate_inventory",
                official_url="https://ghgprotocol.org/corporate-standard",
                connector="Inventory export from emission_records and carbon_audit_lines",
                data_objects=["EmissionRecord", "CarbonAuditLine", "EvidencePackage"],
                verification_controls=["Scope 1/2/3 separation", "location and market based Scope 2 kept separate", "offsets disclosed separately"],
                runtime_status="configured",
            ),
            AccountingToolIntegration(
                name="GHG Protocol Scope 2 / Energy Attribute Certificates",
                domain="scope2_energy",
                official_url="https://ghgprotocol.org/scope-2-guidance",
                connector="/renewables/matching + certificate registry ingestion",
                data_objects=["EnergyCertificate", "PPAContract", "HourlyEnergy"],
                verification_controls=["Duplicate certificate detection", "hourly CFE score", "annual matching kept as disclosure"],
                runtime_status="configured",
            ),
            AccountingToolIntegration(
                name="Green Software Foundation SCI / ISO IEC 21031",
                domain="software_carbon_intensity",
                official_url="https://greensoftware.foundation/standards/sci/",
                connector="SCI functional unit rates from AIWorkloadRun and server audit lines",
                data_objects=["AIWorkloadRun", "ServerTwin", "CarbonAuditLine"],
                verification_controls=["SCI uses physical/location grid intensity", "market instruments do not lower SCI", "functional unit recorded"],
                runtime_status="configured",
            ),
            AccountingToolIntegration(
                name="openLCA IPC",
                domain="lifecycle_assessment",
                official_url="https://pypi.org/project/openlca-ipc/",
                connector="openLCA IPC job to calculate server/GPU/building component LCA and return component factors",
                data_objects=["LCAComponent", "ServerTwin", "Asset"],
                verification_controls=["LCA database/version stored", "allocation basis stored", "uncertainty retained"],
                runtime_status="planned",
            ),
            AccountingToolIntegration(
                name="ecoinvent",
                domain="lifecycle_assessment",
                official_url="https://ecoinvent.org/database/",
                connector="Licensed background database for GPU/server/material supply-chain factors",
                data_objects=["LCAComponent", "EmissionFactor"],
                verification_controls=["Database version and system model referenced", "license-controlled data not redistributed"],
                runtime_status="requires_license",
            ),
            AccountingToolIntegration(
                name="Electricity Maps / marginal emissions API",
                domain="marginal_emissions",
                official_url="https://app.electricitymaps.com/developer-hub/api/getting-started",
                connector="GridCarbonIntensity feed for average and marginal emissions",
                data_objects=["GridCarbonIntensity", "HourlyEnergy"],
                verification_controls=["Time zone aligned hourly records", "source timestamp stored", "marginal avoided emissions separate from inventory"],
                runtime_status="requires_api_key",
            ),
        ],
    )


def _chips_for_server(server_id: str, rack_index: int, slot_index: int, server_power_kw: float, base_position: TwinVector3) -> list[ChipTwin]:
    total_power_w = server_power_kw * 1000
    chip_specs = [
        *[(f"GPU-{idx + 1}", "gpu", "HBM GPU SXM module", 820, 700, 0.088) for idx in range(8)],
        ("CPU-1", "cpu", "server CPU package", 620, 360, 0.07),
        ("CPU-2", "cpu", "server CPU package", 620, 360, 0.07),
        *[(f"HBM-{idx + 1}", "hbm", "stacked memory package", 92, 55, 0.025) for idx in range(4)],
        ("DPU-1", "dpu", "network acceleration package", 180, 110, 0.023),
        ("VRM-1", "vrm", "power stage array", 260, 140, 0.033),
    ]
    chips: list[ChipTwin] = []
    for index, (name, chip_type, package, die_area, tdp, share) in enumerate(chip_specs):
        current_power = round(total_power_w * share, 3)
        utilization = min(0.36 + slot_index * 0.055 + (rack_index % 5) * 0.025 + (index % 4) * 0.018, 0.98)
        thermal_resistance = 0.045 if chip_type == "gpu" else 0.061 if chip_type == "cpu" else 0.082
        junction = 41 + utilization * 28 + (current_power / max(tdp, 1)) * 16
        hotspot = junction + (6.5 if chip_type == "gpu" else 4.2)
        chips.append(
            ChipTwin(
                id=f"{server_id}-chip-{name.lower()}",
                server_id=server_id,
                name=name,
                chip_type=chip_type,  # type: ignore[arg-type]
                package=package,
                die_area_mm2=die_area,
                tdp_w=tdp,
                current_power_w=current_power,
                utilization=round(utilization, 3),
                junction_temp_c=round(junction, 2),
                hotspot_temp_c=round(hotspot, 2),
                coolant_flow_lpm=round(0.42 + current_power / 1250, 3) if chip_type in {"gpu", "cpu"} else 0,
                thermal_resistance_c_per_w=thermal_resistance,
                carbon_kg_co2e_per_hour=round((current_power / 1000) * 0.316, 6),
                material_ref=f"mdl://aidc/materials/chip/{chip_type}-black-ceramic-gold-pins",
                sensor_refs=[
                    f"redfish://server/{server_id}/thermal/{name}",
                    f"nvml://server/{server_id}/power/{name}",
                ],
                position=TwinVector3(
                    x=base_position.x + ((index % 4) - 1.5) * 0.12,
                    y=base_position.y + 0.22 + slot_index * 0.16,
                    z=base_position.z + (index // 4) * 0.07,
                ),
            )
        )
    return chips


def _server_for_rack(rack_id: str, rack_index: int, slot_index: int, base_position: TwinVector3) -> ServerTwin:
    current_power = 1.35 + (slot_index * 0.18) + ((rack_index % 4) * 0.11)
    inlet = 21.5 + (rack_index % 3) * 0.7 + slot_index * 0.18
    server_id = f"{rack_id}-srv-{slot_index + 1:02d}"
    return ServerTwin(
        id=server_id,
        rack_id=rack_id,
        name=f"GPU node {rack_index + 1:02d}-{slot_index + 1:02d}",
        u_position=2 + slot_index * 6,
        height_u=4,
        model="8xGPU liquid-ready server",
        serial_hash=f"sha256:{rack_index:02d}{slot_index:02d}b75f",
        owner="foundation-model-platform" if slot_index % 2 == 0 else "inference-service",
        workload_pool="training" if slot_index % 2 == 0 else "inference",
        rated_power_kw=3.2,
        current_power_kw=round(current_power, 3),
        gpu_count=8,
        cpu_count=2,
        inlet_temp_c=round(inlet, 2),
        outlet_temp_c=round(inlet + 9.5 + slot_index * 0.4, 2),
        utilization=round(min(0.42 + slot_index * 0.07 + (rack_index % 4) * 0.03, 0.94), 3),
        embodied_kg_co2e=13_800 + rack_index * 120 + slot_index * 80,
        lca_lifetime_hours=5 * 365 * 24,
        telemetry_quality=DataQualityFlag.MEASURED if slot_index < 5 else DataQualityFlag.ESTIMATED,
        position=TwinVector3(
            x=base_position.x,
            y=base_position.y + 0.15 + slot_index * 0.16,
            z=base_position.z,
        ),
        chips=_chips_for_server(server_id, rack_index, slot_index, round(current_power, 3), base_position),
    )


def _rack(room_id: str, rack_index: int, row: str, column: int, x: float, z: float) -> RackTwin:
    rack_id = f"{room_id}-rack-{row}{column:02d}"
    position = TwinVector3(x=x, y=0, z=z)
    servers = [_server_for_rack(rack_id, rack_index, slot_index, position) for slot_index in range(6)]
    current_kw = sum(server.current_power_kw for server in servers)
    pue_overhead = 1.14 + (rack_index % 3) * 0.025
    return RackTwin(
        id=rack_id,
        room_id=room_id,
        name=f"Rack {row}{column:02d}",
        row=row,
        column=column,
        height_u=42,
        design_kw=22.0,
        current_kw=round(current_kw, 3),
        inlet_temp_c=round(sum(server.inlet_temp_c for server in servers) / len(servers), 2),
        outlet_temp_c=round(sum(server.outlet_temp_c for server in servers) / len(servers), 2),
        pressure_pa=round(18 + (rack_index % 5) * 2.8, 1),
        pue_overhead_factor=round(pue_overhead, 3),
        carbon_kg_co2e_per_hour=round(current_kw * pue_overhead * 0.316, 3),
        geometry_ref=f"speckle://aidc-sg-01/{room_id}/{rack_id}",
        position=position,
        rotation_deg=0 if row in {"A", "C"} else 180,
        servers=servers,
    )


def seed_campus_twin() -> CampusTwin:
    room_a = RoomTwin(
        id="sg-b1-hall-a",
        building_id="sg-b1",
        name="AI Hall A",
        floor="L2",
        cooling_topology="hot_aisle_containment",
        geometry_ref="ifc://aidc-sg-01/building-1/hall-a.ifc#IfcSpace/AI-HALL-A",
        point_cloud_ref="e57://aidc-sg-01/as-built/2026-05-hall-a.e57",
        racks=[
            _rack("sg-b1-hall-a", 0, "A", 1, -5.4, -2.4),
            _rack("sg-b1-hall-a", 1, "A", 2, -3.6, -2.4),
            _rack("sg-b1-hall-a", 2, "A", 3, -1.8, -2.4),
            _rack("sg-b1-hall-a", 3, "B", 1, -5.4, 0.2),
            _rack("sg-b1-hall-a", 4, "B", 2, -3.6, 0.2),
            _rack("sg-b1-hall-a", 5, "B", 3, -1.8, 0.2),
        ],
    )
    room_b = RoomTwin(
        id="sg-b1-hall-b",
        building_id="sg-b1",
        name="AI Hall B",
        floor="L2",
        cooling_topology="liquid_cooling_hybrid",
        geometry_ref="ifc://aidc-sg-01/building-1/hall-b.ifc#IfcSpace/AI-HALL-B",
        point_cloud_ref="las://aidc-sg-01/as-built/2026-05-hall-b.laz",
        racks=[
            _rack("sg-b1-hall-b", 6, "C", 1, 1.8, -2.4),
            _rack("sg-b1-hall-b", 7, "C", 2, 3.6, -2.4),
            _rack("sg-b1-hall-b", 8, "C", 3, 5.4, -2.4),
            _rack("sg-b1-hall-b", 9, "D", 1, 1.8, 0.2),
            _rack("sg-b1-hall-b", 10, "D", 2, 3.6, 0.2),
            _rack("sg-b1-hall-b", 11, "D", 3, 5.4, 0.2),
        ],
    )
    return CampusTwin(
        site_id=SITE.id,
        name="AIDC Singapore Digital Twin",
        coordinate_system="EPSG:3414 + local BIM origin",
        buildings=[
            BuildingTwin(
                id="sg-b1",
                site_id=SITE.id,
                name="Compute Building 1",
                geometry_ref="rhino://aidc-sg-01/campus/compute-building-1.3dm",
                rooms=[room_a, room_b],
            )
        ],
    )


def seed_envelope_components() -> list[EnvelopeComponentTwin]:
    return [
        EnvelopeComponentTwin(
            id="env-b1-exterior-wall-north",
            building_id="sg-b1",
            room_id=None,
            component_type="exterior_wall",
            material="precast concrete + vapor barrier + insulated metal panel",
            area_m2=1180,
            u_value_w_m2k=0.38,
            leakage_class="EN 12207 class 4 equivalent",
            embodied_kg_co2e=412_000,
            surface_temp_c=27.4,
            geometry_ref="usd://aidc-sg-01/envelope/exterior_wall_north",
            material_ref="mdl://aidc/materials/envelope/brushed-insulated-metal-panel",
            sensor_refs=["bms://envelope/north-wall/surface-temp", "pointcloud://scan/envelope/north-wall"],
            position=TwinVector3(x=0, y=1.7, z=-5.25),
        ),
        EnvelopeComponentTwin(
            id="env-b1-roof-white-membrane",
            building_id="sg-b1",
            room_id=None,
            component_type="roof",
            material="cool roof membrane + PIR insulation + steel deck",
            area_m2=1640,
            u_value_w_m2k=0.24,
            leakage_class="sealed roof penetration register",
            embodied_kg_co2e=356_000,
            surface_temp_c=31.8,
            geometry_ref="usd://aidc-sg-01/envelope/roof_white_membrane",
            material_ref="mdl://aidc/materials/envelope/slightly-rough-white-roof",
            sensor_refs=["bms://roof/solar-temp", "weather://site/global-horizontal-irradiance"],
            position=TwinVector3(x=0, y=3.25, z=-1.1),
        ),
        EnvelopeComponentTwin(
            id="env-hall-a-hot-aisle-containment",
            building_id="sg-b1",
            room_id="sg-b1-hall-a",
            component_type="hot_aisle_containment",
            material="low-iron glass panels + anodized aluminum frame",
            area_m2=142,
            u_value_w_m2k=5.6,
            leakage_class="containment leakage <= 3%",
            embodied_kg_co2e=18_200,
            surface_temp_c=33.2,
            geometry_ref="usd://aidc-sg-01/envelope/hall-a-hot-aisle-containment",
            material_ref="mdl://aidc/materials/envelope/clear-tempered-glass-aluminum-frame",
            sensor_refs=["bms://hall-a/hot-aisle/differential-pressure", "bms://hall-a/hot-aisle/temp"],
            position=TwinVector3(x=-3.6, y=1.35, z=0.2),
        ),
        EnvelopeComponentTwin(
            id="env-hall-b-liquid-row-cold-aisle",
            building_id="sg-b1",
            room_id="sg-b1-hall-b",
            component_type="cold_aisle_containment",
            material="polycarbonate roof panels + steel doors",
            area_m2=136,
            u_value_w_m2k=4.8,
            leakage_class="containment leakage <= 2.5%",
            embodied_kg_co2e=16_900,
            surface_temp_c=22.6,
            geometry_ref="usd://aidc-sg-01/envelope/hall-b-cold-aisle-containment",
            material_ref="mdl://aidc/materials/envelope/translucent-polycarbonate",
            sensor_refs=["bms://hall-b/cold-aisle/differential-pressure", "bms://hall-b/cold-aisle/temp"],
            position=TwinVector3(x=3.6, y=1.35, z=-2.4),
        ),
        EnvelopeComponentTwin(
            id="env-b1-raised-floor",
            building_id="sg-b1",
            room_id=None,
            component_type="raised_floor",
            material="anti-static perforated steel tiles on pedestal grid",
            area_m2=1320,
            u_value_w_m2k=1.9,
            leakage_class="tile leakage measured by commissioning balance",
            embodied_kg_co2e=221_000,
            surface_temp_c=20.8,
            geometry_ref="usd://aidc-sg-01/envelope/raised_floor",
            material_ref="mdl://aidc/materials/floor/perforated-anti-static-steel-tile",
            sensor_refs=["bms://floor/plenum/static-pressure", "pointcloud://scan/raised-floor-grid"],
            position=TwinVector3(x=0, y=0, z=-1.1),
        ),
    ]


def seed_primary_cooling_system() -> list[CoolingEquipmentTwin]:
    return [
        CoolingEquipmentTwin(
            id="chw-chiller-01",
            building_id="sg-b1",
            equipment_type="water_cooled_chiller",
            loop="primary_chilled_water",
            name="Primary chiller 01",
            current_kw=148,
            cooling_load_kw=830,
            flow_lps=42.5,
            supply_temp_c=16.0,
            return_temp_c=21.4,
            delta_p_kpa=94,
            cop=5.61,
            status="running",
            geometry_ref="usd://aidc-sg-01/cooling/chiller-01",
            sensor_refs=["bms://chiller-01/power", "bms://chiller-01/chw-supply", "bms://chiller-01/chw-return"],
            position=TwinVector3(x=-7.1, y=0.8, z=2.7),
        ),
        CoolingEquipmentTwin(
            id="chw-pump-p01",
            building_id="sg-b1",
            equipment_type="primary_chilled_water_pump",
            loop="primary_chilled_water",
            name="Primary CHW pump P01",
            current_kw=18.4,
            cooling_load_kw=830,
            flow_lps=42.5,
            supply_temp_c=16.0,
            return_temp_c=21.4,
            delta_p_kpa=118,
            cop=None,
            status="running",
            geometry_ref="usd://aidc-sg-01/cooling/chw-pump-p01",
            sensor_refs=["bms://chw-pump-p01/vfd", "bms://chw-pump-p01/dp"],
            position=TwinVector3(x=-6.0, y=0.45, z=2.4),
        ),
        CoolingEquipmentTwin(
            id="ct-01",
            building_id="sg-b1",
            equipment_type="cooling_tower",
            loop="condenser_water",
            name="Cooling tower 01",
            current_kw=22.6,
            cooling_load_kw=978,
            flow_lps=48.1,
            supply_temp_c=29.4,
            return_temp_c=34.9,
            delta_p_kpa=66,
            cop=None,
            status="running",
            geometry_ref="usd://aidc-sg-01/cooling/cooling-tower-01",
            sensor_refs=["bms://ct-01/fan-power", "bms://ct-01/cw-supply", "bms://ct-01/cw-return"],
            position=TwinVector3(x=-7.2, y=2.1, z=-4.8),
        ),
        CoolingEquipmentTwin(
            id="phx-01",
            building_id="sg-b1",
            equipment_type="plate_heat_exchanger",
            loop="secondary_liquid",
            name="Liquid cooling plate heat exchanger 01",
            current_kw=3.2,
            cooling_load_kw=420,
            flow_lps=28.0,
            supply_temp_c=28.0,
            return_temp_c=34.0,
            delta_p_kpa=52,
            cop=None,
            status="running",
            geometry_ref="usd://aidc-sg-01/cooling/plate-heat-exchanger-01",
            sensor_refs=["bms://phx-01/secondary-flow", "bms://phx-01/approach-temp"],
            position=TwinVector3(x=6.8, y=0.7, z=2.6),
        ),
        CoolingEquipmentTwin(
            id="cdu-row-c01",
            building_id="sg-b1",
            equipment_type="cdu",
            loop="secondary_liquid",
            name="CDU row C01",
            current_kw=6.7,
            cooling_load_kw=310,
            flow_lps=20.5,
            supply_temp_c=28.2,
            return_temp_c=35.1,
            delta_p_kpa=72,
            cop=None,
            status="running",
            geometry_ref="usd://aidc-sg-01/cooling/cdu-row-c01",
            sensor_refs=["bms://cdu-row-c01/pump-power", "bms://cdu-row-c01/leak-detection"],
            position=TwinVector3(x=6.5, y=0.75, z=1.6),
        ),
        CoolingEquipmentTwin(
            id="crah-a01",
            building_id="sg-b1",
            equipment_type="crah",
            loop="airside",
            name="CRAH A01",
            current_kw=14.2,
            cooling_load_kw=260,
            flow_lps=0,
            supply_temp_c=19.5,
            return_temp_c=31.8,
            delta_p_kpa=0.8,
            cop=None,
            status="running",
            geometry_ref="usd://aidc-sg-01/cooling/crah-a01",
            sensor_refs=["bms://crah-a01/fan-power", "bms://crah-a01/discharge-air"],
            position=TwinVector3(x=-7.0, y=0.9, z=-1.3),
        ),
    ]


def seed_electrical_metering_system() -> list[ElectricalEquipmentTwin]:
    return [
        ElectricalEquipmentTwin(
            id="util-meter-01",
            building_id="sg-b1",
            equipment_type="revenue_meter",
            name="Utility revenue meter 01",
            upstream_id=None,
            voltage_v=22000,
            current_a=1020,
            real_power_kw=31_800,
            power_factor=0.97,
            loss_kw=0,
            meter_class="0.2S",
            status="energized",
            geometry_ref="usd://aidc-sg-01/electrical/utility-meter-01",
            sensor_refs=["meter://utility/revenue-01/kwh", "meter://utility/revenue-01/pq"],
            position=TwinVector3(x=7.4, y=1.1, z=-4.7),
        ),
        ElectricalEquipmentTwin(
            id="tx-01",
            building_id="sg-b1",
            equipment_type="transformer",
            name="22kV/415V transformer 01",
            upstream_id="util-meter-01",
            voltage_v=415,
            current_a=3820,
            real_power_kw=2450,
            power_factor=0.96,
            loss_kw=24.5,
            meter_class="IEC 60076 loss model",
            status="energized",
            geometry_ref="usd://aidc-sg-01/electrical/transformer-01",
            sensor_refs=["meter://tx-01/load", "thermal://tx-01/oil-temp"],
            position=TwinVector3(x=7.1, y=0.8, z=-3.7),
        ),
        ElectricalEquipmentTwin(
            id="ups-a",
            building_id="sg-b1",
            equipment_type="ups",
            name="UPS block A",
            upstream_id="tx-01",
            voltage_v=415,
            current_a=1860,
            real_power_kw=1180,
            power_factor=0.98,
            loss_kw=31.4,
            meter_class="IEC 62040 metered efficiency",
            status="energized",
            geometry_ref="usd://aidc-sg-01/electrical/ups-a",
            sensor_refs=["meter://ups-a/input", "meter://ups-a/output", "bms://ups-a/battery-soc"],
            position=TwinVector3(x=7.0, y=0.9, z=-2.6),
        ),
        ElectricalEquipmentTwin(
            id="busway-hall-a",
            building_id="sg-b1",
            equipment_type="busway",
            name="Hall A overhead busway",
            upstream_id="ups-a",
            voltage_v=415,
            current_a=720,
            real_power_kw=455,
            power_factor=0.99,
            loss_kw=4.1,
            meter_class="branch meter 0.5S",
            status="energized",
            geometry_ref="usd://aidc-sg-01/electrical/busway-hall-a",
            sensor_refs=["meter://busway-hall-a/kwh", "thermal://busway-hall-a/joints"],
            position=TwinVector3(x=-3.6, y=2.65, z=-1.1),
        ),
        ElectricalEquipmentTwin(
            id="pdu-rack-a01",
            building_id="sg-b1",
            equipment_type="pdu",
            name="Rack A01 intelligent PDU",
            upstream_id="busway-hall-a",
            voltage_v=415,
            current_a=24,
            real_power_kw=9.97,
            power_factor=0.99,
            loss_kw=0.08,
            meter_class="outlet metering 1%",
            status="energized",
            geometry_ref="usd://aidc-sg-01/electrical/pdu-rack-a01",
            sensor_refs=["pdu://rack-a01/kwh", "pdu://rack-a01/outlet-current"],
            position=TwinVector3(x=-5.4, y=1.4, z=-1.7),
        ),
    ]


# --------------------------------------------------------------------------
# Cross-layer energy-efficiency seed inputs
# --------------------------------------------------------------------------

# Distributed server-level LiFePO4 UPS peak-shaving scenario. The facility load
# stays under the grid power budget except for a multi-hour afternoon peak that
# distributed batteries shave (a central UPS could only ride through minutes).
BATTERY_POWER_BUDGET_KW = 12_500.0
BATTERY_ENERGY_KWH = 9_000.0
BATTERY_MAX_DISCHARGE_KW = 3_200.0
BATTERY_PER_SERVER_KW = 3.2
BATTERY_CENTRALIZED_RIDETHROUGH_MIN = 8.0
BATTERY_POWER_PROFILE_KW = [
    9_000, 8_600, 8_300, 8_100, 8_200, 8_800,
    9_800, 10_800, 11_600, 12_100, 12_400, 12_200,
    13_500, 14_000, 13_800, 12_300, 11_800, 11_200,
    10_500, 9_800, 9_200, 8_800, 8_400, 8_000,
]


def seed_battery_power_profile() -> list[float]:
    return [float(value) for value in BATTERY_POWER_PROFILE_KW]


def seed_global_energy_regions() -> list[RegionEnergyState]:
    return [
        RegionEnergyState(
            site_id="aidc-sg-01",
            region="Singapore",
            load_mw=12.0,
            green_forecast_mw=4.0,
            grid_ci_kg_per_kwh=0.41,
            latency_class="regional",
            deferrable_fraction=0.5,
        ),
        RegionEnergyState(
            site_id="aidc-usw-01",
            region="US West (solar)",
            load_mw=8.0,
            green_forecast_mw=12.0,
            grid_ci_kg_per_kwh=0.22,
            latency_class="global",
            deferrable_fraction=0.5,
        ),
        RegionEnergyState(
            site_id="aidc-eun-01",
            region="EU North (wind)",
            load_mw=9.0,
            green_forecast_mw=13.0,
            grid_ci_kg_per_kwh=0.16,
            latency_class="global",
            deferrable_fraction=0.45,
        ),
        RegionEnergyState(
            site_id="aidc-use-01",
            region="US East",
            load_mw=11.0,
            green_forecast_mw=6.0,
            grid_ci_kg_per_kwh=0.34,
            latency_class="regional",
            deferrable_fraction=0.4,
        ),
    ]


def seed_optical_links() -> list[OpticalLink]:
    return [
        OpticalLink(
            link_id="spine-100g",
            scope="intra_dc",
            endpoint_a="sg-b1-hall-a",
            endpoint_b="sg-b1-hall-b",
            capacity_gbps=100.0,
            distance_km=0.3,
            wavelengths=4,
        ),
        OpticalLink(
            link_id="leaf-40g",
            scope="intra_dc",
            endpoint_a="sg-b1-hall-b-row-c",
            endpoint_b="sg-b1-hall-b-cdu",
            capacity_gbps=40.0,
            distance_km=0.1,
            wavelengths=1,
        ),
        OpticalLink(
            link_id="dwdm-sg-eu",
            scope="inter_region",
            endpoint_a="aidc-sg-01",
            endpoint_b="aidc-eun-01",
            capacity_gbps=400.0,
            distance_km=9_500.0,
            wavelengths=8,
        ),
        OpticalLink(
            link_id="coherent-sg-us",
            scope="inter_region",
            endpoint_a="aidc-sg-01",
            endpoint_b="aidc-usw-01",
            capacity_gbps=100.0,
            distance_km=15_000.0,
            wavelengths=4,
        ),
    ]


def seed_migration_jobs() -> list[MigrationJob]:
    return [
        MigrationJob(
            job_id="checkpoint-flush",
            source="sg-b1-hall-a",
            target="sg-b1-hall-b",
            data_gb=8_000.0,
            deadline_s=1_800.0,
            priority=WorkloadClass.BATCH,
        ),
        MigrationJob(
            job_id="live-state-mirror",
            source="sg-b1-hall-a",
            target="sg-b1-hall-b",
            data_gb=150.0,
            deadline_s=30.0,
            priority=WorkloadClass.SLA_SENSITIVE,
        ),
        MigrationJob(
            job_id="model-shard-sync",
            source="aidc-sg-01",
            target="aidc-eun-01",
            data_gb=30_000.0,
            deadline_s=1_800.0,
            priority=WorkloadClass.BATCH,
        ),
        MigrationJob(
            job_id="dataset-replicate",
            source="aidc-sg-01",
            target="aidc-usw-01",
            data_gb=50_000.0,
            deadline_s=5_000.0,
            priority=WorkloadClass.BATCH,
        ),
    ]
