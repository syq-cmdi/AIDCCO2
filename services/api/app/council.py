"""AI Energy Agent Council (智算碳治理 · Agent 议会).

A deterministic, auditable multi-agent deliberation engine. Each council agent
represents one decarbonization domain (accounting, grid/CFE, cooling, compute,
compliance, lifecycle). Agents read the platform's live state, emit findings
and motions, then the chair runs a weighted vote, resolves cross-domain
conflicts, and synthesizes a ranked, executable decision package aligned with
the site's 1.5C-compatible budget.

This mirrors apps/web/src/lib/council.ts so the web app and API agree.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

# Site annual physical baseline (tCO2e). Anchored to the web pathway evaluator's
# BASELINE_TCO2E so council abatement estimates stay consistent.
ANNUAL_BASELINE_TCO2E = 2_050_000.0

# Share of total emissions reachable by facility-side cooling levers.
COOLING_SHARE = 0.32
# Embodied (Scope 3 hardware + construction) share of the lifecycle inventory.
EMBODIED_SHARE = 0.16


class CouncilAgent(BaseModel):
    id: str
    name: str
    name_zh: str
    role: str
    mandate: str
    weight: float


class CouncilMotion(BaseModel):
    id: str
    proposer_id: str
    title: str
    lever: str
    expected_impact: str
    abatement_tco2e: float
    capex_usd_k: float
    effort: int = Field(ge=1, le=3)
    horizon: str
    constraints: list[str]
    confidence: float
    domain_tags: list[str]
    evidence_refs: list[str]


class CouncilFinding(BaseModel):
    agent_id: str
    stance: str
    severity: float
    headline: str
    rationale: str
    metrics_cited: list[dict[str, str]]
    motion_ids: list[str]


class CouncilVote(BaseModel):
    motion_id: str
    support: list[str]
    oppose: list[str]
    abstain: list[str]
    weighted_score: float
    consensus: str


class CouncilConflict(BaseModel):
    id: str
    title: str
    between: list[str]
    description: str
    resolution: str


class CouncilResolution(BaseModel):
    id: str
    rank: int
    motion: CouncilMotion
    vote: CouncilVote
    priority: str
    decision: str
    owner_id: str


class CouncilSummary(BaseModel):
    alignment_score: float
    total_abatement_tco2e: float
    p0_count: int
    headline: str
    risks: list[str]
    dissents: list[str]
    confidence: float


class CouncilState(BaseModel):
    site_id: str
    generated_at: str
    pue: float
    cue: float
    ref: float
    it_energy_kwh: float
    facility_energy_kwh: float
    location_kg_per_interval: float
    market_kg_per_interval: float
    cfe_score: float
    annual_match_ratio: float
    quota_used_percent: float
    forecast_exceedance: str | None
    carbon_price_risk_usd: float
    gpu_utilization: float
    annual_baseline_tco2e: float = ANNUAL_BASELINE_TCO2E


class CouncilSession(BaseModel):
    generated_at: str
    site_id: str
    agenda: str
    state: CouncilState
    agents: list[CouncilAgent]
    findings: list[CouncilFinding]
    motions: list[CouncilMotion]
    votes: list[CouncilVote]
    conflicts: list[CouncilConflict]
    resolutions: list[CouncilResolution]
    summary: CouncilSummary


COUNCIL_AGENTS: list[CouncilAgent] = [
    CouncilAgent(
        id="accounting",
        name="Carbon Accounting",
        name_zh="碳核算官",
        role="GHG Protocol Scope 1/2/3 与披露完整性",
        mandate="保证 location-based 与 market-based 分开披露，证书与抵消不得抵扣物理排放。",
        weight=1.2,
    ),
    CouncilAgent(
        id="grid",
        name="Grid & CFE",
        name_zh="电网与零碳电力官",
        role="24/7 CFE 匹配、边际排放与电力组合",
        mandate="在不污染物理口径的前提下提升小时级 CFE 匹配，降低残余负荷。",
        weight=1.1,
    ),
    CouncilAgent(
        id="cooling",
        name="Cooling & Thermal",
        name_zh="冷源与热管理官",
        role="PUE/WUE、冷却数字孪生与热约束",
        mandate="在 SLA 温度与冗余约束内压低 PUE 与冷却电耗。",
        weight=1.0,
    ),
    CouncilAgent(
        id="compute",
        name="Compute & Workload",
        name_zh="算力与负载官",
        role="GPU 利用率、碳感知调度与模型效率",
        mandate="提高加速卡利用率，将可延迟负载迁移到低边际排放时段。",
        weight=1.0,
    ),
    CouncilAgent(
        id="compliance",
        name="Compliance & Quota",
        name_zh="合规与配额官",
        role="ETS/内部预算配额、履约风险与碳价敞口",
        mandate="守住科学配额轨迹，预警履约缺口与碳价风险。",
        weight=1.15,
    ),
    CouncilAgent(
        id="lifecycle",
        name="Lifecycle & Embodied",
        name_zh="生命周期官",
        role="硬件内含碳、刷新周期与低碳供应链",
        mandate="延长硬件寿命、采购低碳硬件，控制 Scope 3 内含碳增长。",
        weight=0.95,
    ),
]

_AGENT_BY_ID = {agent.id: agent for agent in COUNCIL_AGENTS}


def _clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def _round(value: float, digits: int = 0) -> float:
    factor = 10**digits
    return round(value * factor) / factor


def _pct(value: float) -> str:
    return f"{_round(value * 100, 1)}%"


def _zh_num(value: float) -> str:
    return f"{int(round(value)):,}"


def build_council_state(
    *,
    site_id: str,
    generated_at: str,
    metrics: dict[str, float],
    cfe_score: float,
    annual_match_ratio: float,
    quota_used_percent: float,
    forecast_exceedance: str | None,
    carbon_price_risk_usd: float,
    gpu_utilization: float = 0.58,
    annual_baseline_tco2e: float = ANNUAL_BASELINE_TCO2E,
) -> CouncilState:
    """Build the normalized council state from primitive platform values."""
    return CouncilState(
        site_id=site_id,
        generated_at=generated_at,
        pue=metrics.get("pue", 1.2),
        cue=metrics.get("cue", 0.42),
        ref=metrics.get("ref", 0.5),
        it_energy_kwh=metrics.get("it_energy_kwh", 0.0),
        facility_energy_kwh=metrics.get("facility_energy_kwh", 0.0),
        location_kg_per_interval=metrics.get("location_based_emissions_kg", 0.0),
        market_kg_per_interval=metrics.get("market_based_emissions_kg", 0.0),
        cfe_score=cfe_score,
        annual_match_ratio=annual_match_ratio,
        quota_used_percent=quota_used_percent,
        forecast_exceedance=forecast_exceedance,
        carbon_price_risk_usd=carbon_price_risk_usd,
        gpu_utilization=gpu_utilization,
        annual_baseline_tco2e=annual_baseline_tco2e,
    )


# ---------------------------------------------------------------------------
# Per-agent deliberation
# ---------------------------------------------------------------------------


def _cooling_agent(s: CouncilState) -> tuple[CouncilFinding, list[CouncilMotion]]:
    target = 1.15
    headroom = max(0.0, s.pue - target)
    reachable = _clamp((headroom / max(s.pue, 1.0)) * 0.9)
    abatement = _round(s.annual_baseline_tco2e * COOLING_SHARE * reachable)
    stance = "caution" if s.pue > 1.3 else "optimize" if s.pue > 1.2 else "advance"
    severity = _clamp(headroom / 0.25)

    motions = [
        CouncilMotion(
            id="m-cooling-mpc",
            proposer_id="cooling",
            title="冷却数字孪生 + 模型预测控制 (MPC)",
            lever="cooling digital twin + MPC",
            expected_impact=f"将 PUE 由 {_round(s.pue, 3)} 压向 {target}，约 {_pct(reachable * COOLING_SHARE)} 站点排放下降",
            abatement_tco2e=abatement,
            capex_usd_k=480,
            effort=2,
            horizon="quarter",
            constraints=["冷通道温度 ≤ SLA 上限", "保留 N+1 泵组冗余", "湿球温度联锁"],
            confidence=0.74,
            domain_tags=["cooling", "efficiency", "physical"],
            evidence_refs=["bms://cooling/p-id", "dcim://pue/trend"],
        )
    ]
    if s.pue > 1.28:
        motions.append(
            CouncilMotion(
                id="m-cooling-liquid",
                proposer_id="cooling",
                title="直接到芯液冷 + 余热回收试点",
                lever="direct-to-chip liquid cooling",
                expected_impact="高密机柜散热从风冷迁移到液冷，余热并入园区热网",
                abatement_tco2e=_round(s.annual_baseline_tco2e * COOLING_SHARE * 0.18),
                capex_usd_k=2600,
                effort=3,
                horizon="multiyear",
                constraints=["机房承重与漏液检测", "CDU 冗余", "停机窗口受 SLA 限制"],
                confidence=0.55,
                domain_tags=["cooling", "capex", "physical"],
                evidence_refs=["bms://cdu/loop", "lca://heat-reuse"],
            )
        )

    finding = CouncilFinding(
        agent_id="cooling",
        stance=stance,
        severity=severity,
        headline="冷源效率接近目标，维持 MPC 即可"
        if stance == "advance"
        else f"PUE {_round(s.pue, 3)} 仍有 {_pct(reachable)} 冷却电耗可压降",
        rationale=(
            f"当前 PUE={_round(s.pue, 3)}，WUE 受冷却策略影响。把供水设定点在 SLA 内提高并启用 MPC，"
            f"可在不触发热风险的前提下回收约 {_zh_num(abatement)} tCO2e/年。"
        ),
        metrics_cited=[
            {"key": "PUE", "value": str(_round(s.pue, 3))},
            {"key": "CUE", "value": f"{_round(s.cue, 3)} kgCO2e/IT-kWh"},
        ],
        motion_ids=[m.id for m in motions],
    )
    return finding, motions


def _grid_agent(s: CouncilState) -> tuple[CouncilFinding, list[CouncilMotion]]:
    residual = _clamp(1 - s.cfe_score)
    near_term = _clamp(residual * 0.45)
    abatement = _round(s.annual_baseline_tco2e * near_term)
    stance = "caution" if s.cfe_score < 0.6 else "optimize" if s.cfe_score < 0.85 else "advance"
    severity = _clamp(residual / 0.6)

    motions = [
        CouncilMotion(
            id="m-grid-hourly-cfe",
            proposer_id="grid",
            title="小时级 CFE 采购 + 储能调度",
            lever="hourly granular certificates",
            expected_impact=f"CFE Score 由 {_pct(s.cfe_score)} 提升，覆盖 {_pct(near_term)} 残余负荷",
            abatement_tco2e=abatement,
            capex_usd_k=1200,
            effort=2,
            horizon="year",
            constraints=["市场化口径不得抵扣 location-based", "储能 SOC 与寿命约束", "可交付性受电网约束"],
            confidence=0.68,
            domain_tags=["grid", "cfe", "market"],
            evidence_refs=["grid://cfe/hourly", "ppa://portfolio"],
        )
    ]
    if s.ref < 0.7:
        motions.append(
            CouncilMotion(
                id="m-grid-ppa",
                proposer_id="grid",
                title="新增 firm PPA 与碳感知选址",
                lever="PPA portfolio optimization",
                expected_impact=f"REF 由 {_pct(s.ref)} 提升，降低小时级残余排放",
                abatement_tco2e=_round(s.annual_baseline_tco2e * near_term * 0.5),
                capex_usd_k=0,
                effort=2,
                horizon="year",
                constraints=["合约可交付性与增量性", "避免重复计算证书"],
                confidence=0.6,
                domain_tags=["grid", "cfe", "procurement"],
                evidence_refs=["ppa://additionality", "grid://marginal-emissions"],
            )
        )

    finding = CouncilFinding(
        agent_id="grid",
        stance=stance,
        severity=severity,
        headline="小时级 CFE 匹配良好，保持组合再平衡"
        if stance == "advance"
        else f"CFE Score {_pct(s.cfe_score)}，残余负荷 {_pct(residual)} 待覆盖",
        rationale=(
            f"年度匹配率 {_pct(s.annual_match_ratio)}，但小时级 CFE Score={_pct(s.cfe_score)}。"
            "通过小时级证书、PPA 组合与储能调度可覆盖近一半残余负荷；披露上严格保持 market-based 与 location-based 分离。"
        ),
        metrics_cited=[
            {"key": "CFE Score", "value": _pct(s.cfe_score)},
            {"key": "REF", "value": _pct(s.ref)},
        ],
        motion_ids=[m.id for m in motions],
    )
    return finding, motions


def _compute_agent(s: CouncilState) -> tuple[CouncilFinding, list[CouncilMotion]]:
    target = 0.72
    gap = max(0.0, target - s.gpu_utilization)
    reachable = _clamp(gap * 0.5)
    abatement = _round(s.annual_baseline_tco2e * 0.22 * reachable)
    stance = "caution" if s.gpu_utilization < 0.55 else "optimize" if s.gpu_utilization < 0.7 else "advance"
    severity = _clamp(gap / 0.25)

    motions = [
        CouncilMotion(
            id="m-compute-schedule",
            proposer_id="compute",
            title="碳感知调度 + GPU bin-packing",
            lever="carbon-aware scheduler",
            expected_impact=f"GPU 利用率由 {_pct(s.gpu_utilization)} 提升到 {_pct(target)}，可延迟训练迁移到低边际排放时段",
            abatement_tco2e=abatement,
            capex_usd_k=180,
            effort=1,
            horizon="quarter",
            constraints=["训练队列等待 < 45 分钟", "推理 SLA 优先级锁定", "跨区路由受数据驻留约束"],
            confidence=0.7,
            domain_tags=["compute", "scheduling", "physical"],
            evidence_refs=["scheduler://carbon-aware", "telemetry://gpu/util"],
        ),
        CouncilMotion(
            id="m-compute-efficiency",
            proposer_id="compute",
            title="模型量化、缓存复用与批处理合并",
            lever="model quantization",
            expected_impact="降低单位 token SCI，减少重复计算",
            abatement_tco2e=_round(s.annual_baseline_tco2e * 0.05),
            capex_usd_k=90,
            effort=1,
            horizon="quarter",
            constraints=["精度损失阈值受验收约束", "缓存命中率监控"],
            confidence=0.62,
            domain_tags=["compute", "efficiency", "physical"],
            evidence_refs=["sci://token", "cache://hit-rate"],
        ),
    ]

    finding = CouncilFinding(
        agent_id="compute",
        stance=stance,
        severity=severity,
        headline="加速卡利用率健康，聚焦模型效率"
        if stance == "advance"
        else f"GPU 利用率 {_pct(s.gpu_utilization)}，存在 {_pct(gap)} 提升空间",
        rationale=(
            f"当前 GPU 利用率 {_pct(s.gpu_utilization)}。通过 bin-packing 与碳感知调度提升利用率并迁移可延迟负载，"
            "可在保持 SLA 的同时下降单位算力碳强度。"
        ),
        metrics_cited=[
            {"key": "GPU util", "value": _pct(s.gpu_utilization)},
            {"key": "IT energy", "value": f"{_zh_num(s.it_energy_kwh)} kWh/区间"},
        ],
        motion_ids=[m.id for m in motions],
    )
    return finding, motions


def _compliance_agent(s: CouncilState) -> tuple[CouncilFinding, list[CouncilMotion]]:
    over = s.quota_used_percent > 100
    tight = s.quota_used_percent > 75 or s.forecast_exceedance is not None
    stance = "block" if over else "caution" if tight else "monitor" if s.quota_used_percent > 60 else "advance"
    severity = _clamp(s.quota_used_percent / 100)

    motions: list[CouncilMotion] = []
    if tight or over:
        motions.append(
            CouncilMotion(
                id="m-compliance-guardrail",
                proposer_id="compliance",
                title="配额护栏 + 碳价敞口对冲",
                lever="quota guardrail",
                expected_impact=f"控制履约缺口，降低碳价风险敞口 (当前 ${_round(s.carbon_price_risk_usd / 1000)}k)",
                abatement_tco2e=0,
                capex_usd_k=60,
                effort=1,
                horizon="now",
                constraints=["护栏不得伪造物理减排", "对冲与披露需留痕"],
                confidence=0.66,
                domain_tags=["compliance", "risk"],
                evidence_refs=["ets://exposure", "quota://forecast"],
            )
        )

    headline = (
        "配额超限，需立即护栏与缓解"
        if over
        else f"配额已用 {_round(s.quota_used_percent, 1)}%，存在履约风险"
        if tight
        else f"配额已用 {_round(s.quota_used_percent, 1)}%，轨迹可控"
    )
    finding = CouncilFinding(
        agent_id="compliance",
        stance=stance,
        severity=severity,
        headline=headline,
        rationale=(
            f"配额使用率 {_round(s.quota_used_percent, 1)}%，预测超限日={s.forecast_exceedance or '无'}。"
            "建议把所有物理减排议案优先级与科学配额轨迹挂钩，并对碳价敞口设置对冲。"
        ),
        metrics_cited=[
            {"key": "Quota used", "value": f"{_round(s.quota_used_percent, 1)}%"},
            {"key": "Carbon price risk", "value": f"${_round(s.carbon_price_risk_usd / 1000)}k"},
        ],
        motion_ids=[m.id for m in motions],
    )
    return finding, motions


def _lifecycle_agent(s: CouncilState) -> tuple[CouncilFinding, list[CouncilMotion]]:
    abatement = _round(s.annual_baseline_tco2e * EMBODIED_SHARE * 0.22)
    motions = [
        CouncilMotion(
            id="m-lifecycle-lifetime",
            proposer_id="lifecycle",
            title="硬件寿命延长 + 低碳采购",
            lever="server lifetime extension",
            expected_impact=f"摊薄内含碳 (约占库存 {_pct(EMBODIED_SHARE)})，降低 Scope 3 刷新峰值",
            abatement_tco2e=abatement,
            capex_usd_k=-320,
            effort=2,
            horizon="year",
            constraints=["故障率与能效退化阈值", "保修与备件可得性", "需 EPD/PCF 数据"],
            confidence=0.58,
            domain_tags=["lifecycle", "embodied", "scope3"],
            evidence_refs=["lca://server/epd", "procurement://low-carbon"],
        )
    ]
    finding = CouncilFinding(
        agent_id="lifecycle",
        stance="optimize",
        severity=0.4,
        headline="延长硬件寿命可摊薄内含碳，但与算力扩张存在张力",
        rationale=(
            f"内含碳约占生命周期库存 {_pct(EMBODIED_SHARE)}。在故障率与能效退化阈值内延长服务器寿命，"
            "并采购具备 EPD/PCF 的低碳硬件，可降低 Scope 3 刷新峰值。"
        ),
        metrics_cited=[
            {"key": "Embodied share", "value": _pct(EMBODIED_SHARE)},
            {"key": "CUE", "value": f"{_round(s.cue, 3)} kgCO2e/IT-kWh"},
        ],
        motion_ids=[m.id for m in motions],
    )
    return finding, motions


def _accounting_agent(s: CouncilState) -> tuple[CouncilFinding, list[CouncilMotion]]:
    gap = s.location_kg_per_interval - s.market_kg_per_interval
    gap_share = _clamp(gap / s.location_kg_per_interval) if s.location_kg_per_interval > 0 else 0.0
    stance = "caution" if gap_share > 0.45 else "monitor"

    motions = [
        CouncilMotion(
            id="m-accounting-integrity",
            proposer_id="accounting",
            title="双口径披露护栏 + 证书去重审计",
            lever="dual-reporting guardrail",
            expected_impact="确保 market-based 收益不抵扣物理排放，CFE/SCI 仅用 location-based",
            abatement_tco2e=0,
            capex_usd_k=40,
            effort=1,
            horizon="now",
            constraints=["证书去重与增量性核验", "method_version 留痕", "避免重复计算"],
            confidence=0.8,
            domain_tags=["accounting", "integrity", "governance"],
            evidence_refs=["ghgp://scope2/dual", "registry://certificate-dedup"],
        )
    ]
    finding = CouncilFinding(
        agent_id="accounting",
        stance=stance,
        severity=_clamp(gap_share),
        headline=f"location-based 与 market-based 差额 {_pct(gap_share)}，需守住披露完整性",
        rationale=(
            f"本区间 location-based={_zh_num(s.location_kg_per_interval)} kg，"
            f"market-based={_zh_num(s.market_kg_per_interval)} kg，差额由证书/PPA 形成。"
            "议会任何减排主张都必须以 location-based 物理口径计量，market 收益单独披露。"
        ),
        metrics_cited=[
            {"key": "LB emissions", "value": f"{_zh_num(s.location_kg_per_interval)} kg"},
            {"key": "MB emissions", "value": f"{_zh_num(s.market_kg_per_interval)} kg"},
        ],
        motion_ids=[m.id for m in motions],
    )
    return finding, motions


# ---------------------------------------------------------------------------
# Chair: voting, conflict resolution, synthesis
# ---------------------------------------------------------------------------


def _vote_on_motion(motion: CouncilMotion, state: CouncilState) -> CouncilVote:
    support: list[str] = []
    oppose: list[str] = []
    abstain: list[str] = []

    for agent in COUNCIL_AGENTS:
        aid = agent.id
        if aid == motion.proposer_id:
            support.append(aid)
            continue
        if aid == "accounting":
            if "market" in motion.domain_tags and "physical" not in motion.domain_tags:
                abstain.append(aid)
            else:
                support.append(aid)
            continue
        if aid == "compliance":
            if motion.abatement_tco2e > 0 or "risk" in motion.domain_tags:
                support.append(aid)
            else:
                abstain.append(aid)
            continue
        if aid == "cooling" and motion.id == "m-compute-schedule" and state.pue > 1.3:
            oppose.append(aid)
            continue
        if (
            aid == "lifecycle"
            and motion.capex_usd_k > 2000
            and motion.abatement_tco2e < state.annual_baseline_tco2e * 0.05
        ):
            oppose.append(aid)
            continue
        if aid == "grid":
            if any(t in ("grid", "cfe", "efficiency", "physical") for t in motion.domain_tags):
                support.append(aid)
            else:
                abstain.append(aid)
            continue
        if motion.abatement_tco2e > 0 or "physical" in motion.domain_tags:
            support.append(aid)
        else:
            abstain.append(aid)

    support_weight = sum(_AGENT_BY_ID[i].weight for i in support)
    oppose_weight = sum(_AGENT_BY_ID[i].weight for i in oppose)
    total_weight = sum(a.weight for a in COUNCIL_AGENTS)
    weighted_score = _round((support_weight - oppose_weight) / total_weight, 3)

    if not oppose and not abstain:
        consensus = "unanimous"
    elif not oppose:
        consensus = "strong"
    elif len(oppose) >= len(support):
        consensus = "contested"
    else:
        consensus = "split"

    return CouncilVote(
        motion_id=motion.id,
        support=support,
        oppose=oppose,
        abstain=abstain,
        weighted_score=weighted_score,
        consensus=consensus,
    )


def _detect_conflicts(state: CouncilState, motions: list[CouncilMotion]) -> list[CouncilConflict]:
    conflicts: list[CouncilConflict] = []
    motion_ids = {m.id for m in motions}

    if state.pue > 1.28 and "m-compute-schedule" in motion_ids:
        conflicts.append(
            CouncilConflict(
                id="c-thermal-density",
                title="算力增密 vs 热约束",
                between=["compute", "cooling"],
                description="在 PUE 偏高时提升 GPU 利用率会增加机柜热负荷，冷源官担心触发热风险与 SLA 违规。",
                resolution="先部署冷却 MPC（必要时液冷试点）建立热裕度，再分阶段提升利用率；调度器以进风温度与冷源裕度为硬约束。",
            )
        )
    if state.cfe_score < 0.85:
        conflicts.append(
            CouncilConflict(
                id="c-market-integrity",
                title="市场化采购 vs 物理口径完整性",
                between=["grid", "accounting"],
                description="电网官希望用小时级证书/PPA 快速改善披露，核算官要求这些收益不得抵扣 location-based 物理排放或 SCI。",
                resolution="采纳 CFE 采购议案，但强制双口径披露护栏：market-based 单独列示，CFE Score 与 SCI 始终用 location-based 因子；所有证书需去重与增量性核验。",
            )
        )
    if "m-cooling-liquid" in motion_ids:
        conflicts.append(
            CouncilConflict(
                id="c-capex-embodied",
                title="液冷资本投入 vs 内含碳与回收期",
                between=["cooling", "lifecycle"],
                description="液冷与余热回收带来运行减排，但新增设备的内含碳与高资本支出需要与回收期匹配。",
                resolution="液冷先作为高密分区试点（pilot），以实测 PUE 与余热回收量校准回收期，再决定是否全量推广。",
            )
        )
    return conflicts


def _priority_for(motion: CouncilMotion, vote: CouncilVote, state: CouncilState) -> str:
    abatement_share = motion.abatement_tco2e / state.annual_baseline_tco2e
    urgent = state.quota_used_percent > 75 or state.forecast_exceedance is not None
    if motion.horizon == "now" and ("governance" in motion.domain_tags or "risk" in motion.domain_tags):
        return "P0" if (urgent or vote.consensus != "contested") else "P1"
    if abatement_share >= 0.04 and motion.effort <= 2 and vote.weighted_score > 0.4:
        return "P0"
    if abatement_share >= 0.01 or vote.weighted_score > 0.3:
        return "P1"
    return "P2"


def _decision_for(vote: CouncilVote, motion: CouncilMotion) -> str:
    if vote.consensus == "contested":
        return "defer"
    if motion.effort == 3 or motion.confidence < 0.6 or vote.consensus == "split":
        return "pilot"
    return "adopt"


def deliberate(state: CouncilState) -> CouncilSession:
    """Run a full council deliberation over the normalized state."""
    outputs = [
        _accounting_agent(state),
        _grid_agent(state),
        _cooling_agent(state),
        _compute_agent(state),
        _compliance_agent(state),
        _lifecycle_agent(state),
    ]
    findings = [o[0] for o in outputs]
    motions = [m for o in outputs for m in o[1]]
    votes = [_vote_on_motion(m, state) for m in motions]
    vote_by_motion = {v.motion_id: v for v in votes}
    conflicts = _detect_conflicts(state, motions)

    priority_rank = {"P0": 0, "P1": 1, "P2": 2}
    scored = []
    for motion in motions:
        vote = vote_by_motion[motion.id]
        priority = _priority_for(motion, vote, state)
        scored.append((motion, vote, priority))
    scored = [r for r in scored if r[1].weighted_score > -0.1]
    scored.sort(key=lambda r: (priority_rank[r[2]], -r[0].abatement_tco2e, r[0].effort))

    resolutions: list[CouncilResolution] = []
    for index, (motion, vote, priority) in enumerate(scored):
        resolutions.append(
            CouncilResolution(
                id=f"r-{index + 1}",
                rank=index + 1,
                motion=motion,
                vote=vote,
                priority=priority,
                decision=_decision_for(vote, motion),
                owner_id=motion.proposer_id,
            )
        )

    total_abatement = _round(
        sum(r.motion.abatement_tco2e for r in resolutions if r.decision != "defer")
    )

    abatement_coverage = _clamp(total_abatement / (state.annual_baseline_tco2e * 0.5))
    compliance_penalty = 0.3 if state.quota_used_percent > 100 else 0.15 if state.quota_used_percent > 75 else 0.0
    alignment_score = _clamp(0.45 + abatement_coverage * 0.55 - compliance_penalty)

    avg_confidence = _round(
        (sum(r.motion.confidence for r in resolutions) / len(resolutions)) if resolutions else 0.6,
        2,
    )

    risks: list[str] = []
    if state.quota_used_percent > 75:
        risks.append(f"配额已用 {_round(state.quota_used_percent, 1)}%，履约窗口收紧")
    if state.cfe_score < 0.85:
        risks.append(f"小时级 CFE Score {_pct(state.cfe_score)}，残余负荷依赖电网")
    if state.pue > 1.28:
        risks.append(f"PUE {_round(state.pue, 3)} 偏高，冷却电耗仍可压降")
    if state.carbon_price_risk_usd > 0:
        risks.append(f"碳价敞口约 ${_round(state.carbon_price_risk_usd / 1000)}k")
    if not risks:
        risks.append("各域指标处于绿区，维持治理节奏")

    dissents: list[str] = []
    for vote in votes:
        if vote.oppose:
            motion = next(m for m in motions if m.id == vote.motion_id)
            names = "、".join(_AGENT_BY_ID[i].name_zh for i in vote.oppose)
            dissents.append(f"{names} 对「{motion.title}」保留意见（已通过冲突裁决约束）")

    p0_count = sum(1 for r in resolutions if r.priority == "P0")
    adopted = sum(1 for r in resolutions if r.decision != "defer")
    headline = (
        f"议会通过 {adopted} 项动议（{p0_count} 项 P0），预计年减排 {_zh_num(total_abatement)} tCO2e，"
        f"与 1.5℃ 站点配额对齐度 {_pct(alignment_score)}。所有物理减排以 location-based 计量，market 收益单独披露。"
    )

    summary = CouncilSummary(
        alignment_score=_round(alignment_score, 3),
        total_abatement_tco2e=total_abatement,
        p0_count=p0_count,
        headline=headline,
        risks=risks,
        dissents=dissents,
        confidence=avg_confidence,
    )

    return CouncilSession(
        generated_at=state.generated_at,
        site_id=state.site_id,
        agenda="AIDC 站点季度降碳与履约治理审议",
        state=state,
        agents=COUNCIL_AGENTS,
        findings=findings,
        motions=motions,
        votes=votes,
        conflicts=conflicts,
        resolutions=resolutions,
        summary=summary,
    )
