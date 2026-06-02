import {
  ArrowRight,
  Building2,
  Cpu,
  Gauge,
  Globe2,
  Leaf,
  MonitorCog,
  Network,
  ServerCog,
  ShieldCheck,
  Zap
} from "lucide-react";
import Link from "next/link";

const toolLinks = [
  {
    href: "/",
    label: "AIDC 工作台",
    body: "路径评测、机柜孪生、配额与 AI 降碳工具统一入口。",
    icon: Gauge
  },
  {
    href: "/bigscreen",
    label: "园区监控大屏",
    body: "面向指挥中心的园区级数字孪生和碳排放态势。",
    icon: MonitorCog
  },
  {
    href: "/bms",
    label: "工业动环监控",
    body: "冷源群控、机房平面、参数设定和告警联动。",
    icon: ServerCog
  }
];

const researchModules = [
  "Near-real-time dMRV",
  "Rack-to-server carbon audit",
  "24/7 CFE matching",
  "Quota and policy risk",
  "AI workload decarbonization",
  "OpenUSD / BIM evidence"
];

const publishTargets = [
  { label: "路径站点", value: "https://bupt.ai/aidcco2" },
  { label: "子域名", value: "https://aidcco2.bupt.ai" },
  { label: "代码路由", value: "/bupt-ai" }
];

export default function BuptAiSubsitePage() {
  return (
    <main className="bupt-site">
      <header className="bupt-site__header">
        <Link className="bupt-site__brand" href="/">
          <ServerCog size={26} />
          <span>
            <strong>BUPT.AI / AIDC Carbon</strong>
            <small>AI data center carbon-neutrality digital twin</small>
          </span>
        </Link>
        <nav>
          <Link href="/">工作台</Link>
          <Link href="/bigscreen">园区大屏</Link>
          <Link href="/bms">动环监控</Link>
        </nav>
      </header>

      <section className="bupt-hero">
        <div className="bupt-hero__copy">
          <span className="eyebrow">BUPT.AI Secondary Site</span>
          <h1>智算中心碳中和数字孪生与全生命周期核查平台</h1>
          <p>
            该二级站面向 bupt.ai 发布，聚合 AIDC 站点+电网边界下的近实时碳 MRV、机柜到 server/chip 层级核查、配额风险、24/7
            零碳电力匹配和 AI 降碳优化。
          </p>
          <div className="bupt-hero__actions">
            <Link href="/">
              打开主工作台
              <ArrowRight size={17} />
            </Link>
            <Link href="/bigscreen">
              查看园区大屏
              <ArrowRight size={17} />
            </Link>
          </div>
        </div>
        <div className="bupt-hero__panel">
          <div className="bupt-live-grid">
            <article>
              <Gauge size={18} />
              <span>PUE</span>
              <strong>1.21</strong>
            </article>
            <article>
              <Globe2 size={18} />
              <span>CUE</span>
              <strong>0.42</strong>
            </article>
            <article>
              <Leaf size={18} />
              <span>24/7 CFE</span>
              <strong>72%</strong>
            </article>
            <article>
              <ShieldCheck size={18} />
              <span>Quota</span>
              <strong>61.7%</strong>
            </article>
          </div>
          <div className="bupt-flow-map" aria-label="AIDC digital twin flow map">
            <span>Campus</span>
            <i />
            <span>Building</span>
            <i />
            <span>Room</span>
            <i />
            <span>Rack</span>
            <i />
            <span>Server</span>
            <i />
            <span>Chip</span>
          </div>
        </div>
      </section>

      <section className="bupt-tool-grid">
        {toolLinks.map((item) => (
          <Link href={item.href} key={item.href}>
            <item.icon size={22} />
            <strong>{item.label}</strong>
            <span>{item.body}</span>
          </Link>
        ))}
      </section>

      <section className="bupt-sections">
        <article className="bupt-section-card">
          <div className="bupt-section-card__head">
            <Building2 size={22} />
            <h2>研究与平台模块</h2>
          </div>
          <div className="bupt-module-list">
            {researchModules.map((module) => (
              <span key={module}>{module}</span>
            ))}
          </div>
        </article>

        <article className="bupt-section-card">
          <div className="bupt-section-card__head">
            <Network size={22} />
            <h2>发布地址</h2>
          </div>
          <div className="bupt-publish-list">
            {publishTargets.map((target) => (
              <div key={target.label}>
                <span>{target.label}</span>
                <strong>{target.value}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="bupt-section-card bupt-section-card--wide">
          <div className="bupt-section-card__head">
            <Cpu size={22} />
            <h2>AIDC 方法链</h2>
          </div>
          <div className="bupt-method-chain">
            <span>Telemetry</span>
            <Zap size={16} />
            <span>Digital Twin</span>
            <Zap size={16} />
            <span>LCA + MRV</span>
            <Zap size={16} />
            <span>Quota / CFE</span>
            <Zap size={16} />
            <span>AI Optimization</span>
          </div>
        </article>
      </section>
    </main>
  );
}
