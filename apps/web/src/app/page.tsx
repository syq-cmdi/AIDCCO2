"use client";

import {
  AlertTriangle,
  BatteryCharging,
  Boxes,
  CheckCircle2,
  Cpu,
  Database,
  Download,
  Droplets,
  FileCheck2,
  Gauge,
  Globe2,
  HardDrive,
  Layers,
  Leaf,
  LineChart,
  Network,
  Sparkles,
  ServerCog,
  ShieldCheck,
  Zap
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import TwinScene from "../components/TwinScene";
import { loadChipSimulation, loadDigitalTwin, loadEfficiencySummary, loadMatching, loadOmniversePolicy, loadQuotaStatus, loadRealtimeMetrics, type ChipSimulationResponse, type DigitalTwinResponse, type EfficiencySummaryResponse, type MatchingResult, type OmniverseFidelityPolicy, type QuotaStatus, type RackTwin, type RealtimeMetrics } from "../lib/api";
import { cfeMatched, fallbackChipSimulation, fallbackDigitalTwin, fallbackEfficiencySummary, fallbackMatching, fallbackOmniversePolicy, fallbackQuota, fallbackRealtime, hourlyCarbon, hourlyLoad, optimizerItems } from "../lib/sample";
import { aidcPathwayScenarios, assessAidcPathway, type PathwayAssessment, type PathwayHorizon, type PathwayPoint } from "../lib/pathways";

type WorkbenchView = "pathway" | "twin" | "systems" | "quota" | "optimizer" | "efficiency" | "fidelity";

type MetricCardProps = {
  label: string;
  value: string;
  unit: string;
  helper: string;
  tone: "green" | "blue" | "amber" | "red" | "slate";
  icon: React.ReactNode;
};

const navItems = [
  { id: "pathway", icon: LineChart, label: "路径评测", helper: "AIDC 碳中和情景与科学配额" },
  { id: "twin", icon: Boxes, label: "机柜孪生", helper: "园区到 server/chip 的核查链" },
  { id: "systems", icon: Droplets, label: "机电与实时", helper: "冷源、电测、围护与负载" },
  { id: "quota", icon: ShieldCheck, label: "配额 / CFE", helper: "履约风险与 24/7 零碳匹配" },
  { id: "optimizer", icon: Cpu, label: "AI 降碳", helper: "优化建议、基线和安全约束" },
  { id: "efficiency", icon: Layers, label: "能效工程", helper: "虚拟化/热管理/储能/绿能/光网" },
  { id: "fidelity", icon: Sparkles, label: "真实感管线", helper: "Rhino / BIM / OpenUSD / RTX" }
] satisfies Array<{
  id: WorkbenchView;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  helper: string;
}>;

const viewIntro: Record<WorkbenchView, { eyebrow: string; title: string; body: string }> = {
  pathway: {
    eyebrow: "Tool 01 / Pathway evaluator",
    title: "AIDC 碳中和路径评测工具",
    body: "以站点+电网为核算边界，比较 physical emissions、科学配额、market-based 披露线与硬件 LCA，避免 offset 或 avoided emissions 抵扣物理排放。"
  },
  twin: {
    eyebrow: "Tool 02 / Rack-to-server audit",
    title: "机柜级数字孪生碳核查",
    body: "把园区、建筑、机房、机柜、server 与 chip 统一到同一条计量分摊链，支持点击机柜后查看 server 层电量、冷却分摊和 LCA。"
  },
  systems: {
    eyebrow: "Tool 03 / Realtime systems",
    title: "动环、冷源、电测与围护实时监控",
    body: "将 BMS/DCIM/EPMS 数据映射为 PUE、CUE、WUE、负载、碳强度和一次侧制冷状态，保留 method_version 与数据质量标记。"
  },
  quota: {
    eyebrow: "Tool 04 / Quota and 24/7 CFE",
    title: "配额履约与小时级零碳电力匹配",
    body: "把 ETS/内部预算/客户项目配额与小时级 CFE Score 放在同一工作区，同时保持 location-based 与 market-based 分开披露。"
  },
  optimizer: {
    eyebrow: "Tool 05 / AI decarbonization",
    title: "AI 降碳优化建议队列",
    body: "围绕冷却数字孪生、碳感知调度、GPU 利用率与模型效率给出可执行建议，并显示预期收益与约束条件。"
  },
  efficiency: {
    eyebrow: "Tool 06 / Cross-layer efficiency",
    title: "跨层能效工程（虚拟化·热管理·储能·绿能·光网）",
    body: "把工作负载共置、主动热管理、分布式磷酸铁锂储能削峰、绿能感知广域路由与高速光网整合为同一套软件定义能效引擎；能效估算仅作运营指导，不抵扣已审计的物理排放。"
  },
  fidelity: {
    eyebrow: "Tool 07 / Photoreal twin pipeline",
    title: "工程级高真实感数字孪生管线",
    body: "整合 Rhino、IFC/BIM、点云、Speckle、OpenUSD 与 Omniverse 风格渲染，服务于工程审计和大屏展示两类场景。"
  }
};

const quickStats = [
  { label: "路径评测", value: "6", unit: "scenarios" },
  { label: "核查层级", value: "6", unit: "campus-chip" },
  { label: "披露口径", value: "2", unit: "LB / MB" },
  { label: "刷新目标", value: "<5", unit: "min" }
];

function formatNumber(value: number, digits = 1) {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  }).format(value);
}

function getMetric(metrics: RealtimeMetrics, key: string, fallback = 0) {
  return metrics.metrics[key]?.value ?? fallback;
}

function MetricCard({ label, value, unit, helper, tone, icon }: MetricCardProps) {
  return (
    <section className={`metric-card ${tone}`}>
      <div className="metric-card__top">
        <span>{label}</span>
        <span className="metric-card__icon">{icon}</span>
      </div>
      <div className="metric-card__value">
        {value}
        <small>{unit}</small>
      </div>
      <p>{helper}</p>
    </section>
  );
}

function BuptPortalEntry() {
  return (
    <section className="bupt-entry">
      <div>
        <span className="eyebrow">BUPT.AI Secondary Site</span>
        <h2>北邮 AI · AIDC 碳中和数字孪生子站</h2>
        <p>面向 bupt.ai 发布的二级站入口，集中展示 AIDC 机柜级碳核查、园区大屏、动环监控和路径评测工具。</p>
      </div>
      <div className="bupt-entry__actions">
        <a className="bupt-entry__primary" href="/bupt-ai">
          进入 BUPT.AI 子站
        </a>
        <span>可绑定: bupt.ai/aidcco2 · aidcco2.bupt.ai</span>
      </div>
    </section>
  );
}

function Sparkline({ points, color }: { points: number[]; color: string }) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const path = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * 100;
      const y = 70 - ((point - min) / Math.max(max - min, 1)) * 56;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg className="sparkline" viewBox="0 0 100 80" preserveAspectRatio="none" aria-hidden="true">
      <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function HourlyBars() {
  const maxLoad = Math.max(...hourlyLoad);
  return (
    <div className="hourly-bars" aria-label="24小时负载与CFE匹配">
      {hourlyLoad.map((load, index) => {
        const matched = cfeMatched[index];
        return (
          <div className="hour-slot" key={`${load}-${index}`}>
            <div className="hour-slot__load" style={{ height: `${Math.max((load / maxLoad) * 100, 8)}%` }}>
              <span style={{ height: `${Math.min((matched / load) * 100, 100)}%` }} />
            </div>
            <small>{index % 4 === 0 ? `${index}` : ""}</small>
          </div>
        );
      })}
    </div>
  );
}

function QuotaPanel({ quota }: { quota: QuotaStatus }) {
  const used = Math.min(quota.used_percent, 100);
  return (
    <section className="panel quota-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Quota Monitor</span>
          <h2>配额与履约风险</h2>
        </div>
        <ShieldCheck size={22} />
      </div>
      <div className="quota-meter">
        <div className="quota-meter__bar">
          <span style={{ width: `${used}%` }} />
        </div>
        <strong>{formatNumber(quota.used_percent, 1)}%</strong>
      </div>
      <div className="quota-grid">
        <div>
          <span>已用排放</span>
          <strong>{formatNumber(quota.used_kg_co2e / 1000, 0)} tCO2e</strong>
        </div>
        <div>
          <span>剩余额度</span>
          <strong>{formatNumber(quota.remaining_kg_co2e / 1000, 0)} tCO2e</strong>
        </div>
        <div>
          <span>履约缺口</span>
          <strong>{formatNumber(quota.compliance_gap_kg_co2e / 1000, 0)} tCO2e</strong>
        </div>
        <div>
          <span>碳价风险</span>
          <strong>${formatNumber(quota.carbon_price_risk_usd, 0)}</strong>
        </div>
      </div>
    </section>
  );
}

function MatchingPanel({ matching }: { matching: MatchingResult }) {
  return (
    <section className="panel matching-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Renewable Matching</span>
          <h2>小时级零碳电力匹配</h2>
        </div>
        <BatteryCharging size={22} />
      </div>
      <div className="cfe-score">
        <div>
          <span>24/7 CFE Score</span>
          <strong>{formatNumber(matching.cfe_score * 100, 1)}%</strong>
        </div>
        <div>
          <span>年度匹配</span>
          <strong>{formatNumber(matching.annual_match_ratio * 100, 0)}%</strong>
        </div>
      </div>
      <HourlyBars />
      <div className="matching-footer">
        <span>{formatNumber(matching.avoided_emissions_kg_co2e / 1000, 1)} tCO2e avoided</span>
        <span>{formatNumber(matching.unmatched_load_kwh, 0)} kWh unmatched</span>
      </div>
    </section>
  );
}

function formatTco2e(value: number, digits = 1) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${formatNumber(value / 1_000_000, digits)} MtCO2e`;
  }
  if (abs >= 1_000) {
    return `${formatNumber(value / 1_000, digits)} ktCO2e`;
  }
  return `${formatNumber(value, 0)} tCO2e`;
}

function buildPath(points: PathwayPoint[], key: keyof PathwayPoint, xScale: (year: number) => number, yScale: (value: number) => number) {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${xScale(point.year).toFixed(2)} ${yScale(Number(point[key])).toFixed(2)}`)
    .join(" ");
}

function PathwayChart({ assessment }: { assessment: PathwayAssessment }) {
  const { points } = assessment;
  const width = 920;
  const height = 360;
  const pad = { left: 74, right: 24, top: 28, bottom: 46 };
  const years = points.map((point) => point.year);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const minValue = Math.min(0, ...points.map((point) => point.low));
  const maxValue = Math.max(...points.flatMap((point) => [point.high, point.budget, point.embodied])) * 1.08;
  const xScale = (year: number) => pad.left + ((year - minYear) / Math.max(maxYear - minYear, 1)) * (width - pad.left - pad.right);
  const yScale = (value: number) => pad.top + (1 - (value - minValue) / Math.max(maxValue - minValue, 1)) * (height - pad.top - pad.bottom);
  const uncertainty =
    points.map((point) => `${xScale(point.year).toFixed(2)},${yScale(point.high).toFixed(2)}`).join(" ") +
    " " +
    [...points].reverse().map((point) => `${xScale(point.year).toFixed(2)},${yScale(point.low).toFixed(2)}`).join(" ");
  const ticks = assessment.horizon === 2050 ? [2026, 2030, 2035, 2040, 2045, 2050] : [2026, 2030, 2040, 2050, 2075, 2100];
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => minValue + (maxValue - minValue) * fraction);

  return (
    <svg className="pathway-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="AIDC carbon neutrality pathway chart">
      <defs>
        <linearGradient id="pathway-uncertainty" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#2364aa" stopOpacity="0.24" />
          <stop offset="100%" stopColor="#2364aa" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      {yTicks.map((tick) => (
        <g key={tick}>
          <line x1={pad.left} x2={width - pad.right} y1={yScale(tick)} y2={yScale(tick)} />
          <text x={pad.left - 12} y={yScale(tick) + 4} textAnchor="end">{formatTco2e(tick, 1).replace("CO2e", "")}</text>
        </g>
      ))}
      <polygon points={uncertainty} fill="url(#pathway-uncertainty)" />
      <path className="pathway-chart__budget" d={buildPath(points, "budget", xScale, yScale)} />
      <path className="pathway-chart__market" d={buildPath(points, "market", xScale, yScale)} />
      <path className="pathway-chart__embodied" d={buildPath(points, "embodied", xScale, yScale)} />
      <path className="pathway-chart__physical" d={buildPath(points, "physical", xScale, yScale)} />
      {points.filter((point) => point.year % 5 === 0 || point.year === minYear || point.year === maxYear).map((point) => {
        const exceeds = point.physical > point.budget;
        return (
          <rect
            className={exceeds ? "pathway-chart__overshoot active" : "pathway-chart__overshoot"}
            height="8"
            key={point.year}
            rx="3"
            width={Math.max((width - pad.left - pad.right) / points.length - 1, 2)}
            x={xScale(point.year) - 3}
            y={height - 28}
          />
        );
      })}
      {ticks.map((year) => (
        <text key={year} x={xScale(year)} y={height - 9} textAnchor="middle">{year}</text>
      ))}
      <text className="pathway-chart__axis" x={pad.left} y={18}>annual physical emissions, tCO2e</text>
      <text className="pathway-chart__threshold" x={xScale(2050)} y={yScale(0) - 10} textAnchor="middle">net-zero line</text>
    </svg>
  );
}

function PathwayPanel({
  assessment,
  horizon,
  scenarioId,
  annualBaselineTco2e,
  onHorizonChange,
  onScenarioChange
}: {
  assessment: PathwayAssessment;
  horizon: PathwayHorizon;
  scenarioId: string;
  annualBaselineTco2e: number;
  onHorizonChange: (horizon: PathwayHorizon) => void;
  onScenarioChange: (scenarioId: string) => void;
}) {
  const overshootLabel = assessment.firstOvershootYear
    ? `${assessment.firstOvershootYear} 起 ${assessment.overshootYears} 年`
    : "未超标";
  const netZeroLabel = assessment.netZeroYear ? String(assessment.netZeroYear) : "未达成";

  return (
    <section className="panel pathway-panel" id="路径评测">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Carbon-neutrality pathway evaluator</span>
          <h2>AIDC 情景路径与科学配额评测</h2>
        </div>
        <LineChart size={22} />
      </div>
      <div className="pathway-controls">
        <label>
          <span>情景</span>
          <select value={scenarioId} onChange={(event) => onScenarioChange(event.target.value)}>
            {aidcPathwayScenarios.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.name}
              </option>
            ))}
          </select>
        </label>
        <div className="pathway-toggle" aria-label="评测时间范围">
          {[2050, 2100].map((year) => (
            <button className={horizon === year ? "active" : ""} key={year} onClick={() => onHorizonChange(year as PathwayHorizon)} type="button">
              {year}
            </button>
          ))}
        </div>
        <div className="pathway-baseline">
          <span>当前年化基线</span>
          <strong>{formatTco2e(annualBaselineTco2e, 2)}</strong>
        </div>
      </div>
      <div className="pathway-layout">
        <div className="pathway-plot">
          <PathwayChart assessment={assessment} />
          <div className="pathway-legend">
            <span><i className="physical" />location-based 物理排放</span>
            <span><i className="budget" />科学配额路径</span>
            <span><i className="market" />market-based 披露线</span>
            <span><i className="embodied" />硬件与建筑 LCA</span>
            <span><i className="band" />情景不确定性</span>
          </div>
        </div>
        <aside className="pathway-summary">
          <div className={assessment.scenario.compatible ? "scenario-badge compatible" : "scenario-badge"}>
            <strong>{assessment.scenario.shortLabel}</strong>
            <span>{assessment.scenario.category}</span>
          </div>
          <p>{assessment.scenario.description}</p>
          <div className="pathway-keyfigures">
            <div>
              <span>2030 vs 基线</span>
              <strong>{formatNumber(assessment.reduction2030 * 100, 1)}%</strong>
            </div>
            <div>
              <span>2050 vs 基线</span>
              <strong>{formatNumber(assessment.reduction2050 * 100, 1)}%</strong>
            </div>
            <div>
              <span>净零年份</span>
              <strong>{netZeroLabel}</strong>
            </div>
            <div>
              <span>超配额期</span>
              <strong>{overshootLabel}</strong>
            </div>
            <div>
              <span>累计超额</span>
              <strong>{formatTco2e(assessment.budgetOvershoot, 1)}</strong>
            </div>
            <div>
              <span>2050 CFE</span>
              <strong>{formatNumber(assessment.cfe2050 * 100, 0)}%</strong>
            </div>
          </div>
        </aside>
      </div>
      <div className="pathway-levers">
        {assessment.scenario.levers.map((lever) => (
          <span key={lever}>{lever}</span>
        ))}
      </div>
      <p className="pathway-note">
        该评测借鉴 Carbon Brief 交互式路径工具的场景选择、阈值超标期、不确定性区间和关键指标卡设计，但研究对象限定为 AIDC 站点+电网边界；offset 和 avoided emissions 不抵扣物理排放路径。
      </p>
    </section>
  );
}

function flattenRacks(twin: DigitalTwinResponse) {
  return twin.campus.buildings.flatMap((building) => building.rooms.flatMap((room) => room.racks));
}

function ToolchainPanel({ twin }: { twin: DigitalTwinResponse }) {
  return (
    <section className="panel toolchain-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Model Toolchain</span>
          <h2>Rhino / BIM / 点云接入</h2>
        </div>
        <Download size={22} />
      </div>
      <div className="tool-list">
        {twin.model_sources.slice(0, 5).map((source) => (
          <a href={source.official_url} key={source.name} target="_blank" rel="noreferrer">
            <strong>{source.name}</strong>
            <span>{source.connector}</span>
            <small>{source.integration_status.replaceAll("_", " ")}</small>
          </a>
        ))}
      </div>
    </section>
  );
}

function FidelityPolicyPanel({ policy }: { policy: OmniverseFidelityPolicy }) {
  const statusTone = {
    pass: "pass",
    warning: "warn",
    blocked: "block",
    not_applicable: "mute"
  } as const;

  return (
    <section className="panel fidelity-panel" id="真实感">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Omniverse-Grade Fidelity</span>
          <h2>以假乱真级 OpenUSD / RTX 方针</h2>
        </div>
        <Sparkles size={22} />
      </div>
      <div className="fidelity-layout">
        <div className="fidelity-brief">
          <p>{policy.target_fidelity}</p>
          <div className="uri-list">
            <span>USD: {policy.usd_stage_uri}</span>
            <span>Web: {policy.web_runtime_uri}</span>
          </div>
          <div className="renderer-list">
            {policy.renderer_modes.map((mode) => (
              <span key={mode}>{mode}</span>
            ))}
          </div>
        </div>
        <div className="policy-list">
          {policy.policy_principles.slice(0, 4).map((item) => (
            <span key={item}><CheckCircle2 size={15} />{item}</span>
          ))}
        </div>
      </div>
      <div className="fidelity-grid">
        <div>
          <h3>Photoreal Tools</h3>
          {policy.tool_integrations.slice(0, 6).map((tool) => (
            <a href={tool.official_url} key={tool.name} rel="noreferrer" target="_blank">
              <strong>{tool.name}</strong>
              <span>{tool.category} · {tool.runtime_status}</span>
              <small>{tool.connector}</small>
            </a>
          ))}
        </div>
        <div>
          <h3>Pipeline</h3>
          {policy.pipeline_stages.map((stage) => (
            <article key={stage.stage_id}>
              <strong>{stage.name}</strong>
              <span>{stage.owner} · {stage.status}</span>
              <small>{stage.automation_endpoint}</small>
            </article>
          ))}
        </div>
        <div>
          <h3>Quality Gates</h3>
          {policy.quality_gates.map((gate) => (
            <article className={`gate ${statusTone[gate.status]}`} key={gate.gate_id}>
              <strong>{gate.name}</strong>
              <span>{gate.current}</span>
              <small>{gate.target}</small>
            </article>
          ))}
        </div>
        <div>
          <h3>Accounting Tools</h3>
          {policy.accounting_integrations.slice(0, 5).map((tool) => (
            <a href={tool.official_url} key={tool.name} rel="noreferrer" target="_blank">
              <strong>{tool.name}</strong>
              <span>{tool.domain} · {tool.runtime_status}</span>
              <small>{tool.connector}</small>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function ServerAuditPanel({ twin, selectedRack }: { twin: DigitalTwinResponse; selectedRack: RackTwin }) {
  const serverLines = twin.server_layer_audit
    .filter((line) => line.node_level === "server" && line.parent_id === selectedRack.id)
    .sort((a, b) => b.total_location_kg - a.total_location_kg);

  return (
    <section className="panel audit-panel" id="Server核查">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Server Layer Audit</span>
          <h2>{selectedRack.name} 碳核查分摊</h2>
        </div>
        <HardDrive size={22} />
      </div>
      <div className="audit-table">
        <div className="audit-row audit-row--head">
          <span>Server</span>
          <span>kWh</span>
          <span>冷却</span>
          <span>LB kg</span>
          <span>LCA kg</span>
          <span>质量</span>
        </div>
        {serverLines.map((line) => (
          <div className="audit-row" key={line.node_id}>
            <span title={line.node_id}>{line.node_id.split("-").slice(-2).join("-")}</span>
            <span>{formatNumber(line.energy_kwh, 2)}</span>
            <span>{formatNumber(line.cooling_overhead_kwh, 2)}</span>
            <span>{formatNumber(line.scope2_location_kg, 2)}</span>
            <span>{formatNumber(line.embodied_kg, 2)}</span>
            <span>{line.data_quality_flag}</span>
          </div>
        ))}
      </div>
      <div className="audit-footer">
        <span>路径: facility meter &gt; room busway &gt; rack PDU &gt; server power</span>
        <span>method {serverLines[0]?.method_version ?? "rack-server-twin-carbon-audit-v0.1"}</span>
      </div>
    </section>
  );
}

function EnvelopePanel({ twin }: { twin: DigitalTwinResponse }) {
  const totalArea = twin.envelope_components.reduce((sum, item) => sum + item.area_m2, 0);
  const totalEmbodied = twin.envelope_components.reduce((sum, item) => sum + item.embodied_kg_co2e, 0);
  return (
    <section className="panel envelope-panel" id="围护">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Envelope Twin</span>
          <h2>围护结构与材料核查</h2>
        </div>
        <Globe2 size={22} />
      </div>
      <div className="system-kpis">
        <div>
          <span>构件面积</span>
          <strong>{formatNumber(totalArea, 0)} m2</strong>
        </div>
        <div>
          <span>围护 LCA</span>
          <strong>{formatNumber(totalEmbodied / 1000, 1)} tCO2e</strong>
        </div>
        <div>
          <span>实测点</span>
          <strong>{twin.envelope_components.reduce((sum, item) => sum + item.sensor_refs.length, 0)}</strong>
        </div>
      </div>
      <div className="system-list">
        {twin.envelope_components.map((item) => (
          <article key={item.id}>
            <strong>{item.component_type.replaceAll("_", " ")}</strong>
            <span>{item.material}</span>
            <small>U {formatNumber(item.u_value_w_m2k, 2)} W/m2K · {formatNumber(item.surface_temp_c, 1)} C · {item.leakage_class}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function MepSystemsPanel({ twin }: { twin: DigitalTwinResponse }) {
  const coolingPower = twin.primary_cooling_system.reduce((sum, item) => sum + item.current_kw, 0);
  const electricalLoss = twin.electrical_metering_system.reduce((sum, item) => sum + item.loss_kw, 0);
  return (
    <section className="panel mep-panel" id="机电">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Primary Cooling + Metering</span>
          <h2>一次侧制冷与电测系统</h2>
        </div>
        <Zap size={22} />
      </div>
      <div className="system-kpis">
        <div>
          <span>制冷用电</span>
          <strong>{formatNumber(coolingPower, 1)} kW</strong>
        </div>
        <div>
          <span>电测损耗</span>
          <strong>{formatNumber(electricalLoss, 1)} kW</strong>
        </div>
        <div>
          <span>计量链</span>
          <strong>{twin.electrical_metering_system.length} nodes</strong>
        </div>
      </div>
      <div className="mep-columns">
        <div className="system-list">
          {twin.primary_cooling_system.map((item) => (
            <article key={item.id}>
              <strong>{item.name}</strong>
              <span>{item.loop.replaceAll("_", " ")} · {item.status}</span>
              <small>{formatNumber(item.current_kw, 1)} kW · {formatNumber(item.flow_lps, 1)} L/s · {formatNumber(item.supply_temp_c, 1)} / {formatNumber(item.return_temp_c, 1)} C</small>
            </article>
          ))}
        </div>
        <div className="system-list">
          {twin.electrical_metering_system.map((item) => (
            <article key={item.id}>
              <strong>{item.name}</strong>
              <span>{item.equipment_type.replaceAll("_", " ")} · {item.meter_class}</span>
              <small>{formatNumber(item.real_power_kw, 1)} kW · PF {formatNumber(item.power_factor, 2)} · loss {formatNumber(item.loss_kw, 2)} kW</small>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ChipSimulationPanel({ simulation }: { simulation: ChipSimulationResponse }) {
  const maxTemp = Math.max(...simulation.chips.map((chip) => chip.hotspot_temp_c), 1);
  return (
    <section className="panel chip-panel" id="芯片">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Chip-Level Simulation</span>
          <h2>{simulation.server_id.split("-").slice(-2).join("-")} 芯片级热-电-碳孪生</h2>
        </div>
        <Cpu size={22} />
      </div>
      <div className="system-kpis chip-kpis">
        <div>
          <span>芯片功率</span>
          <strong>{formatNumber(simulation.total_chip_power_kw, 2)} kW</strong>
        </div>
        <div>
          <span>最高热点</span>
          <strong>{formatNumber(simulation.max_hotspot_temp_c, 1)} C</strong>
        </div>
        <div>
          <span>冷板流量</span>
          <strong>{formatNumber(simulation.coolant_flow_lpm, 1)} L/min</strong>
        </div>
        <div>
          <span>步长</span>
          <strong>{simulation.timestep_ms} ms</strong>
        </div>
      </div>
      <div className="chip-heatmap" aria-label="芯片热点与功率">
        {simulation.chips.map((chip) => {
          const intensity = Math.min(chip.hotspot_temp_c / maxTemp, 1);
          return (
            <div
              key={chip.id}
              style={{ backgroundColor: `hsl(${160 - intensity * 120} 62% ${48 - intensity * 10}%)` }}
              title={`${chip.name}: ${formatNumber(chip.hotspot_temp_c, 1)} C`}
            >
              <strong>{chip.name}</strong>
              <span>{formatNumber(chip.current_power_w, 0)} W</span>
            </div>
          );
        })}
      </div>
      <div className="chip-table">
        {simulation.chips.slice(0, 8).map((chip) => (
          <article key={chip.id}>
            <span>{chip.chip_type.toUpperCase()}</span>
            <strong>{chip.name}</strong>
            <small>{formatNumber(chip.junction_temp_c, 1)} C J · {formatNumber(chip.carbon_kg_co2e_per_hour, 3)} kg/h · util {formatNumber(chip.utilization * 100, 0)}%</small>
          </article>
        ))}
      </div>
      <p className="method-note">{simulation.solver_method}</p>
    </section>
  );
}

function RackInspector({ rack }: { rack: RackTwin }) {
  const utilization = rack.servers.reduce((sum, server) => sum + server.utilization, 0) / rack.servers.length;
  return (
    <div className="rack-inspector">
      <div>
        <span className="eyebrow">Selected Rack</span>
        <h3>{rack.name}</h3>
      </div>
      <div className="rack-stat-grid">
        <div>
          <span>实时功率</span>
          <strong>{formatNumber(rack.current_kw, 1)} kW</strong>
        </div>
        <div>
          <span>碳排放率</span>
          <strong>{formatNumber(rack.carbon_kg_co2e_per_hour, 2)} kg/h</strong>
        </div>
        <div>
          <span>进/出风温</span>
          <strong>{formatNumber(rack.inlet_temp_c, 1)} / {formatNumber(rack.outlet_temp_c, 1)} C</strong>
        </div>
        <div>
          <span>平均利用率</span>
          <strong>{formatNumber(utilization * 100, 0)}%</strong>
        </div>
      </div>
      <div className="server-strip">
        {rack.servers.map((server) => (
          <span
            key={server.id}
            style={{ height: `${Math.max(server.utilization * 100, 12)}%` }}
            title={`${server.name}: ${formatNumber(server.current_power_kw, 2)} kW`}
          />
        ))}
      </div>
      <p>{rack.geometry_ref}</p>
    </div>
  );
}

function EfficiencyPanel({ summary }: { summary: EfficiencySummaryResponse }) {
  const formatLeverValue = (metric: string, value: number) =>
    metric.endsWith("_x") ? `${formatNumber(value, 1)}×` : `${formatNumber(value * 100, 0)}%`;

  return (
    <section className="panel efficiency-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Cross-layer Efficiency</span>
          <h2>跨层能效工程引擎</h2>
        </div>
        <Layers size={22} />
      </div>
      <div className="efficiency-grid">
        {summary.levers.map((lever) => (
          <article className="efficiency-card" key={lever.lever}>
            <h3>{lever.title}</h3>
            <div className="efficiency-card__value">
              <strong>{formatLeverValue(lever.primary_metric, lever.primary_value)}</strong>
              <small>参考 {formatLeverValue(lever.primary_metric, lever.reference_value)}</small>
            </div>
            <p className="efficiency-card__headline">{lever.headline}</p>
            <p className="efficiency-card__insight">{lever.insight}</p>
            <code>{lever.endpoint}</code>
          </article>
        ))}
      </div>
      <div className="efficiency-insights">
        <h3>关联见解</h3>
        <ul>
          {summary.cross_layer_insights.map((insight) => (
            <li key={insight}>{insight}</li>
          ))}
        </ul>
      </div>
      <ul className="efficiency-constraints">
        {summary.safety_constraints.map((constraint) => (
          <li key={constraint}>
            <ShieldCheck size={14} />
            {constraint}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<RealtimeMetrics>(fallbackRealtime);
  const [quota, setQuota] = useState<QuotaStatus>(fallbackQuota);
  const [matching, setMatching] = useState<MatchingResult>(fallbackMatching);
  const [digitalTwin, setDigitalTwin] = useState<DigitalTwinResponse>(fallbackDigitalTwin);
  const [omniversePolicy, setOmniversePolicy] = useState<OmniverseFidelityPolicy>(fallbackOmniversePolicy);
  const [chipSimulation, setChipSimulation] = useState<ChipSimulationResponse>(fallbackChipSimulation);
  const [efficiency, setEfficiency] = useState<EfficiencySummaryResponse>(fallbackEfficiencySummary);
  const [selectedRackId, setSelectedRackId] = useState<string>(fallbackDigitalTwin.campus.buildings[0].rooms[0].racks[0].id);
  const [selectedPathwayId, setSelectedPathwayId] = useState<string>(aidcPathwayScenarios[0].id);
  const [pathwayHorizon, setPathwayHorizon] = useState<PathwayHorizon>(2050);
  const [activeView, setActiveView] = useState<WorkbenchView>("pathway");

  useEffect(() => {
    let isMounted = true;
    Promise.all([loadRealtimeMetrics(), loadQuotaStatus(), loadMatching(), loadDigitalTwin(), loadOmniversePolicy(), loadEfficiencySummary()]).then(([metricsResult, quotaResult, matchingResult, twinResult, policyResult, efficiencyResult]) => {
      if (!isMounted) {
        return;
      }
      if (metricsResult) setMetrics(metricsResult);
      if (quotaResult) setQuota(quotaResult);
      if (matchingResult) setMatching(matchingResult);
      if (twinResult) {
        setDigitalTwin(twinResult);
        const firstRack = flattenRacks(twinResult)[0];
        if (firstRack) {
          setSelectedRackId(firstRack.id);
        }
      }
      if (policyResult) setOmniversePolicy(policyResult);
      if (efficiencyResult) setEfficiency(efficiencyResult);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const metricCards = useMemo(
    () => [
      {
        label: "PUE",
        value: formatNumber(getMetric(metrics, "pue"), 2),
        unit: "",
        helper: "ISO/IEC 30134",
        tone: "green" as const,
        icon: <Gauge size={18} />
      },
      {
        label: "CUE",
        value: formatNumber(getMetric(metrics, "cue"), 2),
        unit: "kg/IT-kWh",
        helper: "location-based",
        tone: "blue" as const,
        icon: <Globe2 size={18} />
      },
      {
        label: "WUE",
        value: formatNumber(getMetric(metrics, "wue"), 2),
        unit: "L/IT-kWh",
        helper: "冷却水效率",
        tone: "slate" as const,
        icon: <Droplets size={18} />
      },
      {
        label: "REF",
        value: formatNumber(getMetric(metrics, "ref") * 100, 0),
        unit: "%",
        helper: "可再生能源因子",
        tone: "amber" as const,
        icon: <Leaf size={18} />
      },
      {
        label: "Scope 2 LB",
        value: formatNumber(getMetric(metrics, "location_based_emissions_kg") / 1000, 1),
        unit: "tCO2e",
        helper: "物理电网口径",
        tone: "red" as const,
        icon: <Zap size={18} />
      }
    ],
    [metrics]
  );
  const allRacks = useMemo(() => flattenRacks(digitalTwin), [digitalTwin]);
  const selectedRack = allRacks.find((rack) => rack.id === selectedRackId) ?? allRacks[0];
  const annualBaselineTco2e = useMemo(() => {
    const intervalKg = getMetric(metrics, "location_based_emissions_kg", fallbackRealtime.metrics.location_based_emissions_kg.value);
    const intervalMinutes = Math.max(metrics.interval_minutes, 1);
    return Math.max((intervalKg * (60 / intervalMinutes) * 24 * 365) / 1000, 1);
  }, [metrics]);
  const pathwayAssessment = useMemo(
    () => assessAidcPathway(selectedPathwayId, pathwayHorizon, annualBaselineTco2e),
    [annualBaselineTco2e, pathwayHorizon, selectedPathwayId]
  );
  const activeIntro = viewIntro[activeView];

  useEffect(() => {
    if (!selectedRack) {
      return;
    }
    const firstServer = selectedRack.servers[0];
    if (!firstServer) {
      return;
    }
    let isMounted = true;
    loadChipSimulation(digitalTwin.site_id, selectedRack.id, firstServer.id).then((result) => {
      if (!isMounted) {
        return;
      }
      if (result) {
        setChipSimulation(result);
        return;
      }
      setChipSimulation({
        ...fallbackChipSimulation,
        generated_at: new Date().toISOString(),
        site_id: digitalTwin.site_id,
        rack_id: selectedRack.id,
        server_id: firstServer.id,
        total_chip_power_kw: Number((firstServer.chips.reduce((sum, chip) => sum + chip.current_power_w, 0) / 1000).toFixed(6)),
        max_junction_temp_c: Math.max(0, ...firstServer.chips.map((chip) => chip.junction_temp_c)),
        max_hotspot_temp_c: Math.max(0, ...firstServer.chips.map((chip) => chip.hotspot_temp_c)),
        coolant_flow_lpm: Number(firstServer.chips.reduce((sum, chip) => sum + chip.coolant_flow_lpm, 0).toFixed(3)),
        chip_count: firstServer.chips.length,
        chips: firstServer.chips
      });
    });
    return () => {
      isMounted = false;
    };
  }, [digitalTwin.site_id, selectedRack]);

  const powerPanel = (
    <section className="panel power-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Realtime Monitor</span>
          <h2>负载、碳强度与排放</h2>
        </div>
        <LineChart size={22} />
      </div>
      <div className="chart-stack">
        <Sparkline points={hourlyLoad} color="#1f7a5c" />
        <Sparkline points={hourlyCarbon} color="#c44e3a" />
      </div>
      <div className="legend-row">
        <span><i className="legend green" />IT load kWh</span>
        <span><i className="legend red" />Grid CI gCO2e/kWh</span>
        <span><i className="legend blue" />interval {metrics.interval_minutes} min</span>
      </div>
    </section>
  );

  const inventoryPanel = (
    <section className="panel inventory-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Lifecycle Inventory</span>
          <h2>Scope 1 / 2 / 3 分层</h2>
        </div>
        <Database size={22} />
      </div>
      <div className="scope-list">
        <div>
          <span>Scope 1</span>
          <strong>备用燃料 · 制冷剂</strong>
          <i style={{ width: "12%" }} />
        </div>
        <div>
          <span>Scope 2</span>
          <strong>location 与 market 双口径</strong>
          <i style={{ width: "61%" }} />
        </div>
        <div>
          <span>Scope 3</span>
          <strong>GPU / 服务器 / 建筑 LCA</strong>
          <i style={{ width: "38%" }} />
        </div>
      </div>
    </section>
  );

  const optimizerPanel = (
    <section className="panel optimizer-panel" id="AI 优化">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">AI Decarbonization</span>
          <h2>优化建议队列</h2>
        </div>
        <Cpu size={22} />
      </div>
      <div className="optimizer-list">
        {optimizerItems.map((item) => (
          <article key={item.title}>
            <div>
              <strong>{item.title}</strong>
              <span>{item.impact}</span>
            </div>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );

  const evidencePanel = (
    <section className="panel evidence-panel" id="证据">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Audit Evidence</span>
          <h2>证据包状态</h2>
        </div>
        <FileCheck2 size={22} />
      </div>
      <div className="evidence-list">
        <span><ShieldCheck size={17} />电表原始读数已哈希</span>
        <span><FileCheck2 size={17} />EAC / GC 序列号无重复</span>
        <span><AlertTriangle size={17} />3 条冷机数据为估算补点</span>
      </div>
    </section>
  );

  const renderWorkbench = () => {
    if (activeView === "pathway") {
      return (
        <section className="workspace-grid pathway-workspace">
          <PathwayPanel
            annualBaselineTco2e={annualBaselineTco2e}
            assessment={pathwayAssessment}
            horizon={pathwayHorizon}
            onHorizonChange={setPathwayHorizon}
            onScenarioChange={setSelectedPathwayId}
            scenarioId={selectedPathwayId}
          />
          <QuotaPanel quota={quota} />
          <MatchingPanel matching={matching} />
        </section>
      );
    }

    if (activeView === "twin") {
      return (
        <section className="workspace-grid twin-workspace">
          {selectedRack ? (
            <section className="panel twin-panel" id="孪生">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Cabinet Digital Twin</span>
                  <h2>园区统一到 server 层的三维碳核查</h2>
                </div>
                <Boxes size={22} />
              </div>
              <div className="twin-layout">
                <TwinScene twin={digitalTwin} selectedRackId={selectedRack.id} onSelectRack={(rack) => setSelectedRackId(rack.id)} />
                <RackInspector rack={selectedRack} />
              </div>
              <div className="twin-summary">
                <span><Network size={16} />{digitalTwin.rack_count} racks</span>
                <span><HardDrive size={16} />{digitalTwin.server_count} servers</span>
                <span><Cpu size={16} />{digitalTwin.chip_count} chips</span>
                <span><Droplets size={16} />{digitalTwin.primary_cooling_system.length} cooling nodes</span>
                <span><Globe2 size={16} />{formatNumber(digitalTwin.aggregate_location_kg_per_hour, 2)} kgCO2e/h LB</span>
                <span><FileCheck2 size={16} />refresh {digitalTwin.refresh_seconds}s</span>
              </div>
            </section>
          ) : null}
          {selectedRack ? <ServerAuditPanel twin={digitalTwin} selectedRack={selectedRack} /> : null}
          <ChipSimulationPanel simulation={chipSimulation} />
        </section>
      );
    }

    if (activeView === "systems") {
      return (
        <section className="workspace-grid systems-workspace">
          {powerPanel}
          <EnvelopePanel twin={digitalTwin} />
          <MepSystemsPanel twin={digitalTwin} />
          {inventoryPanel}
        </section>
      );
    }

    if (activeView === "quota") {
      return (
        <section className="workspace-grid quota-workspace">
          <QuotaPanel quota={quota} />
          <MatchingPanel matching={matching} />
          {inventoryPanel}
          {evidencePanel}
        </section>
      );
    }

    if (activeView === "optimizer") {
      return (
        <section className="workspace-grid optimizer-workspace">
          {optimizerPanel}
          {powerPanel}
          <ChipSimulationPanel simulation={chipSimulation} />
          {evidencePanel}
        </section>
      );
    }

    if (activeView === "efficiency") {
      return (
        <section className="workspace-grid efficiency-workspace">
          <EfficiencyPanel summary={efficiency} />
        </section>
      );
    }

    return (
      <section className="workspace-grid fidelity-workspace">
        <FidelityPolicyPanel policy={omniversePolicy} />
        <ToolchainPanel twin={digitalTwin} />
        {evidencePanel}
      </section>
    );
  };

  return (
    <main className="dashboard">
      <aside className="sidebar">
        <div className="brand">
          <ServerCog size={24} />
          <div>
            <strong>AIDC Carbon</strong>
            <span>NRT dMRV</span>
          </div>
        </div>
        <nav>
          {navItems.map((item) => (
            <button className={activeView === item.id ? "active" : ""} key={item.id} onClick={() => setActiveView(item.id)} title={item.helper} type="button">
              <item.icon size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <span className="eyebrow">Global site + grid boundary</span>
            <h1>AIDC 机柜级数字孪生碳核查平台</h1>
          </div>
          <div className="topbar-actions">
            <span className="status-dot" />
            <span>{metrics.site_id}</span>
            <span>{new Date(metrics.generated_at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</span>
            <a className="topbar-screen-link" href="/bupt-ai">BUPT.AI子站</a>
            <a className="topbar-screen-link" href="/bms">动环监控</a>
            <a className="topbar-screen-link" href="/bigscreen">园区大屏</a>
          </div>
        </header>

        <section className="metric-grid" id="实时">
          {metricCards.map((card) => (
            <MetricCard key={card.label} {...card} />
          ))}
        </section>

        <BuptPortalEntry />

        <section className="workbench-shell">
          <section className="tool-hero">
            <div>
              <span className="eyebrow">{activeIntro.eyebrow}</span>
              <h2>{activeIntro.title}</h2>
              <p>{activeIntro.body}</p>
            </div>
            <div className="quick-stat-grid">
              {quickStats.map((stat) => (
                <article key={stat.label}>
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                  <small>{stat.unit}</small>
                </article>
              ))}
            </div>
          </section>
          {renderWorkbench()}
        </section>
      </section>
    </main>
  );
}
