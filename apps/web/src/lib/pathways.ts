export type PathwayHorizon = 2050 | 2100;

export type PathwayPoint = {
  year: number;
  physical: number;
  low: number;
  high: number;
  budget: number;
  market: number;
  cfe: number;
  embodied: number;
};

export type PathwayScenario = {
  id: string;
  name: string;
  category: string;
  shortLabel: string;
  description: string;
  compatible: boolean;
  levers: string[];
  anchors: Array<{
    year: number;
    physical: number;
    cfe: number;
    embodied: number;
    market: number;
    uncertainty: number;
  }>;
};

export type PathwayAssessment = {
  scenario: PathwayScenario;
  horizon: PathwayHorizon;
  points: PathwayPoint[];
  reduction2030: number;
  reduction2050: number;
  cumulativePhysical: number;
  cumulativeBudget: number;
  budgetOvershoot: number;
  overshootYears: number;
  firstOvershootYear: number | null;
  netZeroYear: number | null;
  peakPhysical: number;
  peakYear: number;
  cfe2030: number;
  cfe2050: number;
};

const START_YEAR = 2026;
const BASELINE_TCO2E = 2_050_000;

const alignedBudgetAnchors = [
  { year: 2026, value: 2_050_000 },
  { year: 2030, value: 1_025_000 },
  { year: 2040, value: 205_000 },
  { year: 2050, value: 0 },
  { year: 2100, value: 0 }
];

export const aidcPathwayScenarios: PathwayScenario[] = [
  {
    id: "current-policy",
    name: "Current operations",
    category: "Policy lag",
    shortLabel: "CurOps",
    compatible: false,
    description: "IT load growth is only partly offset by efficiency gains. Annual renewable matching improves disclosure, but hourly residual load remains high.",
    levers: ["incremental PUE improvement", "annual EAC matching", "standard refresh cycle", "limited workload shifting"],
    anchors: [
      { year: 2026, physical: 1, cfe: 0.42, embodied: 1, market: 0.72, uncertainty: 0.11 },
      { year: 2030, physical: 1.18, cfe: 0.52, embodied: 1.2, market: 0.58, uncertainty: 0.15 },
      { year: 2040, physical: 1.34, cfe: 0.66, embodied: 1.34, market: 0.41, uncertainty: 0.2 },
      { year: 2050, physical: 1.2, cfe: 0.72, embodied: 1.25, market: 0.31, uncertainty: 0.23 },
      { year: 2100, physical: 0.86, cfe: 0.78, embodied: 0.94, market: 0.22, uncertainty: 0.28 }
    ]
  },
  {
    id: "efficiency-first",
    name: "Efficiency-first AIDC",
    category: "Demand control",
    shortLabel: "Eff",
    compatible: false,
    description: "Cooling MPC, GPU utilization, model compression and hardware lifetime extension flatten physical emissions, but clean power is not fast enough for a 1.5C-aligned site budget.",
    levers: ["cooling digital twin + MPC", "GPU bin-packing", "model quantization", "server lifetime extension"],
    anchors: [
      { year: 2026, physical: 1, cfe: 0.42, embodied: 1, market: 0.72, uncertainty: 0.1 },
      { year: 2030, physical: 0.7, cfe: 0.58, embodied: 0.86, market: 0.45, uncertainty: 0.13 },
      { year: 2040, physical: 0.43, cfe: 0.72, embodied: 0.62, market: 0.26, uncertainty: 0.17 },
      { year: 2050, physical: 0.26, cfe: 0.8, embodied: 0.48, market: 0.14, uncertainty: 0.2 },
      { year: 2100, physical: 0.14, cfe: 0.86, embodied: 0.34, market: 0.08, uncertainty: 0.23 }
    ]
  },
  {
    id: "cfe-247",
    name: "24/7 CFE transition",
    category: "Clean power",
    shortLabel: "CFE",
    compatible: true,
    description: "Hourly CFE procurement, storage dispatch and grid-aware siting reduce physical residual load. Market-based disclosure stays separate from location-based control.",
    levers: ["hourly granular certificates", "PPA portfolio optimization", "battery dispatch", "regional carbon-aware siting"],
    anchors: [
      { year: 2026, physical: 1, cfe: 0.42, embodied: 1, market: 0.72, uncertainty: 0.1 },
      { year: 2030, physical: 0.52, cfe: 0.82, embodied: 0.9, market: 0.18, uncertainty: 0.12 },
      { year: 2040, physical: 0.12, cfe: 0.96, embodied: 0.58, market: 0.04, uncertainty: 0.15 },
      { year: 2050, physical: 0.02, cfe: 0.99, embodied: 0.34, market: 0.01, uncertainty: 0.16 },
      { year: 2100, physical: -0.04, cfe: 1, embodied: 0.12, market: 0, uncertainty: 0.18 }
    ]
  },
  {
    id: "flexible-ai",
    name: "Flexible AI workloads",
    category: "Load shifting",
    shortLabel: "FlexAI",
    compatible: true,
    description: "Training, batch inference and cache refresh jobs are shifted across hours and sites using carbon intensity, CFE availability and quota risk as scheduler constraints.",
    levers: ["carbon-aware scheduler", "multi-region workload routing", "storage-coupled queueing", "token/cache efficiency"],
    anchors: [
      { year: 2026, physical: 1, cfe: 0.42, embodied: 1, market: 0.72, uncertainty: 0.1 },
      { year: 2030, physical: 0.46, cfe: 0.78, embodied: 0.82, market: 0.2, uncertainty: 0.13 },
      { year: 2040, physical: 0.09, cfe: 0.94, embodied: 0.48, market: 0.04, uncertainty: 0.17 },
      { year: 2050, physical: -0.02, cfe: 0.98, embodied: 0.28, market: 0.01, uncertainty: 0.2 },
      { year: 2100, physical: -0.08, cfe: 1, embodied: 0.1, market: 0, uncertainty: 0.23 }
    ]
  },
  {
    id: "deep-retrofit",
    name: "Deep retrofit + storage",
    category: "Full-stack transition",
    shortLabel: "Retrofit",
    compatible: true,
    description: "Liquid cooling, heat reuse, firm CFE, lower-carbon hardware supply chains and long-duration storage are deployed together under strict SLA and thermal constraints.",
    levers: ["direct-to-chip liquid cooling", "waste heat recovery", "firm clean power", "low-carbon hardware procurement"],
    anchors: [
      { year: 2026, physical: 1, cfe: 0.42, embodied: 1, market: 0.72, uncertainty: 0.1 },
      { year: 2030, physical: 0.38, cfe: 0.84, embodied: 0.72, market: 0.15, uncertainty: 0.12 },
      { year: 2040, physical: 0.03, cfe: 0.98, embodied: 0.32, market: 0.02, uncertainty: 0.14 },
      { year: 2050, physical: -0.06, cfe: 1, embodied: 0.14, market: 0, uncertainty: 0.16 },
      { year: 2100, physical: -0.12, cfe: 1, embodied: 0.04, market: 0, uncertainty: 0.18 }
    ]
  },
  {
    id: "capacity-surge",
    name: "Unconstrained AI capacity surge",
    category: "High overshoot",
    shortLabel: "Surge",
    compatible: false,
    description: "AI demand expands faster than efficiency, clean power and embodied-carbon reductions. Procurement claims improve, but the physical site budget is persistently exceeded.",
    levers: ["fast capacity expansion", "diesel backup growth", "limited CFE deliverability", "short hardware refresh cycle"],
    anchors: [
      { year: 2026, physical: 1, cfe: 0.42, embodied: 1, market: 0.72, uncertainty: 0.12 },
      { year: 2030, physical: 1.55, cfe: 0.48, embodied: 1.68, market: 0.62, uncertainty: 0.2 },
      { year: 2040, physical: 1.9, cfe: 0.58, embodied: 2.1, market: 0.5, uncertainty: 0.28 },
      { year: 2050, physical: 1.65, cfe: 0.68, embodied: 1.85, market: 0.36, uncertainty: 0.33 },
      { year: 2100, physical: 1.2, cfe: 0.76, embodied: 1.3, market: 0.24, uncertainty: 0.36 }
    ]
  }
];

function interpolate(year: number, anchors: PathwayScenario["anchors"], key: keyof PathwayScenario["anchors"][number]) {
  const lower = [...anchors].reverse().find((anchor) => anchor.year <= year) ?? anchors[0];
  const upper = anchors.find((anchor) => anchor.year >= year) ?? anchors[anchors.length - 1];
  const lowerValue = Number(lower[key]);
  const upperValue = Number(upper[key]);
  if (upper.year === lower.year) {
    return lowerValue;
  }
  const t = (year - lower.year) / (upper.year - lower.year);
  return lowerValue + (upperValue - lowerValue) * t;
}

function alignedBudget(year: number, annualBaselineTco2e: number) {
  const value = interpolate(year, alignedBudgetAnchors.map((anchor) => ({ ...anchor, physical: anchor.value, cfe: 0, embodied: 0, market: 0, uncertainty: 0 })), "physical");
  return (value / BASELINE_TCO2E) * annualBaselineTco2e;
}

export function assessAidcPathway(
  scenarioId: string,
  horizon: PathwayHorizon,
  annualBaselineTco2e = BASELINE_TCO2E
): PathwayAssessment {
  const scenario = aidcPathwayScenarios.find((item) => item.id === scenarioId) ?? aidcPathwayScenarios[0];
  const years = Array.from({ length: horizon - START_YEAR + 1 }, (_, index) => START_YEAR + index);
  const points = years.map((year) => {
    const physical = interpolate(year, scenario.anchors, "physical") * annualBaselineTco2e;
    const uncertainty = interpolate(year, scenario.anchors, "uncertainty");
    return {
      year,
      physical,
      low: physical * (1 - uncertainty),
      high: physical * (1 + uncertainty),
      budget: alignedBudget(year, annualBaselineTco2e),
      market: interpolate(year, scenario.anchors, "market") * annualBaselineTco2e,
      cfe: interpolate(year, scenario.anchors, "cfe"),
      embodied: interpolate(year, scenario.anchors, "embodied") * annualBaselineTco2e
    };
  });

  const point2030 = points.find((point) => point.year === 2030) ?? points[points.length - 1];
  const point2050 = points.find((point) => point.year === 2050) ?? points[points.length - 1];
  const overshootPoints = points.filter((point) => point.physical > point.budget + 1);
  const cumulativePhysical = points.reduce((sum, point) => sum + Math.max(point.physical, 0), 0);
  const cumulativeBudget = points.reduce((sum, point) => sum + point.budget, 0);
  const peak = points.reduce((max, point) => (point.physical > max.physical ? point : max), points[0]);

  return {
    scenario,
    horizon,
    points,
    reduction2030: 1 - point2030.physical / annualBaselineTco2e,
    reduction2050: 1 - point2050.physical / annualBaselineTco2e,
    cumulativePhysical,
    cumulativeBudget,
    budgetOvershoot: Math.max(cumulativePhysical - cumulativeBudget, 0),
    overshootYears: overshootPoints.length,
    firstOvershootYear: overshootPoints[0]?.year ?? null,
    netZeroYear: points.find((point) => point.physical <= 0)?.year ?? null,
    peakPhysical: peak.physical,
    peakYear: peak.year,
    cfe2030: point2030.cfe,
    cfe2050: point2050.cfe
  };
}
