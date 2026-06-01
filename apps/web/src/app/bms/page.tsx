"use client";

import {
  AlertTriangle,
  Bell,
  Building2,
  ChevronLeft,
  ChevronRight,
  Droplets,
  Fan,
  Gauge,
  Home,
  RotateCcw,
  Search,
  Thermometer,
  Video,
  Zap
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { loadDigitalTwin, loadQuotaStatus, loadRealtimeMetrics, type DigitalTwinResponse, type QuotaStatus, type RealtimeMetrics } from "../../lib/api";
import { fallbackDigitalTwin, fallbackQuota, fallbackRealtime } from "../../lib/sample";

type BmsTab = "floor" | "cooling" | "settings";

function formatNumber(value: number, digits = 1) {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  }).format(value);
}

function metric(metrics: RealtimeMetrics, key: string, fallback = 0) {
  return metrics.metrics[key]?.value ?? fallback;
}

function BmsToolbar({ activeTab, onTabChange }: { activeTab: BmsTab; onTabChange: (tab: BmsTab) => void }) {
  const tabs: Array<{ id: BmsTab; label: string }> = [
    { id: "floor", label: "机房平面" },
    { id: "cooling", label: "冷源群控" },
    { id: "settings", label: "系统参数" }
  ];

  return (
    <div className="bms-toolbar">
      <div className="bms-toolbar__left">
        <button type="button" aria-label="back"><ChevronLeft size={20} /></button>
        <button type="button" aria-label="forward"><ChevronRight size={20} /></button>
        <button type="button" aria-label="refresh"><RotateCcw size={19} /></button>
        <button type="button" aria-label="home"><Home size={20} /></button>
        <button type="button" aria-label="topology"><Building2 size={20} /></button>
        <button type="button" aria-label="alarm"><AlertTriangle size={20} /></button>
        <button type="button" aria-label="light"><Zap size={20} /></button>
        <button type="button" aria-label="trend"><Gauge size={20} /></button>
        <button type="button" aria-label="search"><Search size={20} /></button>
      </div>
      <div className="bms-tabs">
        {tabs.map((tab) => (
          <button className={activeTab === tab.id ? "active" : ""} key={tab.id} onClick={() => onTabChange(tab.id)} type="button">
            {tab.label}
          </button>
        ))}
      </div>
      <label className="bms-command">
        <span>Command</span>
        <input aria-label="Command" />
      </label>
    </div>
  );
}

function RackGlyph({ x, y, hot }: { x: number; y: number; hot?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`} className={hot ? "rack-glyph hot" : "rack-glyph"}>
      <rect className="rack-shell" x="0" y="0" width="28" height="88" rx="2" />
      {Array.from({ length: 7 }, (_, index) => (
        <rect className="rack-slot" height="8" key={index} width="17" x="5.5" y={7 + index * 11} />
      ))}
      <circle className="rack-fan" cx="9" cy="80" r="3" />
      <circle className="rack-fan" cx="19" cy="80" r="3" />
      <text x="14" y="100">{hot ? "!" : "OK"}</text>
    </g>
  );
}

function FloorPlanPanel({ twin }: { twin: DigitalTwinResponse }) {
  const racks = twin.campus.buildings.flatMap((building) => building.rooms.flatMap((room) => room.racks));
  const alarmRacks = new Set(racks.slice(-2).map((rack) => rack.id));
  const rackLayout = Array.from({ length: 40 }, (_, index) => {
    const row = index < 20 ? 0 : 1;
    const col = index % 20;
    const pair = col % 2;
    const group = Math.floor(col / 2);
    return {
      id: racks[index % racks.length]?.id ?? `${index}`,
      x: 115 + group * 82 + pair * 34,
      y: 96 + row * 270,
      hot: alarmRacks.has(racks[index % racks.length]?.id)
    };
  });

  return (
    <section className="bms-stage floor-plan-stage">
      <div className="bms-breadcrumb">中国移动（湖南长沙）智算中心 ▶ D栋数据中心 ▶ 二层 ▶ AIDC 机房动环监控</div>
      <div className="floor-plan-wrap">
        <svg viewBox="0 0 1040 650" role="img" aria-label="机房平面动环监控图">
          <defs>
            <pattern height="20" id="bms-grid" patternUnits="userSpaceOnUse" width="20">
              <path d="M20 0H0V20" fill="none" stroke="rgba(69,123,210,0.26)" strokeWidth="1" />
            </pattern>
            <filter id="cyan-glow">
              <feGaussianBlur result="blur" stdDeviation="2.2" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <rect className="floor-bg" height="610" width="970" x="24" y="20" />
          <rect className="floor-grid" height="560" width="910" x="54" y="46" />
          <path className="floor-wall" d="M54 46H964V606H54V46Z" />
          <path className="floor-door" d="M54 166h34v62H54M54 432h34v68H54M930 176h34v62h-34M930 416h34v74h-34" />
          <rect className="cold-aisle" height="122" width="802" x="132" y="232" />
          <rect className="hot-aisle" height="68" width="802" x="132" y="90" />
          <rect className="hot-aisle" height="68" width="802" x="132" y="364" />
          {rackLayout.map((rack) => (
            <RackGlyph hot={rack.hot} key={`${rack.id}-${rack.x}-${rack.y}`} x={rack.x} y={rack.y} />
          ))}
          {[
            [135, 58],
            [468, 58],
            [805, 58],
            [135, 574],
            [468, 574],
            [805, 574]
          ].map(([x, y], index) => (
            <g className="sensor-glyph" key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
              <path d="M0 0c18-16 48-16 66 0M11 9c12-10 32-10 44 0M24 18c5-4 13-4 18 0" />
              <rect height="36" rx="3" width="64" x="80" y="-18" />
              <text x="91" y="-3">{index % 2 === 0 ? "22.7" : "23.4"}°C</text>
              <text x="101" y="13">{index % 2 === 0 ? "48" : "51"}%</text>
            </g>
          ))}
          <g className="bms-floor-label">
            <text x="430" y="322">冷通道 / 热通道压差 18 Pa</text>
          </g>
        </svg>
      </div>
    </section>
  );
}

function Pipe({ d, tone }: { d: string; tone: "cold" | "hot" | "water" | "power" }) {
  return <path className={`pid-pipe ${tone}`} d={d} />;
}

function Pump({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g className="pid-device pump" transform={`translate(${x} ${y})`}>
      <rect height="34" rx="4" width="72" x="-36" y="-17" />
      <circle cx="0" cy="0" r="13" />
      <text x="0" y="34">{label}</text>
      <text x="0" y="-24">29.9Hz</text>
    </g>
  );
}

function Chiller({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g className="pid-device chiller" transform={`translate(${x} ${y})`}>
      <rect height="70" rx="7" width="108" x="-54" y="-35" />
      <rect height="28" rx="3" width="72" x="-36" y="-14" />
      <text x="0" y="-45">{label}</text>
      <text x="0" y="6">运行</text>
      <text x="0" y="51">18.1°C · 2.9bar</text>
    </g>
  );
}

function Tank({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g className="pid-device tank" transform={`translate(${x} ${y})`}>
      <ellipse cx="0" cy="-38" rx="42" ry="12" />
      <rect height="76" width="84" x="-42" y="-38" />
      <ellipse cx="0" cy="38" rx="42" ry="12" />
      <text x="0" y="-5">{label}</text>
      <text x="0" y="18">17.0°C</text>
    </g>
  );
}

function CoolingPidPanel({ twin }: { twin: DigitalTwinResponse }) {
  const coolingPower = twin.primary_cooling_system.reduce((sum, item) => sum + item.current_kw, 0);
  return (
    <section className="bms-stage cooling-pid-stage">
      <div className="bms-pid-title">湖南长沙移动数据中心冷源 群控系统</div>
      <svg viewBox="0 0 1240 650" role="img" aria-label="冷源群控系统管线图">
        <defs>
          <filter id="pid-glow">
            <feGaussianBlur result="blur" stdDeviation="2" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <Pipe d="M72 100H282V142H392V192H512" tone="hot" />
        <Pipe d="M72 184H282V225H392V270H512" tone="cold" />
        <Pipe d="M72 300H282V342H392V392H512" tone="hot" />
        <Pipe d="M72 384H282V425H392V470H512" tone="cold" />
        <Pipe d="M640 170H858V108H1132" tone="power" />
        <Pipe d="M640 246H858V206H1132" tone="water" />
        <Pipe d="M640 402H844V332H1132" tone="power" />
        <Pipe d="M640 480H844V438H1132" tone="water" />
        <Pipe d="M805 206V474H1015V206" tone="cold" />
        <Pipe d="M905 108V544H1120" tone="hot" />
        {[88, 172, 288, 372].map((y, index) => (
          <Chiller key={y} label={`${index + 1}#冷机`} x={176} y={y} />
        ))}
        {[332, 500, 704].map((x, index) => (
          <Pump key={x} label={`${index + 1}#冷冻泵`} x={x} y={index < 2 ? 184 : 384} />
        ))}
        <Tank label="蓄冷罐" x={720} y={326} />
        <g className="pid-device header" transform="translate(902 164)">
          <rect height="52" rx="18" width="118" x="-59" y="-26" />
          <text x="0" y="5">集水器</text>
        </g>
        <g className="pid-device header" transform="translate(1065 164)">
          <rect height="52" rx="18" width="118" x="-59" y="-26" />
          <text x="0" y="5">分水器</text>
        </g>
        <g className="pid-device header" transform="translate(902 372)">
          <rect height="52" rx="18" width="118" x="-59" y="-26" />
          <text x="0" y="5">末端回水</text>
        </g>
        <g className="pid-device header" transform="translate(1065 372)">
          <rect height="52" rx="18" width="118" x="-59" y="-26" />
          <text x="0" y="5">末端供水</text>
        </g>
        {[
          [506, 190, "V5"],
          [592, 246, "V6"],
          [820, 206, "PT2 510%"],
          [1030, 206, "V14"],
          [1030, 438, "V13"],
          [610, 480, "V8"]
        ].map(([x, y, label]) => (
          <g className="pid-valve" key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
            <path d="M-10-8L10 8M10-8L-10 8" />
            <text x="0" y="-14">{label}</text>
          </g>
        ))}
        <g className="pid-data-box" transform="translate(735 555)">
          <rect height="64" rx="7" width="420" />
          <text x="18" y="25">当前总冷负荷: {formatNumber(coolingPower, 1)} kW</text>
          <text x="18" y="49">旁通压差: 0.6 bar · 冷却塔出水: 26.0 °C · 最低流量: 2000 M^3/H</text>
        </g>
      </svg>
    </section>
  );
}

function SettingsPanel({ quota }: { quota: QuotaStatus }) {
  const rows = [
    ["湿球温度低限设定值", "13.5 °C"],
    ["湿球温度高限设定值", "17.5 °C"],
    ["模式转换延时时间设定值", "900 秒"],
    ["冷冻/冷却泵关延时设定", "300 秒"],
    ["电动蝶阀关延时设定", "360 秒"],
    ["冷冻泵变频压差设定值", "2.0 bar"],
    ["冷冻供回水旁通压差设定值", "2.2 bar"],
    ["冷却泵变频温差设定值", "3.0 °C"],
    ["冷机冷却最低流量设定值", "2000 M^3/H"],
    ["冷却塔出水温度设定值", "26.0 °C"],
    ["冷却塔出水低温保护设定值", "5.0 °C"],
    ["自动轮巡时间设定值", "200 小时"]
  ];

  return (
    <section className="bms-stage settings-stage">
      <h2>系统参数设定</h2>
      <div className="settings-layout">
        <div className="settings-table">
          {rows.map(([label, value], index) => (
            <div className={index % 3 === 0 ? "section-row" : ""} key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <aside className="settings-side">
          <article>
            <h3>一键启停</h3>
            <span>开</span>
            <p>制冷模式: 完全冷模式 · 负载选择: 低负载模式</p>
          </article>
          <article>
            <h3>制冷单元加载条件设定</h3>
            <p>加载温度 15 °C · 加载电流百分比 90% · 加载延时 900 秒</p>
          </article>
          <article>
            <h3>碳配额联动</h3>
            <p>已用配额 {formatNumber(quota.used_percent, 1)}% · 超限时自动切入低碳调度策略</p>
          </article>
        </aside>
      </div>
    </section>
  );
}

function AlarmRail({ twin }: { twin: DigitalTwinResponse }) {
  return (
    <aside className="bms-alarm-rail">
      <section>
        <h3>告警雷达</h3>
        <div className="radar">
          <span />
          <i />
        </div>
      </section>
      <section>
        <h3>告警统计</h3>
        <div className="alarm-count">
          <strong>0</strong>
          <span>紧急</span>
        </div>
        <div className="alarm-count warn">
          <strong>3</strong>
          <span>提示</span>
        </div>
      </section>
      <section className="alarm-feed">
        <h3>告警列表</h3>
        <article>冷机数据补点 · BMS 回填等待</article>
        <article>Rack D03 碳排放率偏高</article>
        <article>冷却泵 VFD 需校核</article>
        <small>{twin.refresh_seconds}s refresh · BACnet / OPC UA / Modbus TCP</small>
      </section>
    </aside>
  );
}

function CctvStrip() {
  return (
    <div className="bms-cctv-strip">
      {["西1F A栋北", "西A栋3F 电梯厅", "五楼冷站通道"].map((label, index) => (
        <div key={label}>
          <Video size={18} />
          <span>{label}</span>
          <i>{index === 0 ? "LIVE" : "14:51:21"}</i>
        </div>
      ))}
    </div>
  );
}

export default function BmsPage() {
  const [activeTab, setActiveTab] = useState<BmsTab>("floor");
  const [metrics, setMetrics] = useState<RealtimeMetrics>(fallbackRealtime);
  const [quota, setQuota] = useState<QuotaStatus>(fallbackQuota);
  const [digitalTwin, setDigitalTwin] = useState<DigitalTwinResponse>(fallbackDigitalTwin);

  useEffect(() => {
    let isMounted = true;
    Promise.all([loadRealtimeMetrics(), loadQuotaStatus(), loadDigitalTwin()]).then(([metricsResult, quotaResult, twinResult]) => {
      if (!isMounted) {
        return;
      }
      if (metricsResult) setMetrics(metricsResult);
      if (quotaResult) setQuota(quotaResult);
      if (twinResult) setDigitalTwin(twinResult);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const coolingPower = useMemo(
    () => digitalTwin.primary_cooling_system.reduce((sum, item) => sum + item.current_kw, 0),
    [digitalTwin.primary_cooling_system]
  );

  return (
    <main className="bms-page">
      <header className="bms-header">
        <div>
          <span>Siemens-Style BMS / EPMS / Cooling SCADA</span>
          <h1>智算中心工业动环监控系统</h1>
        </div>
        <div className="bms-header__stats">
          <span><Thermometer size={17} />湿球 17.5°C</span>
          <span><Droplets size={17} />冷源 {formatNumber(coolingPower, 1)} kW</span>
          <span><Fan size={17} />PUE {formatNumber(metric(metrics, "pue", 1.21), 2)}</span>
          <span><Bell size={17} />告警 3</span>
          <Link href="/bigscreen">园区大屏</Link>
        </div>
      </header>
      <BmsToolbar activeTab={activeTab} onTabChange={setActiveTab} />
      <CctvStrip />
      <section className="bms-workspace">
        <div className="bms-main-stage">
          {activeTab === "floor" ? <FloorPlanPanel twin={digitalTwin} /> : null}
          {activeTab === "cooling" ? <CoolingPidPanel twin={digitalTwin} /> : null}
          {activeTab === "settings" ? <SettingsPanel quota={quota} /> : null}
        </div>
        <AlarmRail twin={digitalTwin} />
      </section>
      <footer className="bms-footer">
        <span>basevera</span>
        <span>Stn03</span>
        <span>Operator View Only</span>
        <span>BACnet/IP · OPC UA · Modbus TCP · DCIM · EPMS</span>
      </footer>
    </main>
  );
}
