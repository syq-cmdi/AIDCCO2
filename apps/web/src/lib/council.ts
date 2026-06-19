// AI Energy Agent Council (智算碳治理 · Agent 议会)
//
// A deterministic, auditable multi-agent deliberation engine. Each council
// agent represents one decarbonization domain (accounting, grid/CFE, cooling,
// compute, compliance, lifecycle). Agents read the platform's live state,
// emit findings and motions, then the chair runs a weighted vote, resolves
// cross-domain conflicts, and synthesizes a ranked, executable decision
// package aligned with the site's 1.5C-compatible budget.
//
// The engine is pure and side-effect free so it can run server-side on
// Cloudflare Workers, be statically rendered, and be unit tested. It mirrors
// services/api/app/council.py.

import type { MatchingResult, QuotaStatus, RealtimeMetrics } from "./api";

export type CouncilStance = "advance" | "optimize" | "caution" | "block" | "monitor";
export type MotionHorizon = "now" | "quarter" | "year" | "multiyear";
export type MotionEffort = 1 | 2 | 3;

export type CouncilAgent = {
  id: string;
  name: string;
  nameZh: string;
  role: string;
  mandate: string;
  weight: number;
};

export type CouncilMotion = {
  id: string;
  proposerId: string;
  title: string;
  lever: string;
  expectedImpact: string;
  abatementTco2e: number;
  capexUsdK: number;
  effort: MotionEffort;
  horizon: MotionHorizon;
  constraints: string[];
  confidence: number;
  domainTags: string[];
  evidenceRefs: string[];
};

export type CouncilFinding = {
  agentId: string;
  stance: CouncilStance;
  severity: number;
  headline: string;
  rationale: string;
  metricsCited: { key: string; value: string }[];
  motionIds: string[];
};

export type VoteConsensus = "unanimous" | "strong" | "split" | "contested";

export type CouncilVote = {
  motionId: string;
  support: string[];
  oppose: string[];
  abstain: string[];
  weightedScore: number;
  consensus: VoteConsensus;
};

export type CouncilConflict = {
  id: string;
  title: string;
  between: string[];
  description: string;
  resolution: string;
};

export type CouncilResolution = {
  id: string;
  rank: number;
  motion: CouncilMotion;
  vote: CouncilVote;
  priority: "P0" | "P1" | "P2";
  decision: "adopt" | "pilot" | "defer";
  ownerId: string;
};

export type CouncilSummary = {
  alignmentScore: number;
  totalAbatementTco2e: number;
  p0Count: number;
  headline: string;
  risks: string[];
  dissents: string[];
  confidence: number;
};

export type CouncilSession = {
  generatedAt: string;
  siteId: string;
  agenda: string;
  state: CouncilState;
  agents: CouncilAgent[];
  findings: CouncilFinding[];
  motions: CouncilMotion[];
  votes: CouncilVote[];
  conflicts: CouncilConflict[];
  resolutions: CouncilResolution[];
  summary: CouncilSummary;
};

export type CouncilState = {
  siteId: string;
  generatedAt: string;
  pue: number;
  cue: number;
  ref: number;
  itEnergyKwh: number;
  facilityEnergyKwh: number;
  locationKgPerInterval: number;
  marketKgPerInterval: number;
  cfeScore: number;
  annualMatchRatio: number;
  quotaUsedPercent: number;
  forecastExceedance: string | null;
  carbonPriceRiskUsd: number;
  gpuUtilization: number;
  annualBaselineTco2e: number;
};

// Site annual physical baseline (tCO2e). Anchored to the pathway evaluator's
// BASELINE_TCO2E so council abatement estimates stay consistent with the
// scenario charts.
const ANNUAL_BASELINE_TCO2E = 2_050_000;

// Cooling/overhead share of total emissions reachable by facility-side levers.
const COOLING_SHARE = 0.32;
// Embodied (Scope 3 hardware + construction) share of the lifecycle inventory.
const EMBODIED_SHARE = 0.16;

export const councilAgents: CouncilAgent[] = [
  {
    id: "accounting",
    name: "Carbon Accounting",
    nameZh: "碳核算官",
    role: "GHG Protocol Scope 1/2/3 与披露完整性",
    mandate: "保证 location-based 与 market-based 分开披露，证书与抵消不得抵扣物理排放。",
    weight: 1.2
  },
  {
    id: "grid",
    name: "Grid & CFE",
    nameZh: "电网与零碳电力官",
    role: "24/7 CFE 匹配、边际排放与电力组合",
    mandate: "在不污染物理口径的前提下提升小时级 CFE 匹配，降低残余负荷。",
    weight: 1.1
  },
  {
    id: "cooling",
    name: "Cooling & Thermal",
    nameZh: "冷源与热管理官",
    role: "PUE/WUE、冷却数字孪生与热约束",
    mandate: "在 SLA 温度与冗余约束内压低 PUE 与冷却电耗。",
    weight: 1.0
  },
  {
    id: "compute",
    name: "Compute & Workload",
    nameZh: "算力与负载官",
    role: "GPU 利用率、碳感知调度与模型效率",
    mandate: "提高加速卡利用率，将可延迟负载迁移到低边际排放时段。",
    weight: 1.0
  },
  {
    id: "compliance",
    name: "Compliance & Quota",
    nameZh: "合规与配额官",
    role: "ETS/内部预算配额、履约风险与碳价敞口",
    mandate: "守住科学配额轨迹，预警履约缺口与碳价风险。",
    weight: 1.15
  },
  {
    id: "lifecycle",
    name: "Lifecycle & Embodied",
    nameZh: "生命周期官",
    role: "硬件内含碳、刷新周期与低碳供应链",
    mandate: "延长硬件寿命、采购低碳硬件，控制 Scope 3 内含碳增长。",
    weight: 0.95
  }
];

const CHAIR_ID = "chair";

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 0): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function fmtPct(value: number): string {
  return `${round(value * 100, 1)}%`;
}

/** Derive the normalized council state from live (or fallback) platform data. */
export function buildCouncilState(
  metrics: RealtimeMetrics,
  quota: QuotaStatus,
  matching: MatchingResult,
  gpuUtilization = 0.58,
  annualBaselineTco2e = ANNUAL_BASELINE_TCO2E
): CouncilState {
  const m = (key: string, fallback = 0) => metrics.metrics[key]?.value ?? fallback;
  return {
    siteId: metrics.site_id,
    generatedAt: metrics.generated_at,
    pue: m("pue", 1.2),
    cue: m("cue", 0.42),
    ref: m("ref", 0.5),
    itEnergyKwh: m("it_energy_kwh", 0),
    facilityEnergyKwh: m("facility_energy_kwh", 0),
    locationKgPerInterval: m("location_based_emissions_kg", 0),
    marketKgPerInterval: m("market_based_emissions_kg", 0),
    cfeScore: matching.cfe_score,
    annualMatchRatio: matching.annual_match_ratio,
    quotaUsedPercent: quota.used_percent,
    forecastExceedance: quota.forecast_exceedance_date,
    carbonPriceRiskUsd: quota.carbon_price_risk_usd,
    gpuUtilization,
    annualBaselineTco2e
  };
}

// ---------------------------------------------------------------------------
// Per-agent deliberation
// ---------------------------------------------------------------------------

type AgentOutput = { finding: CouncilFinding; motions: CouncilMotion[] };

function coolingAgent(s: CouncilState): AgentOutput {
  const target = 1.15;
  const headroom = Math.max(0, s.pue - target);
  const reachableFraction = clamp((headroom / Math.max(s.pue, 1)) * 0.9);
  const abatement = round(s.annualBaselineTco2e * COOLING_SHARE * reachableFraction);
  const stance: CouncilStance = s.pue > 1.3 ? "caution" : s.pue > 1.2 ? "optimize" : "advance";
  const severity = clamp(headroom / 0.25);

  const motions: CouncilMotion[] = [
    {
      id: "m-cooling-mpc",
      proposerId: "cooling",
      title: "冷却数字孪生 + 模型预测控制 (MPC)",
      lever: "cooling digital twin + MPC",
      expectedImpact: `将 PUE 由 ${round(s.pue, 3)} 压向 ${target}，约 ${fmtPct(reachableFraction * COOLING_SHARE)} 站点排放下降`,
      abatementTco2e: abatement,
      capexUsdK: 480,
      effort: 2,
      horizon: "quarter",
      constraints: ["冷通道温度 ≤ SLA 上限", "保留 N+1 泵组冗余", "湿球温度联锁"],
      confidence: 0.74,
      domainTags: ["cooling", "efficiency", "physical"],
      evidenceRefs: ["bms://cooling/p-id", "dcim://pue/trend"]
    }
  ];
  if (s.pue > 1.28) {
    motions.push({
      id: "m-cooling-liquid",
      proposerId: "cooling",
      title: "直接到芯液冷 + 余热回收试点",
      lever: "direct-to-chip liquid cooling",
      expectedImpact: "高密机柜散热从风冷迁移到液冷，余热并入园区热网",
      abatementTco2e: round(s.annualBaselineTco2e * COOLING_SHARE * 0.18),
      capexUsdK: 2600,
      effort: 3,
      horizon: "multiyear",
      constraints: ["机房承重与漏液检测", "CDU 冗余", "停机窗口受 SLA 限制"],
      confidence: 0.55,
      domainTags: ["cooling", "capex", "physical"],
      evidenceRefs: ["bms://cdu/loop", "lca://heat-reuse"]
    });
  }

  return {
    finding: {
      agentId: "cooling",
      stance,
      severity,
      headline: stance === "advance" ? "冷源效率接近目标，维持 MPC 即可" : `PUE ${round(s.pue, 3)} 仍有 ${fmtPct(reachableFraction)} 冷却电耗可压降`,
      rationale: `当前 PUE=${round(s.pue, 3)}，WUE 受冷却策略影响。把供水设定点在 SLA 内提高并启用 MPC，可在不触发热风险的前提下回收约 ${abatement.toLocaleString("zh-CN")} tCO2e/年。`,
      metricsCited: [
        { key: "PUE", value: round(s.pue, 3).toString() },
        { key: "CUE", value: `${round(s.cue, 3)} kgCO2e/IT-kWh` }
      ],
      motionIds: motions.map((x) => x.id)
    },
    motions
  };
}

function gridAgent(s: CouncilState): AgentOutput {
  const residual = clamp(1 - s.cfeScore);
  const nearTermFraction = clamp(residual * 0.45);
  const abatement = round(s.annualBaselineTco2e * nearTermFraction);
  const stance: CouncilStance = s.cfeScore < 0.6 ? "caution" : s.cfeScore < 0.85 ? "optimize" : "advance";
  const severity = clamp(residual / 0.6);

  const motions: CouncilMotion[] = [
    {
      id: "m-grid-hourly-cfe",
      proposerId: "grid",
      title: "小时级 CFE 采购 + 储能调度",
      lever: "hourly granular certificates",
      expectedImpact: `CFE Score 由 ${fmtPct(s.cfeScore)} 提升，覆盖 ${fmtPct(nearTermFraction)} 残余负荷`,
      abatementTco2e: abatement,
      capexUsdK: 1200,
      effort: 2,
      horizon: "year",
      constraints: ["市场化口径不得抵扣 location-based", "储能 SOC 与寿命约束", "可交付性受电网约束"],
      confidence: 0.68,
      domainTags: ["grid", "cfe", "market"],
      evidenceRefs: ["grid://cfe/hourly", "ppa://portfolio"]
    }
  ];
  if (s.ref < 0.7) {
    motions.push({
      id: "m-grid-ppa",
      proposerId: "grid",
      title: "新增 firm PPA 与碳感知选址",
      lever: "PPA portfolio optimization",
      expectedImpact: `REF 由 ${fmtPct(s.ref)} 提升，降低小时级残余排放`,
      abatementTco2e: round(s.annualBaselineTco2e * nearTermFraction * 0.5),
      capexUsdK: 0,
      effort: 2,
      horizon: "year",
      constraints: ["合约可交付性与增量性", "避免重复计算证书"],
      confidence: 0.6,
      domainTags: ["grid", "cfe", "procurement"],
      evidenceRefs: ["ppa://additionality", "grid://marginal-emissions"]
    });
  }

  return {
    finding: {
      agentId: "grid",
      stance,
      severity,
      headline: stance === "advance" ? "小时级 CFE 匹配良好，保持组合再平衡" : `CFE Score ${fmtPct(s.cfeScore)}，残余负荷 ${fmtPct(residual)} 待覆盖`,
      rationale: `年度匹配率 ${fmtPct(s.annualMatchRatio)}，但小时级 CFE Score=${fmtPct(s.cfeScore)}。通过小时级证书、PPA 组合与储能调度可覆盖近一半残余负荷；披露上严格保持 market-based 与 location-based 分离。`,
      metricsCited: [
        { key: "CFE Score", value: fmtPct(s.cfeScore) },
        { key: "REF", value: fmtPct(s.ref) }
      ],
      motionIds: motions.map((x) => x.id)
    },
    motions
  };
}

function computeAgent(s: CouncilState): AgentOutput {
  const target = 0.72;
  const gap = Math.max(0, target - s.gpuUtilization);
  const reachable = clamp(gap * 0.5);
  const abatement = round(s.annualBaselineTco2e * 0.22 * reachable);
  const stance: CouncilStance = s.gpuUtilization < 0.55 ? "caution" : s.gpuUtilization < 0.7 ? "optimize" : "advance";
  const severity = clamp(gap / 0.25);

  const motions: CouncilMotion[] = [
    {
      id: "m-compute-schedule",
      proposerId: "compute",
      title: "碳感知调度 + GPU bin-packing",
      lever: "carbon-aware scheduler",
      expectedImpact: `GPU 利用率由 ${fmtPct(s.gpuUtilization)} 提升到 ${fmtPct(target)}，可延迟训练迁移到低边际排放时段`,
      abatementTco2e: abatement,
      capexUsdK: 180,
      effort: 1,
      horizon: "quarter",
      constraints: ["训练队列等待 < 45 分钟", "推理 SLA 优先级锁定", "跨区路由受数据驻留约束"],
      confidence: 0.7,
      domainTags: ["compute", "scheduling", "physical"],
      evidenceRefs: ["scheduler://carbon-aware", "telemetry://gpu/util"]
    },
    {
      id: "m-compute-efficiency",
      proposerId: "compute",
      title: "模型量化、缓存复用与批处理合并",
      lever: "model quantization",
      expectedImpact: "降低单位 token SCI，减少重复计算",
      abatementTco2e: round(s.annualBaselineTco2e * 0.05),
      capexUsdK: 90,
      effort: 1,
      horizon: "quarter",
      constraints: ["精度损失阈值受验收约束", "缓存命中率监控"],
      confidence: 0.62,
      domainTags: ["compute", "efficiency", "physical"],
      evidenceRefs: ["sci://token", "cache://hit-rate"]
    }
  ];

  return {
    finding: {
      agentId: "compute",
      stance,
      severity,
      headline: stance === "advance" ? "加速卡利用率健康，聚焦模型效率" : `GPU 利用率 ${fmtPct(s.gpuUtilization)}，存在 ${fmtPct(gap)} 提升空间`,
      rationale: `当前 GPU 利用率 ${fmtPct(s.gpuUtilization)}。通过 bin-packing 与碳感知调度提升利用率并迁移可延迟负载，可在保持 SLA 的同时下降单位算力碳强度。`,
      metricsCited: [
        { key: "GPU util", value: fmtPct(s.gpuUtilization) },
        { key: "IT energy", value: `${round(s.itEnergyKwh).toLocaleString("zh-CN")} kWh/区间` }
      ],
      motionIds: motions.map((x) => x.id)
    },
    motions
  };
}

function complianceAgent(s: CouncilState): AgentOutput {
  const over = s.quotaUsedPercent > 100;
  const tight = s.quotaUsedPercent > 75 || s.forecastExceedance !== null;
  const stance: CouncilStance = over ? "block" : tight ? "caution" : s.quotaUsedPercent > 60 ? "monitor" : "advance";
  const severity = clamp(s.quotaUsedPercent / 100);

  const motions: CouncilMotion[] = [];
  if (tight || over) {
    motions.push({
      id: "m-compliance-guardrail",
      proposerId: "compliance",
      title: "配额护栏 + 碳价敞口对冲",
      lever: "quota guardrail",
      expectedImpact: `控制履约缺口，降低碳价风险敞口 (当前 $${round(s.carbonPriceRiskUsd / 1000)}k)`,
      abatementTco2e: 0,
      capexUsdK: 60,
      effort: 1,
      horizon: "now",
      constraints: ["护栏不得伪造物理减排", "对冲与披露需留痕"],
      confidence: 0.66,
      domainTags: ["compliance", "risk"],
      evidenceRefs: ["ets://exposure", "quota://forecast"]
    });
  }

  return {
    finding: {
      agentId: "compliance",
      stance,
      severity,
      headline: over
        ? "配额超限，需立即护栏与缓解"
        : tight
          ? `配额已用 ${round(s.quotaUsedPercent, 1)}%，存在履约风险`
          : `配额已用 ${round(s.quotaUsedPercent, 1)}%，轨迹可控`,
      rationale: `配额使用率 ${round(s.quotaUsedPercent, 1)}%，预测超限日=${s.forecastExceedance ?? "无"}。建议把所有物理减排议案优先级与科学配额轨迹挂钩，并对碳价敞口设置对冲。`,
      metricsCited: [
        { key: "Quota used", value: `${round(s.quotaUsedPercent, 1)}%` },
        { key: "Carbon price risk", value: `$${round(s.carbonPriceRiskUsd / 1000)}k` }
      ],
      motionIds: motions.map((x) => x.id)
    },
    motions
  };
}

function lifecycleAgent(s: CouncilState): AgentOutput {
  const abatement = round(s.annualBaselineTco2e * EMBODIED_SHARE * 0.22);
  const stance: CouncilStance = "optimize";
  const severity = 0.4;

  const motions: CouncilMotion[] = [
    {
      id: "m-lifecycle-lifetime",
      proposerId: "lifecycle",
      title: "硬件寿命延长 + 低碳采购",
      lever: "server lifetime extension",
      expectedImpact: `摊薄内含碳 (约占库存 ${fmtPct(EMBODIED_SHARE)})，降低 Scope 3 刷新峰值`,
      abatementTco2e: abatement,
      capexUsdK: -320,
      effort: 2,
      horizon: "year",
      constraints: ["故障率与能效退化阈值", "保修与备件可得性", "需 EPD/PCF 数据"],
      confidence: 0.58,
      domainTags: ["lifecycle", "embodied", "scope3"],
      evidenceRefs: ["lca://server/epd", "procurement://low-carbon"]
    }
  ];

  return {
    finding: {
      agentId: "lifecycle",
      stance,
      severity,
      headline: "延长硬件寿命可摊薄内含碳，但与算力扩张存在张力",
      rationale: `内含碳约占生命周期库存 ${fmtPct(EMBODIED_SHARE)}。在故障率与能效退化阈值内延长服务器寿命，并采购具备 EPD/PCF 的低碳硬件，可降低 Scope 3 刷新峰值。`,
      metricsCited: [
        { key: "Embodied share", value: fmtPct(EMBODIED_SHARE) },
        { key: "CUE", value: `${round(s.cue, 3)} kgCO2e/IT-kWh` }
      ],
      motionIds: motions.map((x) => x.id)
    },
    motions
  };
}

function accountingAgent(s: CouncilState): AgentOutput {
  const gap = s.locationKgPerInterval - s.marketKgPerInterval;
  const gapShare = s.locationKgPerInterval > 0 ? clamp(gap / s.locationKgPerInterval) : 0;
  const stance: CouncilStance = gapShare > 0.45 ? "caution" : "monitor";
  const severity = clamp(gapShare);

  const motions: CouncilMotion[] = [
    {
      id: "m-accounting-integrity",
      proposerId: "accounting",
      title: "双口径披露护栏 + 证书去重审计",
      lever: "dual-reporting guardrail",
      expectedImpact: "确保 market-based 收益不抵扣物理排放，CFE/SCI 仅用 location-based",
      abatementTco2e: 0,
      capexUsdK: 40,
      effort: 1,
      horizon: "now",
      constraints: ["证书去重与增量性核验", "method_version 留痕", "避免重复计算"],
      confidence: 0.8,
      domainTags: ["accounting", "integrity", "governance"],
      evidenceRefs: ["ghgp://scope2/dual", "registry://certificate-dedup"]
    }
  ];

  return {
    finding: {
      agentId: "accounting",
      stance,
      severity,
      headline: `location-based 与 market-based 差额 ${fmtPct(gapShare)}，需守住披露完整性`,
      rationale: `本区间 location-based=${round(s.locationKgPerInterval).toLocaleString("zh-CN")} kg，market-based=${round(s.marketKgPerInterval).toLocaleString("zh-CN")} kg，差额由证书/PPA 形成。议会任何减排主张都必须以 location-based 物理口径计量，market 收益单独披露。`,
      metricsCited: [
        { key: "LB emissions", value: `${round(s.locationKgPerInterval).toLocaleString("zh-CN")} kg` },
        { key: "MB emissions", value: `${round(s.marketKgPerInterval).toLocaleString("zh-CN")} kg` }
      ],
      motionIds: motions.map((x) => x.id)
    },
    motions
  };
}

// ---------------------------------------------------------------------------
// Chair: voting, conflict resolution, synthesis
// ---------------------------------------------------------------------------

const agentById = new Map(councilAgents.map((a) => [a.id, a]));

function voteOnMotion(motion: CouncilMotion, state: CouncilState): CouncilVote {
  const support: string[] = [];
  const oppose: string[] = [];
  const abstain: string[] = [];

  for (const agent of councilAgents) {
    if (agent.id === motion.proposerId) {
      support.push(agent.id);
      continue;
    }
    // Accounting abstains on pure market-procurement motions (no physical
    // delta) and supports physical-reduction motions.
    if (agent.id === "accounting") {
      if (motion.domainTags.includes("market") && !motion.domainTags.includes("physical")) {
        abstain.push(agent.id);
      } else {
        support.push(agent.id);
      }
      continue;
    }
    // Compliance supports anything that reduces physical emissions or risk.
    if (agent.id === "compliance") {
      if (motion.abatementTco2e > 0 || motion.domainTags.includes("risk")) {
        support.push(agent.id);
      } else {
        abstain.push(agent.id);
      }
      continue;
    }
    // Cooling guards thermal limits: opposes aggressive workload densification
    // proposed without thermal headroom (PUE already tight).
    if (agent.id === "cooling" && motion.id === "m-compute-schedule" && state.pue > 1.3) {
      oppose.push(agent.id);
      continue;
    }
    // Lifecycle opposes high-capex hardware-replacing motions when embodied
    // carbon of replacement is not justified by abatement.
    if (agent.id === "lifecycle" && motion.capexUsdK > 2000 && motion.abatementTco2e < state.annualBaselineTco2e * 0.05) {
      oppose.push(agent.id);
      continue;
    }
    // Grid supports clean-power and electrification motions, otherwise abstain.
    if (agent.id === "grid") {
      if (motion.domainTags.some((t) => ["grid", "cfe", "efficiency", "physical"].includes(t))) {
        support.push(agent.id);
      } else {
        abstain.push(agent.id);
      }
      continue;
    }
    // Default: support physical-reduction motions, abstain otherwise.
    if (motion.abatementTco2e > 0 || motion.domainTags.includes("physical")) {
      support.push(agent.id);
    } else {
      abstain.push(agent.id);
    }
  }

  const supportWeight = support.reduce((sum, id) => sum + (agentById.get(id)?.weight ?? 1), 0);
  const opposeWeight = oppose.reduce((sum, id) => sum + (agentById.get(id)?.weight ?? 1), 0);
  const totalWeight = councilAgents.reduce((sum, a) => sum + a.weight, 0);
  const weightedScore = round((supportWeight - opposeWeight) / totalWeight, 3);

  let consensus: VoteConsensus;
  if (oppose.length === 0 && abstain.length === 0) {
    consensus = "unanimous";
  } else if (oppose.length === 0) {
    consensus = "strong";
  } else if (oppose.length >= support.length) {
    consensus = "contested";
  } else {
    consensus = "split";
  }

  return { motionId: motion.id, support, oppose, abstain, weightedScore, consensus };
}

function detectConflicts(state: CouncilState, motions: CouncilMotion[]): CouncilConflict[] {
  const conflicts: CouncilConflict[] = [];
  const hasLiquid = motions.some((m) => m.id === "m-cooling-liquid");

  // Thermal vs compute densification.
  if (state.pue > 1.28 && motions.some((m) => m.id === "m-compute-schedule")) {
    conflicts.push({
      id: "c-thermal-density",
      title: "算力增密 vs 热约束",
      between: ["compute", "cooling"],
      description: "在 PUE 偏高时提升 GPU 利用率会增加机柜热负荷，冷源官担心触发热风险与 SLA 违规。",
      resolution: "先部署冷却 MPC（必要时液冷试点）建立热裕度，再分阶段提升利用率；调度器以进风温度与冷源裕度为硬约束。"
    });
  }

  // Market claims vs accounting integrity.
  if (state.cfeScore < 0.85) {
    conflicts.push({
      id: "c-market-integrity",
      title: "市场化采购 vs 物理口径完整性",
      between: ["grid", "accounting"],
      description: "电网官希望用小时级证书/PPA 快速改善披露，核算官要求这些收益不得抵扣 location-based 物理排放或 SCI。",
      resolution: "采纳 CFE 采购议案，但强制双口径披露护栏：market-based 单独列示，CFE Score 与 SCI 始终用 location-based 因子；所有证书需去重与增量性核验。"
    });
  }

  // Capex liquid cooling vs lifecycle embodied carbon.
  if (hasLiquid) {
    conflicts.push({
      id: "c-capex-embodied",
      title: "液冷资本投入 vs 内含碳与回收期",
      between: ["cooling", "lifecycle"],
      description: "液冷与余热回收带来运行减排，但新增设备的内含碳与高资本支出需要与回收期匹配。",
      resolution: "液冷先作为高密分区试点（pilot），以实测 PUE 与余热回收量校准回收期，再决定是否全量推广。"
    });
  }

  return conflicts;
}

function priorityFor(motion: CouncilMotion, vote: CouncilVote, state: CouncilState): "P0" | "P1" | "P2" {
  const abatementShare = motion.abatementTco2e / state.annualBaselineTco2e;
  const urgent = state.quotaUsedPercent > 75 || state.forecastExceedance !== null;
  if (motion.horizon === "now" && (motion.domainTags.includes("governance") || motion.domainTags.includes("risk"))) {
    return urgent || vote.consensus !== "contested" ? "P0" : "P1";
  }
  if (abatementShare >= 0.04 && motion.effort <= 2 && vote.weightedScore > 0.4) {
    return "P0";
  }
  if (abatementShare >= 0.01 || vote.weightedScore > 0.3) {
    return "P1";
  }
  return "P2";
}

function decisionFor(vote: CouncilVote, motion: CouncilMotion): "adopt" | "pilot" | "defer" {
  if (vote.consensus === "contested") return "defer";
  if (motion.effort === 3 || motion.confidence < 0.6 || vote.consensus === "split") return "pilot";
  return "adopt";
}

/** Run a full council deliberation over the normalized state. */
export function deliberate(state: CouncilState): CouncilSession {
  const outputs: AgentOutput[] = [
    accountingAgent(state),
    gridAgent(state),
    coolingAgent(state),
    computeAgent(state),
    complianceAgent(state),
    lifecycleAgent(state)
  ];

  const findings = outputs.map((o) => o.finding);
  const motions = outputs.flatMap((o) => o.motions);
  const votes = motions.map((m) => voteOnMotion(m, state));
  const voteByMotion = new Map(votes.map((v) => [v.motionId, v]));
  const conflicts = detectConflicts(state, motions);

  // Rank: passing motions first, by priority then abatement then low effort.
  const priorityRank = { P0: 0, P1: 1, P2: 2 };
  const ranked = motions
    .map((motion) => {
      const vote = voteByMotion.get(motion.id)!;
      const priority = priorityFor(motion, vote, state);
      return { motion, vote, priority };
    })
    .filter((r) => r.vote.weightedScore > -0.1)
    .sort((a, b) => {
      if (priorityRank[a.priority] !== priorityRank[b.priority]) {
        return priorityRank[a.priority] - priorityRank[b.priority];
      }
      if (b.motion.abatementTco2e !== a.motion.abatementTco2e) {
        return b.motion.abatementTco2e - a.motion.abatementTco2e;
      }
      return a.motion.effort - b.motion.effort;
    });

  const resolutions: CouncilResolution[] = ranked.map((r, index) => ({
    id: `r-${index + 1}`,
    rank: index + 1,
    motion: r.motion,
    vote: r.vote,
    priority: r.priority,
    decision: decisionFor(r.vote, r.motion),
    ownerId: r.motion.proposerId
  }));

  const totalAbatementTco2e = round(
    resolutions.filter((r) => r.decision !== "defer").reduce((sum, r) => sum + r.motion.abatementTco2e, 0)
  );

  // Alignment: how much of the budget-closing gap the adopted package covers,
  // tempered by compliance pressure.
  const abatementCoverage = clamp(totalAbatementTco2e / (state.annualBaselineTco2e * 0.5));
  const compliancePenalty = state.quotaUsedPercent > 100 ? 0.3 : state.quotaUsedPercent > 75 ? 0.15 : 0;
  const alignmentScore = clamp(0.45 + abatementCoverage * 0.55 - compliancePenalty);

  const avgConfidence = round(
    resolutions.length ? resolutions.reduce((s, r) => s + r.motion.confidence, 0) / resolutions.length : 0.6,
    2
  );

  const risks: string[] = [];
  if (state.quotaUsedPercent > 75) risks.push(`配额已用 ${round(state.quotaUsedPercent, 1)}%，履约窗口收紧`);
  if (state.cfeScore < 0.85) risks.push(`小时级 CFE Score ${fmtPct(state.cfeScore)}，残余负荷依赖电网`);
  if (state.pue > 1.28) risks.push(`PUE ${round(state.pue, 3)} 偏高，冷却电耗仍可压降`);
  if (state.carbonPriceRiskUsd > 0) risks.push(`碳价敞口约 $${round(state.carbonPriceRiskUsd / 1000)}k`);
  if (!risks.length) risks.push("各域指标处于绿区，维持治理节奏");

  const dissents = votes
    .filter((v) => v.oppose.length > 0)
    .map((v) => {
      const motion = motions.find((m) => m.id === v.motionId)!;
      const names = v.oppose.map((id) => agentById.get(id)?.nameZh ?? id).join("、");
      return `${names} 对「${motion.title}」保留意见（已通过冲突裁决约束）`;
    });

  const p0Count = resolutions.filter((r) => r.priority === "P0").length;
  const headline = `议会通过 ${resolutions.filter((r) => r.decision !== "defer").length} 项动议（${p0Count} 项 P0），预计年减排 ${totalAbatementTco2e.toLocaleString("zh-CN")} tCO2e，与 1.5℃ 站点配额对齐度 ${fmtPct(alignmentScore)}。所有物理减排以 location-based 计量，market 收益单独披露。`;

  return {
    generatedAt: state.generatedAt,
    siteId: state.siteId,
    agenda: "AIDC 站点季度降碳与履约治理审议",
    state,
    agents: councilAgents,
    findings,
    motions,
    votes,
    conflicts,
    resolutions,
    summary: {
      alignmentScore: round(alignmentScore, 3),
      totalAbatementTco2e,
      p0Count,
      headline,
      risks,
      dissents,
      confidence: avgConfidence
    }
  };
}

/** Convenience: build state from platform data and run the council. */
export function runCouncil(
  metrics: RealtimeMetrics,
  quota: QuotaStatus,
  matching: MatchingResult,
  gpuUtilization = 0.58
): CouncilSession {
  return deliberate(buildCouncilState(metrics, quota, matching, gpuUtilization));
}

export { CHAIR_ID, ANNUAL_BASELINE_TCO2E };
