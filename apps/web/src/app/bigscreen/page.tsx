"use client";

import {
  Activity,
  AlertTriangle,
  BatteryCharging,
  Building2,
  Cpu,
  Droplets,
  Factory,
  Gauge,
  Globe2,
  HardDrive,
  Layers,
  Leaf,
  Link as LinkIcon,
  MonitorCog,
  ShieldCheck,
  Zap
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import CampusScene from "../../components/CampusScene";
import { loadDigitalTwin, loadEfficiencySummary, loadMatching, loadQuotaStatus, loadRealtimeMetrics, type DigitalTwinResponse, type EfficiencySummaryResponse, type MatchingResult, type QuotaStatus, type RealtimeMetrics } from "../../lib/api";
import { cfeMatched, fallbackDigitalTwin, fallbackEfficiencySummary, fallbackMatching, fallbackQuota, fallbackRealtime, hourlyCarbon, hourlyLoad } from "../../lib/sample";

type BigKpiProps = {
  label: string;
  value: string;
  unit: string;
  tone: "cyan" | "green" | "amber" | "red" | "blue";
  icon: React.ReactNode;
};

function formatNumber(value: number, digits = 1) {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  }).format(value);
}

function metric(metrics: RealtimeMetrics, key: string, fallback = 0) {
  return metrics.metrics[key]?.value ?? fallback;
}

function BigKpi({ label, value, unit, tone, icon }: BigKpiProps) {
  return (
    <section className={`big-kpi ${tone}`}>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{unit}</small>
      </div>
      <i>{icon}</i>
    </section>
  );
}

function LineChart({ points, color }: { points: number[]; color: string }) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const path = points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * 100;
      const y = 88 - ((point - min) / Math.max(max - min, 1)) * 76;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <svg className="big-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path d={path} fill="none" stroke={color} strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}

function CfeBars() {
  const max = Math.max(...hourlyLoad);
  return (
    <div className="big-cfe-bars">
      {hourlyLoad.map((load, index) => (
        <span key={`${load}-${index}`} style={{ height: `${Math.max((load / max) * 100, 10)}%` }}>
          <i style={{ height: `${Math.min((cfeMatched[index] / load) * 100, 100)}%` }} />
        </span>
      ))}
    </div>
  );
}

function Ring({ value, label, color }: { value: number; label: string; color: string }) {
  const degrees = Math.min(Math.max(value, 0), 100) * 3.6;
  return (
    <div className="big-ring" style={{ background: `conic-gradient(${color} ${degrees}deg, rgba(255,255,255,0.08) 0deg)` }}>
      <div>
        <strong>{formatNumber(value, 1)}%</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

export default function BigscreenPage() {
  const [metrics, setMetrics] = useState<RealtimeMetrics>(fallbackRealtime);
  const [quota, setQuota] = useState<QuotaStatus>(fallbackQuota);
  const [matching, setMatching] = useState<MatchingResult>(fallbackMatching);
  const [digitalTwin, setDigitalTwin] = useState<DigitalTwinResponse>(fallbackDigitalTwin);
  const [efficiency, setEfficiency] = useState<EfficiencySummaryResponse>(fallbackEfficiencySummary);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const load = () => {
      Promise.all([loadRealtimeMetrics(), loadQuotaStatus(), loadMatching(), loadDigitalTwin(), loadEfficiencySummary()]).then(([metricsResult, quotaResult, matchingResult, twinResult, efficiencyResult]) => {
        if (!isMounted) {
          return;
        }
        if (metricsResult) setMetrics(metricsResult);
        if (quotaResult) setQuota(quotaResult);
        if (matchingResult) setMatching(matchingResult);
        if (twinResult) setDigitalTwin(twinResult);
        if (efficiencyResult) setEfficiency(efficiencyResult);
      });
    };
    load();
    const timer = window.setInterval(load, 30000);
    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const campus = useMemo(() => {
    const racks = digitalTwin.campus.buildings.flatMap((building) => building.rooms.flatMap((room) => room.racks));
    const servers = racks.flatMap((rack) => rack.servers);
    const chips = servers.flatMap((server) => server.chips);
    const hottestRack = [...racks].sort((a, b) => b.outlet_temp_c - a.outlet_temp_c)[0];
    const highestCarbonRack = [...racks].sort((a, b) => b.carbon_kg_co2e_per_hour - a.carbon_kg_co2e_per_hour)[0];
    const coolingKw = digitalTwin.primary_cooling_system.reduce((sum, item) => sum + item.current_kw, 0);
    const coolingLoad = digitalTwin.primary_cooling_system.reduce((sum, item) => sum + item.cooling_load_kw, 0);
    const electricalLoss = digitalTwin.electrical_metering_system.reduce((sum, item) => sum + item.loss_kw, 0);
    const envelopeEmbodied = digitalTwin.envelope_components.reduce((sum, item) => sum + item.embodied_kg_co2e, 0);
    return {
      racks,
      servers,
      chips,
      hottestRack,
      highestCarbonRack,
      coolingKw,
      coolingLoad,
      electricalLoss,
      envelopeEmbodied
    };
  }, [digitalTwin]);

  const pue = metric(metrics, "pue", 1.21);
  const cue = metric(metrics, "cue", 0.42);
  const wue = metric(metrics, "wue", 0.31);
  const facilityKwh = metric(metrics, "facility_energy_kwh", 28430);
  const itKwh = metric(metrics, "it_energy_kwh", 23510);
  const locationTco2 = metric(metrics, "location_based_emissions_kg", 9875) / 1000;
  const marketTco2 = metric(metrics, "market_based_emissions_kg", 5024) / 1000;
  const cfeScore = matching.cfe_score * 100;
  const usedPercent = Math.min(quota.used_percent, 100);
  const formatLever = (metricName: string, value: number) =>
    metricName.endsWith("_x") ? `${formatNumber(value, 1)}×` : `${formatNumber(value * 100, 0)}%`;

  return (
    <main className="bigscreen-page">
      <header className="bigscreen-header">
        <div className="bigscreen-title">
          <span>AIDC CAMPUS CARBON COMMAND CENTER</span>
          <h1>园区级碳中和数字孪生监控大屏</h1>
        </div>
        <div className="bigscreen-header__meta">
          <span><i />NRT ONLINE</span>
          <strong>{digitalTwin.site_id}</strong>
          <time>{now ? now.toLocaleString("zh-CN", { hour12: false }) : "--"}</time>
          <Link href="/bms" aria-label="动环监控"><MonitorCog size={17} />动环</Link>
          <Link href="/" aria-label="返回工作台"><LinkIcon size={17} />工作台</Link>
        </div>
      </header>

      <section className="bigscreen-kpis">
        <BigKpi label="园区总电量" value={formatNumber(facilityKwh / 1000, 2)} unit="MWh / 24h" tone="cyan" icon={<Zap size={26} />} />
        <BigKpi label="IT 电量" value={formatNumber(itKwh / 1000, 2)} unit="MWh / 24h" tone="blue" icon={<HardDrive size={26} />} />
        <BigKpi label="PUE" value={formatNumber(pue, 2)} unit="ISO/IEC 30134" tone="green" icon={<Gauge size={26} />} />
        <BigKpi label="Location 排放" value={formatNumber(locationTco2, 2)} unit="tCO2e / h" tone="red" icon={<Globe2 size={26} />} />
        <BigKpi label="Market 排放" value={formatNumber(marketTco2, 2)} unit="tCO2e / h" tone="amber" icon={<Leaf size={26} />} />
        <BigKpi label="芯片节点" value={formatNumber(digitalTwin.chip_count, 0)} unit="chip twins" tone="cyan" icon={<Cpu size={26} />} />
      </section>

      <section className="bigscreen-grid">
        <aside className="bigscreen-left">
          <section className="big-panel">
            <div className="big-panel__head">
              <span>实时碳监控</span>
              <Activity size={20} />
            </div>
            <div className="big-chart">
              <LineChart points={hourlyCarbon} color="#ff7d66" />
              <LineChart points={hourlyLoad} color="#4bd7ff" />
            </div>
            <div className="big-legend">
              <span><i className="red" />grid CI</span>
              <span><i className="cyan" />facility load</span>
              <span>{metrics.interval_minutes} min</span>
            </div>
          </section>

          <section className="big-panel">
            <div className="big-panel__head">
              <span>园区资产</span>
              <Building2 size={20} />
            </div>
            <div className="asset-matrix">
              <div><strong>{digitalTwin.campus.buildings.length}</strong><span>building</span></div>
              <div><strong>{digitalTwin.rack_count}</strong><span>racks</span></div>
              <div><strong>{digitalTwin.server_count}</strong><span>servers</span></div>
              <div><strong>{digitalTwin.chip_count}</strong><span>chips</span></div>
            </div>
            <div className="asset-list">
              <span><Factory size={16} />围护 LCA {formatNumber(campus.envelopeEmbodied / 1000, 1)} tCO2e</span>
              <span><Droplets size={16} />制冷节点 {digitalTwin.primary_cooling_system.length}</span>
              <span><Zap size={16} />电测节点 {digitalTwin.electrical_metering_system.length}</span>
            </div>
          </section>

          <section className="big-panel alert-panel">
            <div className="big-panel__head">
              <span>异常与告警</span>
              <AlertTriangle size={20} />
            </div>
            <div className="alert-list">
              <article className="warn">
                <strong>冷机补点</strong>
                <span>3 条制冷遥测为估算值，等待 BMS 回填</span>
              </article>
              <article>
                <strong>{campus.hottestRack?.name ?? "Rack"}</strong>
                <span>最高出风温 {formatNumber(campus.hottestRack?.outlet_temp_c ?? 0, 1)} C</span>
              </article>
              <article className="hot">
                <strong>{campus.highestCarbonRack?.name ?? "Rack"}</strong>
                <span>碳排放率 {formatNumber(campus.highestCarbonRack?.carbon_kg_co2e_per_hour ?? 0, 2)} kg/h</span>
              </article>
            </div>
          </section>
        </aside>

        <section className="bigscreen-center">
          <CampusScene twin={digitalTwin} metrics={metrics} matching={matching} quota={quota} />
          <div className="scene-overlay top-left">
            <span>Campus Twin</span>
            <strong>Compute + Cooling + Power + Solar</strong>
          </div>
          <div className="scene-overlay bottom-right">
            <span>Server / Chip Audit</span>
            <strong>{digitalTwin.server_count} servers · {digitalTwin.chip_count} chips</strong>
          </div>
        </section>

        <aside className="bigscreen-right">
          <section className="big-panel score-panel">
            <div className="big-panel__head">
              <span>配额与 CFE</span>
              <ShieldCheck size={20} />
            </div>
            <div className="ring-grid">
              <Ring value={usedPercent} label="Quota Used" color="#ffc857" />
              <Ring value={cfeScore} label="24/7 CFE" color="#76d7b2" />
            </div>
            <div className="quota-line">
              <span>剩余额度</span>
              <strong>{formatNumber(quota.remaining_kg_co2e / 1000, 0)} tCO2e</strong>
            </div>
            <div className="quota-line">
              <span>碳价风险</span>
              <strong>${formatNumber(quota.carbon_price_risk_usd, 0)}</strong>
            </div>
          </section>

          <section className="big-panel">
            <div className="big-panel__head">
              <span>24/7 零碳电力匹配</span>
              <BatteryCharging size={20} />
            </div>
            <CfeBars />
            <div className="matching-stats">
              <span>unmatched {formatNumber(matching.unmatched_load_kwh / 1000, 1)} MWh</span>
              <span>avoided {formatNumber(matching.avoided_emissions_kg_co2e / 1000, 1)} tCO2e</span>
            </div>
          </section>

          <section className="big-panel">
            <div className="big-panel__head">
              <span>一次侧制冷 / 电测</span>
              <MonitorCog size={20} />
            </div>
            <div className="mep-big-list">
              <article>
                <span>Cooling Power</span>
                <strong>{formatNumber(campus.coolingKw, 1)} kW</strong>
                <small>load {formatNumber(campus.coolingLoad, 0)} kW</small>
              </article>
              <article>
                <span>Electrical Loss</span>
                <strong>{formatNumber(campus.electricalLoss, 1)} kW</strong>
                <small>meter class 0.2S / 0.5S</small>
              </article>
              <article>
                <span>CUE / WUE</span>
                <strong>{formatNumber(cue, 2)} / {formatNumber(wue, 2)}</strong>
                <small>kgCO2e-ITkWh / L-ITkWh</small>
              </article>
            </div>
          </section>

          <section className="big-panel">
            <div className="big-panel__head">
              <span>跨层能效工程</span>
              <Layers size={20} />
            </div>
            <div className="big-efficiency-grid">
              {efficiency.levers.map((lever) => (
                <article key={lever.lever}>
                  <span>{lever.title}</span>
                  <strong>{formatLever(lever.primary_metric, lever.primary_value)}</strong>
                  <small>参考 {formatLever(lever.primary_metric, lever.reference_value)}</small>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </section>

      <footer className="bigscreen-footer">
        <span>方法: NRT-dMRV + LCA + server/chip twin allocation</span>
        <span>Scope 2: location-based 与 market-based 分开披露</span>
        <span>offset / avoided emissions 不冲抵物理排放</span>
      </footer>
    </main>
  );
}
