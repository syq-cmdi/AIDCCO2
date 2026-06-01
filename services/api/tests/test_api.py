from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_realtime_metrics_endpoint() -> None:
    response = client.get("/metrics/realtime")

    assert response.status_code == 200
    payload = response.json()
    assert payload["site_id"] == "aidc-sg-01"
    assert "pue" in payload["metrics"]
    assert payload["metrics"]["location_based_emissions_kg"]["method_version"] == "ghgp-scope2-location-v0.1"


def test_inventory_keeps_offsets_separate_from_inventory() -> None:
    response = client.get("/inventory?period=2026-06")

    assert response.status_code == 200
    payload = response.json()
    assert payload["offsets_retired_kg"] == 0
    assert payload["inventory_total_location_based_kg"] > payload["inventory_total_market_based_kg"]
    scopes = {record["scope"] for record in payload["records"]}
    assert "scope_2_location_based" in scopes
    assert "scope_2_market_based" in scopes


def test_matching_endpoint() -> None:
    response = client.post("/renewables/matching", json={"site_id": "aidc-sg-01"})

    assert response.status_code == 200
    payload = response.json()
    assert 0 < payload["cfe_score"] < 1
    assert payload["annual_match_ratio"] > 0
    assert payload["duplicate_certificate_ids"] == []


def test_quota_status_endpoint() -> None:
    response = client.get("/quota/status")

    assert response.status_code == 200
    payload = response.json()
    assert payload["quota_kg_co2e"] == 2_400_000
    assert payload["remaining_kg_co2e"] > 0


def test_evidence_package_endpoint() -> None:
    response = client.get("/evidence/packages/2026-06")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["inventory_hash"]) == 64
    assert "iso-14067-lca-v0.1" in payload["method_versions"]


def test_digital_twin_endpoint_returns_rack_and_server_hierarchy() -> None:
    response = client.get("/digital-twin/aidc-sg-01")

    assert response.status_code == 200
    payload = response.json()
    assert payload["rack_count"] == 12
    assert payload["server_count"] == 72
    assert payload["campus"]["buildings"][0]["rooms"][0]["racks"][0]["servers"]
    assert payload["aggregate_location_kg_per_hour"] > payload["aggregate_market_kg_per_hour"]
    assert any(source["name"] == "Rhino 8 / Grasshopper" for source in payload["model_sources"])


def test_digital_twin_endpoint_includes_envelope_mep_and_chip_layer() -> None:
    response = client.get("/digital-twin/aidc-sg-01")

    assert response.status_code == 200
    payload = response.json()
    first_server = payload["campus"]["buildings"][0]["rooms"][0]["racks"][0]["servers"][0]
    assert payload["chip_count"] == 1152
    assert len(first_server["chips"]) == 16
    assert len(payload["envelope_components"]) == 5
    assert len(payload["primary_cooling_system"]) == 6
    assert len(payload["electrical_metering_system"]) == 5
    assert payload["primary_cooling_system"][0]["loop"] == "primary_chilled_water"


def test_chip_simulation_endpoint_returns_chip_level_thermal_model() -> None:
    response = client.get(
        "/digital-twin/aidc-sg-01/chip-simulation"
        "?rack_id=sg-b1-hall-a-rack-A01&server_id=sg-b1-hall-a-rack-A01-srv-01"
    )

    assert response.status_code == 200
    payload = response.json()
    chip_types = {chip["chip_type"] for chip in payload["chips"]}
    assert payload["chip_count"] == 16
    assert payload["total_chip_power_kw"] > 0
    assert payload["max_hotspot_temp_c"] >= payload["max_junction_temp_c"]
    assert {"gpu", "cpu", "hbm"}.issubset(chip_types)


def test_server_layer_audit_endpoint_filters_to_server_lines() -> None:
    response = client.get("/carbon-audit/server-layer?site_id=aidc-sg-01&level=server")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 72
    first = payload[0]
    assert first["node_level"] == "server"
    assert first["allocation_path"][-1] == "server_power_kw"
    assert first["total_location_kg"] > first["embodied_kg"]


def test_server_layer_audit_all_includes_campus_building_room_rack_server() -> None:
    response = client.get("/carbon-audit/server-layer?site_id=aidc-sg-01&level=all")

    assert response.status_code == 200
    levels = {line["node_level"] for line in response.json()}
    assert {"campus", "building", "room", "rack", "server"}.issubset(levels)


def test_omniverse_fidelity_policy_exposes_rendering_and_accounting_controls() -> None:
    response = client.get("/photorealism/omniverse-policy/aidc-sg-01")

    assert response.status_code == 200
    payload = response.json()
    assert payload["usd_stage_uri"].endswith("campus_root.usd")
    assert any("Interactive Path Tracing" in mode for mode in payload["renderer_modes"])
    assert any(tool["name"] == "NVIDIA Omniverse Kit SDK" for tool in payload["tool_integrations"])
    assert any(gate["gate_id"] == "audit-reconcile" and gate["status"] == "pass" for gate in payload["quality_gates"])
    assert any(tool["name"] == "openLCA IPC" for tool in payload["accounting_integrations"])
