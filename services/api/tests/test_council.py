from __future__ import annotations

from fastapi.testclient import TestClient

from app.council import build_council_state, deliberate
from app.main import app

client = TestClient(app)


def _state(**overrides):
    base = dict(
        site_id="aidc-sg-01",
        generated_at="2026-06-19T00:00:00+00:00",
        metrics={
            "pue": 1.32,
            "cue": 0.42,
            "ref": 0.58,
            "it_energy_kwh": 23510,
            "facility_energy_kwh": 28430,
            "location_based_emissions_kg": 9875,
            "market_based_emissions_kg": 5024,
        },
        cfe_score=0.62,
        annual_match_ratio=0.81,
        quota_used_percent=61.7,
        forecast_exceedance=None,
        carbon_price_risk_usd=0.0,
        gpu_utilization=0.58,
    )
    base.update(overrides)
    return build_council_state(**base)


def test_council_endpoint_returns_full_session() -> None:
    response = client.get("/council/deliberation")

    assert response.status_code == 200
    payload = response.json()
    assert payload["site_id"] == "aidc-sg-01"
    assert len(payload["agents"]) == 6
    assert len(payload["findings"]) == 6
    assert payload["motions"], "expected at least one motion"
    assert len(payload["votes"]) == len(payload["motions"])
    assert payload["summary"]["headline"]
    # Resolutions are ranked contiguously from 1.
    ranks = [r["rank"] for r in payload["resolutions"]]
    assert ranks == list(range(1, len(ranks) + 1))


def test_council_gpu_utilization_changes_compute_abatement() -> None:
    low = deliberate(_state(gpu_utilization=0.45))
    high = deliberate(_state(gpu_utilization=0.8))

    def abatement(session, motion_id):
        motion = next(m for m in session.motions if m.id == motion_id)
        return motion.abatement_tco2e

    # Lower utilization leaves more reachable headroom for scheduling.
    assert abatement(low, "m-compute-schedule") > abatement(high, "m-compute-schedule")


def test_council_high_pue_triggers_thermal_conflict_and_liquid_motion() -> None:
    session = deliberate(_state(metrics={
        "pue": 1.35,
        "cue": 0.42,
        "ref": 0.58,
        "it_energy_kwh": 23510,
        "facility_energy_kwh": 28430,
        "location_based_emissions_kg": 9875,
        "market_based_emissions_kg": 5024,
    }))

    conflict_ids = {c.id for c in session.conflicts}
    assert "c-thermal-density" in conflict_ids
    assert any(m.id == "m-cooling-liquid" for m in session.motions)


def test_accounting_guardrail_is_zero_abatement_and_high_priority() -> None:
    session = deliberate(_state())
    guardrail = next(m for m in session.motions if m.id == "m-accounting-integrity")
    assert guardrail.abatement_tco2e == 0

    resolution = next(r for r in session.resolutions if r.motion.id == "m-accounting-integrity")
    # Governance guardrails are adopted immediately, never deferred.
    assert resolution.decision == "adopt"
    assert resolution.priority in {"P0", "P1"}


def test_quota_breach_lowers_alignment_and_flags_compliance_block() -> None:
    healthy = deliberate(_state(quota_used_percent=55.0))
    breached = deliberate(_state(quota_used_percent=104.0, carbon_price_risk_usd=1_200_000.0))

    assert breached.summary.alignment_score < healthy.summary.alignment_score
    compliance = next(f for f in breached.findings if f.agent_id == "compliance")
    assert compliance.stance == "block"


def test_market_only_motion_has_accounting_abstain() -> None:
    session = deliberate(_state())
    cfe_vote = next(v for v in session.votes if v.motion_id == "m-grid-hourly-cfe")
    # CFE procurement is a market-tagged motion without a physical tag, so the
    # accounting officer abstains to protect dual-reporting integrity.
    assert "accounting" in cfe_vote.abstain


def test_total_abatement_excludes_deferred_motions() -> None:
    session = deliberate(_state())
    adopted = sum(
        r.motion.abatement_tco2e for r in session.resolutions if r.decision != "defer"
    )
    assert session.summary.total_abatement_tco2e == round(adopted)
