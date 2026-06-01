from __future__ import annotations

from datetime import UTC, date, datetime

import pytest

from app.calculations import (
    CalculationError,
    allocate_embodied_component,
    calculate_cfe_matching,
    calculate_quota_status,
    calculate_realtime_metrics,
    calculate_sci,
)
from app.models import HourlyEnergy, LCAComponent, MeterReading, MeterStream


def test_realtime_metrics_scope2_kpis_are_separate() -> None:
    readings = [
        MeterReading(
            timestamp=datetime(2026, 6, 1, tzinfo=UTC),
            site_id="site-1",
            stream=MeterStream.FACILITY_ENERGY,
            value=120,
            unit="kWh",
            source="meter",
        ),
        MeterReading(
            timestamp=datetime(2026, 6, 1, tzinfo=UTC),
            site_id="site-1",
            stream=MeterStream.IT_ENERGY,
            value=100,
            unit="kWh",
            source="pdu",
        ),
        MeterReading(
            timestamp=datetime(2026, 6, 1, tzinfo=UTC),
            site_id="site-1",
            stream=MeterStream.COOLING_ENERGY,
            value=12,
            unit="kWh",
            source="bms",
        ),
        MeterReading(
            timestamp=datetime(2026, 6, 1, tzinfo=UTC),
            site_id="site-1",
            stream=MeterStream.WATER,
            value=30,
            unit="L",
            source="water",
        ),
        MeterReading(
            timestamp=datetime(2026, 6, 1, tzinfo=UTC),
            site_id="site-1",
            stream=MeterStream.RENEWABLE_ENERGY,
            value=72,
            unit="kWh",
            source="gc",
        ),
    ]

    metrics = calculate_realtime_metrics(readings, average_grid_kg_per_kwh=0.5, market_based_kg_per_kwh=0.2)

    assert metrics["pue"].value == pytest.approx(1.2)
    assert metrics["cue"].value == pytest.approx(0.6)
    assert metrics["wue"].value == pytest.approx(0.3)
    assert metrics["ref"].value == pytest.approx(0.6)
    assert metrics["location_based_emissions_kg"].value == pytest.approx(60)
    assert metrics["market_based_emissions_kg"].value == pytest.approx(24)


def test_cfe_matching_detects_duplicate_certificates_and_does_not_double_count() -> None:
    hourly = [
        HourlyEnergy(
            timestamp=datetime(2026, 6, 1, 0, tzinfo=UTC),
            load_kwh=100,
            eligible_cfe_kwh=80,
            marginal_emissions_kg_per_kwh=0.5,
            certificate_id="GC-1",
        ),
        HourlyEnergy(
            timestamp=datetime(2026, 6, 1, 1, tzinfo=UTC),
            load_kwh=100,
            eligible_cfe_kwh=80,
            marginal_emissions_kg_per_kwh=0.5,
            certificate_id="GC-1",
        ),
    ]

    result = calculate_cfe_matching(hourly)

    assert result["duplicate_certificate_ids"] == ["GC-1"]
    assert result["cfe_score"] == pytest.approx(0.4)
    assert result["unmatched_load_kwh"] == pytest.approx(120)
    assert result["avoided_emissions_kg_co2e"] == pytest.approx(40)


def test_sci_uses_location_based_grid_and_embodied_carbon() -> None:
    metric = calculate_sci(
        energy_kwh=10,
        location_grid_kg_per_kwh=0.4,
        embodied_kg_co2e=1,
        functional_units=1000,
    )

    assert metric.value == pytest.approx(5)
    assert metric.unit == "gCO2e/functional-unit"


def test_lifecycle_embodied_allocation() -> None:
    component = LCAComponent(
        component_id="gpu",
        site_id="site-1",
        category="GPU",
        total_embodied_kg_co2e=1000,
        expected_lifetime_hours=100,
        installed_at=date(2026, 1, 1),
        resource_total=10,
    )

    assert allocate_embodied_component(component, time_reserved_hours=10, resources_reserved=5) == pytest.approx(50)


def test_quota_status_flags_compliance_gap_and_price_risk() -> None:
    result = calculate_quota_status(
        site_id="site-1",
        policy_id="policy",
        used_kg_co2e=1200,
        quota_kg_co2e=1000,
        forecast_daily_kg_co2e=10,
        carbon_price_usd_per_tonne=80,
        as_of=date(2026, 6, 1),
    )

    assert result["compliance_gap_kg_co2e"] == pytest.approx(200)
    assert result["carbon_price_risk_usd"] == pytest.approx(16)
    assert result["forecast_exceedance_date"] == date(2026, 6, 1)


def test_ratio_denominator_guard() -> None:
    with pytest.raises(CalculationError):
        calculate_cfe_matching([])
