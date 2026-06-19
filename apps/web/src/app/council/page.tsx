"use client";

import {
  Award,
  Banknote,
  Cpu,
  Droplets,
  Gauge,
  GitMerge,
  Landmark,
  Leaf,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  Vote,
  Zap
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { loadMatching, loadQuotaStatus, loadRealtimeMetrics } from "../../lib/api";
import { fallbackMatching, fallbackQuota, fallbackRealtime } from "../../lib/sample";
import {
  buildCouncilState,
  councilAgents,
  deliberate,
  type CouncilResolution,
  type CouncilSession,
  type CouncilStance
} from "../../lib/council";

const agentIcon: Record<string, React.ComponentType<{ size?: number }>> = {
  accounting: ScrollText,
  grid: Zap,
  cooling: Droplets,
  compute: Cpu,
  compliance: ShieldCheck,
  lifecycle: Leaf
};

const stanceLabel: Record<CouncilStance, { text: string; tone: string }> = {
  advance: { text: "推进", tone: "green" },
  optimize: { text: "优化", tone: "blue" },
  caution: { text: "审慎", tone: "amber" },
  block: { text: "阻断", tone: "red" },
  monitor: { text: "监控", tone: "slate" }
};

const priorityTone: Record<string, string> = { P0: "red", P1: "amber", P2: "slate" };
const decisionLabel: Record<string, string> = { adopt: "采纳", pilot: "试点", defer: "暂缓" };
const horizonLabel: Record<string, string> = { now: "即时", quarter: "本季", year: "本年", multiyear: "多年" };

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(value);
}

const fallbackSession = deliberate(buildCouncilState(fallbackRealtime, fallbackQuota, fallbackMatching));

export default function CouncilPage() {
  const [session, setSession] = useState<CouncilSession>(fallbackSession);
  const [live, setLive] = useState(false);
  const [gpuUtil, setGpuUtil] = useState(0.58);
  const [loading, setLoading] = useState(false);

  async function refresh(util = gpuUtil) {
    setLoading(true);
    const [metrics, quota, matching] = await Promise.all([
      loadRealtimeMetrics(),
      loadQuotaStatus(),
      loadMatching()
    ]);
    const isLive = Boolean(metrics && quota && matching);
    setLive(isLive);
    const state = buildCouncilState(
      metrics ?? fallbackRealtime,
      quota ?? fallbackQuota,
      matching ?? fallbackMatching,
      util
    );
    setSession(deliberate(state));
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const findingByAgent = useMemo(
    () => new Map(session.findings.map((f) => [f.agentId, f])),
    [session]
  );
  const agentName = (id: string) => councilAgents.find((a) => a.id === id)?.nameZh ?? id;

  const { summary } = session;

  return (
    <main className="council">
      <header className="topbar">
        <div>
          <span className="eyebrow">Agent Council · 智算碳治理议会</span>
          <h1>AI 能源 Agent 议会</h1>
        </div>
        <div className="topbar-actions">
          <span className={`status-dot ${live ? "" : "offline"}`} />
          <span>{session.siteId}</span>
          <span>{live ? "实时数据" : "样本数据"}</span>
          <button className="council-refresh" disabled={loading} onClick={() => refresh()} type="button">
            <RefreshCw size={14} /> {loading ? "审议中" : "重新审议"}
          </button>
          <Link className="topbar-screen-link" href="/">运营工作台</Link>
          <Link className="topbar-screen-link" href="/bigscreen">园区大屏</Link>
        </div>
      </header>

      <section className="council-chair">
        <div className="council-chair__head">
          <Landmark size={22} />
          <div>
            <span className="eyebrow">议长裁决 · Chair resolution</span>
            <h2>{session.agenda}</h2>
          </div>
        </div>
        <p className="council-chair__headline">{summary.headline}</p>
        <div className="council-chair__stats">
          <article>
            <span>配额对齐度</span>
            <strong>{(summary.alignmentScore * 100).toFixed(0)}%</strong>
            <small>1.5℃ 站点轨迹</small>
          </article>
          <article>
            <span>年减排合计</span>
            <strong>{formatNumber(summary.totalAbatementTco2e)}</strong>
            <small>tCO2e/年</small>
          </article>
          <article>
            <span>P0 动议</span>
            <strong>{summary.p0Count}</strong>
            <small>立即执行</small>
          </article>
          <article>
            <span>议会置信度</span>
            <strong>{(summary.confidence * 100).toFixed(0)}%</strong>
            <small>加权评估</small>
          </article>
        </div>
      </section>

      <section className="council-grid">
        <section className="council-col">
          <div className="panel-heading">
            <Vote size={18} />
            <h2>席位与立场 · Findings</h2>
          </div>
          <div className="council-roster">
            {councilAgents.map((agent) => {
              const finding = findingByAgent.get(agent.id);
              const Icon = agentIcon[agent.id] ?? Gauge;
              const stance = finding ? stanceLabel[finding.stance] : null;
              return (
                <article className="council-seat" key={agent.id}>
                  <div className="council-seat__top">
                    <span className="council-seat__icon"><Icon size={18} /></span>
                    <div>
                      <strong>{agent.nameZh}</strong>
                      <span>{agent.role}</span>
                    </div>
                    {stance && <span className={`council-tag ${stance.tone}`}>{stance.text}</span>}
                  </div>
                  {finding && (
                    <>
                      <p className="council-seat__headline">{finding.headline}</p>
                      <p className="council-seat__rationale">{finding.rationale}</p>
                      <div className="council-seat__metrics">
                        {finding.metricsCited.map((m) => (
                          <span key={m.key}>
                            {m.key}: <strong>{m.value}</strong>
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </article>
              );
            })}
          </div>

          <div className="panel-heading">
            <GitMerge size={18} />
            <h2>跨域冲突裁决 · Conflicts</h2>
          </div>
          <div className="council-conflicts">
            {session.conflicts.length === 0 && <p className="council-empty">本次审议未触发跨域冲突。</p>}
            {session.conflicts.map((c) => (
              <article className="council-conflict" key={c.id}>
                <div className="council-conflict__head">
                  <strong>{c.title}</strong>
                  <span>{c.between.map(agentName).join(" ⇄ ")}</span>
                </div>
                <p className="council-conflict__desc">{c.description}</p>
                <p className="council-conflict__res">
                  <Award size={13} /> 裁决：{c.resolution}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="council-col">
          <div className="panel-heading">
            <ScrollText size={18} />
            <h2>动议与表决 · Motions &amp; votes</h2>
          </div>
          <div className="council-motions">
            {session.resolutions.map((r) => (
              <MotionRow key={r.id} resolution={r} agentName={agentName} />
            ))}
          </div>

          <div className="council-utility">
            <label htmlFor="gpu-util">GPU 利用率假设：{(gpuUtil * 100).toFixed(0)}%</label>
            <input
              id="gpu-util"
              max={0.9}
              min={0.3}
              onChange={(event) => {
                const value = Number(event.target.value);
                setGpuUtil(value);
                refresh(value);
              }}
              step={0.01}
              type="range"
              value={gpuUtil}
            />
            <small>调整算力负载假设，观察议会动议排序与减排估计的变化。</small>
          </div>

          <div className="panel-heading">
            <Banknote size={18} />
            <h2>风险与保留意见 · Risks</h2>
          </div>
          <div className="council-risks">
            <ul>
              {summary.risks.map((risk) => (
                <li key={risk}>{risk}</li>
              ))}
            </ul>
            {summary.dissents.length > 0 && (
              <div className="council-dissents">
                <span>保留意见</span>
                {summary.dissents.map((d) => (
                  <p key={d}>{d}</p>
                ))}
              </div>
            )}
          </div>
        </section>
      </section>

      <footer className="council-foot">
        审议口径：location-based 物理排放为减排计量基准；market-based（EAC/REC/PPA/offset）单独披露，不抵扣物理排放、SCI 或服务器层碳强度。证书须去重与增量性核验。
      </footer>
    </main>
  );
}

function MotionRow({
  resolution,
  agentName
}: {
  resolution: CouncilResolution;
  agentName: (id: string) => string;
}) {
  const { motion, vote, priority, decision } = resolution;
  return (
    <article className="council-motion">
      <div className="council-motion__head">
        <span className={`council-rank ${priorityTone[priority]}`}>#{resolution.rank}</span>
        <div className="council-motion__title">
          <strong>{motion.title}</strong>
          <span>{agentName(motion.proposerId)} 提出 · {horizonLabel[motion.horizon]} · 投入等级 {motion.effort}/3</span>
        </div>
        <div className="council-motion__badges">
          <span className={`council-tag ${priorityTone[priority]}`}>{priority}</span>
          <span className={`council-tag ${decision === "adopt" ? "green" : decision === "pilot" ? "blue" : "slate"}`}>
            {decisionLabel[decision]}
          </span>
        </div>
      </div>
      <p className="council-motion__impact">{motion.expectedImpact}</p>
      <div className="council-motion__metrics">
        <span>年减排 <strong>{formatNumber(motion.abatementTco2e)}</strong> tCO2e</span>
        <span>资本支出 <strong>{motion.capexUsdK < 0 ? `节省 ${formatNumber(-motion.capexUsdK)}` : formatNumber(motion.capexUsdK)}</strong> k$</span>
        <span>置信度 <strong>{(motion.confidence * 100).toFixed(0)}%</strong></span>
      </div>
      <div className="council-vote">
        <span className="council-vote__bar">
          <ThumbsUp size={13} /> {vote.support.length}
          <ThumbsDown size={13} /> {vote.oppose.length}
          <span className="council-vote__abs">弃权 {vote.abstain.length}</span>
        </span>
        <span className={`council-tag ${vote.consensus === "unanimous" || vote.consensus === "strong" ? "green" : vote.consensus === "split" ? "amber" : "red"}`}>
          {vote.consensus === "unanimous" ? "全票" : vote.consensus === "strong" ? "强共识" : vote.consensus === "split" ? "分歧" : "争议"}
        </span>
        <span className="council-vote__score">加权 {vote.weightedScore >= 0 ? "+" : ""}{vote.weightedScore}</span>
      </div>
      {motion.constraints.length > 0 && (
        <p className="council-motion__constraints">约束：{motion.constraints.join("；")}</p>
      )}
    </article>
  );
}
