# AI Energy Agent Council (智算碳治理 · Agent 议会)

The Agent Council turns the platform's monitoring surfaces into a governance
surface. Instead of a flat list of "AI optimization suggestions", the council
runs a structured, auditable deliberation: domain agents each argue from their
own mandate, the chair runs a weighted vote, cross-domain conflicts are
explicitly ruled on, and the output is a ranked, executable decision package
that stays aligned with the site's 1.5°C-compatible physical budget.

## Why a council

AIDC decarbonization decisions are inherently multi-objective and conflicting:
pushing GPU utilization fights thermal headroom; buying hourly certificates can
quietly contaminate the physical (location-based) ledger; liquid cooling cuts
operating emissions but adds embodied carbon and capex. A single recommender
hides these trade-offs. A council makes them explicit, attributable, and
reviewable — every motion has a proposer, a vote, and a conflict ruling.

## Council seats

| Agent | 中文 | Mandate |
| --- | --- | --- |
| `accounting` | 碳核算官 | Keep location-based and market-based disclosure separate; certificates/offsets never net against physical emissions, SCI, or server-layer intensity. |
| `grid` | 电网与零碳电力官 | Raise hourly 24/7 CFE matching and cut residual load without polluting the physical ledger. |
| `cooling` | 冷源与热管理官 | Drive PUE/WUE down within SLA temperature and redundancy constraints. |
| `compute` | 算力与负载官 | Lift accelerator utilization and shift deferrable load to low-marginal-emission hours. |
| `compliance` | 合规与配额官 | Hold the science-based quota trajectory; warn on compliance gaps and carbon-price exposure. |
| `lifecycle` | 生命周期官 | Extend hardware lifetime and procure low-carbon hardware to contain embodied Scope 3. |

The **chair** (议长) is not a seat; it is the synthesis stage that votes,
resolves conflicts, ranks, and writes the executive summary.

## Deliberation pipeline

1. **State normalization** — `buildCouncilState` maps live (or fallback)
   realtime metrics, quota status, and CFE matching into a flat `CouncilState`.
2. **Findings & motions** — each agent reads the state and emits a `finding`
   (stance ∈ advance/optimize/caution/block/monitor, severity, cited metrics)
   plus zero or more `motions`. Each motion carries an estimated annual
   abatement (tCO2e), capex (k$, negative = saving), effort (1–3), horizon,
   constraints, confidence, and domain tags. Abatement estimates are anchored
   to the pathway evaluator's site baseline so they reconcile with the scenario
   charts.
3. **Weighted vote** — the chair tallies a weighted support/oppose/abstain per
   motion. Voting rules encode the real tensions, e.g. the accounting officer
   **abstains** on market-only procurement motions (no physical delta), and the
   cooling officer **opposes** densification when PUE has no thermal headroom.
4. **Conflict rulings** — known cross-domain conflicts (thermal vs density,
   market claims vs accounting integrity, liquid-cooling capex vs embodied
   carbon) are detected and resolved with an explicit chair ruling.
5. **Resolution package** — motions are ranked by priority (P0/P1/P2), then
   abatement, then effort; each gets a decision (adopt / pilot / defer) and an
   owner. Contested motions are deferred, not silently dropped.
6. **Summary** — 1.5°C alignment score, total adopted abatement, P0 count,
   weighted confidence, top risks, and recorded dissents.

## Accounting integrity guardrail

The council inherits the platform's core invariant: **physical reductions are
always measured in location-based terms**. Market-based instruments
(EAC/REC/GO/I-REC/PPA/offset) are disclosed separately and never reduce
location-based emissions, SCI, or server-layer carbon intensity. The
`m-accounting-integrity` motion and the `c-market-integrity` conflict ruling
enforce this whenever CFE procurement is on the agenda.

## Implementation & parity

- Web engine: `apps/web/src/lib/council.ts` (pure, deterministic, runs in the
  Cloudflare Worker / static render with no backend dependency).
- API engine: `services/api/app/council.py`, exposed at
  `GET /council/deliberation`, mirroring the same constants and logic.
- UI: `apps/web/src/app/council/page.tsx` renders the roster, findings,
  motion/vote board, conflict rulings, and chair summary, with a GPU-utilization
  slider to explore how the council re-ranks under different load assumptions.
- Tests: `services/api/tests/test_council.py` covers endpoint shape, vote
  semantics, conflict triggering, accounting abstention, and quota-breach
  alignment effects.

Because the two engines share constants and logic, the `/council` screen renders
the same deliberation whether or not the FastAPI backend is reachable, which is
what makes the feature deployable on a static/edge target.

## Extending the council

- **Add a seat**: append to `councilAgents` / `COUNCIL_AGENTS`, add an agent
  function returning a finding + motions, and (optionally) voting rules.
- **Add a motion**: emit it from an agent with realistic abatement/effort and
  domain tags; voting and ranking pick it up automatically.
- **Add a conflict**: extend `detectConflicts` / `_detect_conflicts` with the
  triggering condition and the chair's ruling.
- **Swap in an LLM chair**: the deterministic engine can serve as a tool/oracle
  for an LLM-backed chair that narrates or negotiates motions, while the
  numeric abatement and integrity guardrails remain auditable.
