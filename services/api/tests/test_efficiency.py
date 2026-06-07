from __future__ import annotations

from fastapi.testclient import TestClient

from app.efficiency import (
    calculate_distributed_battery,
    calculate_global_energy_routing,
    calculate_optical_fabric,
    calculate_workload_scheduling,
)
from app.main import app
from app.sample_data import (
    BATTERY_ENERGY_KWH,
    BATTERY_MAX_DISCHARGE_KW,
    BATTERY_PER_SERVER_KW,
    BATTERY_POWER_BUDGET_KW,
    seed_battery_power_profile,
    seed_campus_twin,
    seed_global_energy_regions,
    seed_migration_jobs,
    seed_optical_links,
)

client = TestClient(app)


def _all_servers() -> list:
    campus = seed_campus_twin()
    return [server for building in campus.buildings for room in building.rooms for rack in room.racks for server in rack.servers]


# ---- Unit tests for the calculation engine ----


def test_workload_scheduling_saves_energy_and_protects_qos() -> None:
    result = calculate_workload_scheduling(_all_servers())

    assert result.servers_total == 72
    assert result.sla_servers + result.batch_servers == 72
    assert result.optimized_power_kw < result.baseline_power_kw
    assert 0 < result.energy_saving_pct < 1
    assert 0 < result.fleet_qos_ratio <= 1
    assert result.servers_parked > 0
    # the per-node consolidation gain reaches the order of the cited reference
    assert 0.5 < result.peak_node_efficiency_gain_pct < 0.95


def test_workload_scheduling_disabled_colocation_parks_nothing() -> None:
    result = calculate_workload_scheduling(_all_servers(), allow_colocation=False)

    assert result.servers_parked == 0
    assert result.energy_saving_pct <= 0.0001


def test_distributed_battery_frees_headroom_for_more_servers() -> None:
    result = calculate_distributed_battery(
        seed_battery_power_profile(),
        power_budget_kw=BATTERY_POWER_BUDGET_KW,
        battery_energy_kwh=BATTERY_ENERGY_KWH,
        max_discharge_kw=BATTERY_MAX_DISCHARGE_KW,
        per_server_kw=BATTERY_PER_SERVER_KW,
    )

    assert result.observed_peak_kw > result.power_budget_kw
    assert result.shaved_peak_kw <= result.observed_peak_kw
    assert result.extra_servers_distributed > result.extra_servers_centralized
    assert result.longest_peak_hours >= 1
    # distributed LFP unlocks roughly the cited extra-capacity headroom
    assert 0.18 < result.extra_capacity_pct < 0.30
    assert result.chemistry.startswith("LiFePO4")


def test_global_energy_routing_raises_green_coverage_and_cuts_interruptions() -> None:
    result = calculate_global_energy_routing(seed_global_energy_regions())

    assert result.green_coverage_after > result.green_coverage_before
    assert result.migrated_load_mw > 0
    assert result.job_interruptions_after < result.job_interruptions_before
    assert result.interruption_reduction_x > 1.5
    assert result.reference_interruption_reduction_x == 5.0


def test_optical_fabric_speeds_up_migration_versus_legacy_link() -> None:
    result = calculate_optical_fabric(seed_optical_links(), seed_migration_jobs())

    assert result.jobs_total == 4
    assert result.median_speedup_x >= 1.0
    assert result.aggregate_capacity_gbps >= 100
    assert result.energy_per_gb_optical_j < result.energy_per_gb_electrical_j
    assert all(load.utilization >= 0 for load in result.link_loads)


# ---- API endpoint tests ----


def test_workload_scheduling_endpoint() -> None:
    response = client.get("/efficiency/workload-scheduling")

    assert response.status_code == 200
    payload = response.json()
    assert payload["scheduler"].startswith("Improved Xen")
    assert payload["method_version"] == "xen-colocation-qos-scheduler-v0.1"
    assert payload["optimized_power_kw"] < payload["baseline_power_kw"]
    assert payload["reference_efficiency_gain_pct"] == 0.7


def test_thermal_management_endpoint_predicts_hotspots() -> None:
    response = client.get("/efficiency/thermal-management")

    assert response.status_code == 200
    payload = response.json()
    assert payload["chips_evaluated"] == 1152
    assert payload["predicted_max_hotspot_c"] >= payload["current_max_hotspot_c"]
    assert payload["optimized_cooling_kw"] < payload["baseline_cooling_kw"]
    assert len(payload["fan_zones"]) >= 1


def test_distributed_battery_endpoint() -> None:
    response = client.get("/efficiency/distributed-battery")

    assert response.status_code == 200
    payload = response.json()
    assert payload["reference_extra_capacity_pct"] == 0.24
    assert payload["extra_servers_distributed"] > payload["extra_servers_centralized"]
    assert any(window["covered_by_battery"] for window in payload["peak_windows"])


def test_global_energy_routing_endpoint() -> None:
    response = client.get("/efficiency/global-energy-routing")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["region_plans"]) == 4
    assert payload["green_coverage_after"] > payload["green_coverage_before"]


def test_optical_fabric_endpoint() -> None:
    response = client.get("/efficiency/optical-fabric")

    assert response.status_code == 200
    payload = response.json()
    assert payload["legacy_link_gbps"] == 10
    assert len(payload["migration_plans"]) == 4
    assert payload["median_speedup_x"] >= 1


def test_efficiency_summary_endpoint_covers_all_five_levers() -> None:
    response = client.get("/efficiency/summary")

    assert response.status_code == 200
    payload = response.json()
    levers = {lever["lever"] for lever in payload["levers"]}
    assert levers == {
        "workload_scheduling",
        "thermal_management",
        "distributed_battery",
        "global_energy_routing",
        "optical_fabric",
    }
    assert len(payload["cross_layer_insights"]) >= 3
