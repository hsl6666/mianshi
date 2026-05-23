import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import "./style.css";

const REF_WIDTH = 941;
const REF_HEIGHT = 1672;
const ASSET_BASE = "/assets/reference-style/tuijian";
const TITLE_SUFFIX = import.meta.env.VITE_APP_TITLE_SUFFIX || "全栈系统";

type AssetName =
  | "logo"
  | "search-bar"
  | "header-schedule"
  | "header-avatar"
  | "hero-banner"
  | "hero-robot"
  | "nav-tabs"
  | "card-inspiration"
  | "card-ai-recommend"
  | "card-open-day"
  | "card-trending"
  | "card-assistant"
  | "card-rankings"
  | "card-parent-guide"
  | "card-mood"
  | "card-travel"
  | "tab-bar";

const asset = (name: AssetName) => `${ASSET_BASE}/${name}.png`;

const contentCards: { key: string; asset: AssetName; className: string; label: string }[] = [
  { key: "inspiration", asset: "card-inspiration", className: "tuijian-card--inspiration", label: "今日灵感" },
  { key: "ai-recommend", asset: "card-ai-recommend", className: "tuijian-card--ai-recommend", label: "AI为你推荐" },
  { key: "open-day", asset: "card-open-day", className: "tuijian-card--open-day", label: "名校开放日" },
  { key: "trending", asset: "card-trending", className: "tuijian-card--trending", label: "大家都在看" },
  { key: "assistant", asset: "card-assistant", className: "tuijian-card--assistant", label: "智能填报助手" },
  { key: "rankings", asset: "card-rankings", className: "tuijian-card--rankings", label: "热门榜单" },
  { key: "parent-guide", asset: "card-parent-guide", className: "tuijian-card--parent-guide", label: "家长指南" },
  { key: "mood", asset: "card-mood", className: "tuijian-card--mood", label: "心情修复站" },
  { key: "travel", asset: "card-travel", className: "tuijian-card--travel", label: "未来旅行计划" },
];

const bottomTabs = [
  { key: "recommend", label: "推荐", active: true },
  { key: "discover", label: "发现", active: false },
  { key: "ai", label: "AI助手", active: false, ai: true },
  { key: "message", label: "消息", active: false },
  { key: "me", label: "我的", active: false },
];

function getScale() {
  if (typeof window === "undefined") return 1;
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth || REF_WIDTH;
  return Math.min(1, viewportWidth / REF_WIDTH);
}

export default function TuijianPage() {
  const [scale, setScale] = useState(getScale);

  useEffect(() => {
    const updateScale = () => setScale(getScale());
    updateScale();
    window.addEventListener("resize", updateScale);
    window.visualViewport?.addEventListener("resize", updateScale);
    return () => {
      window.removeEventListener("resize", updateScale);
      window.visualViewport?.removeEventListener("resize", updateScale);
    };
  }, []);

  const frameStyle = useMemo<CSSProperties>(
    () => ({
      width: REF_WIDTH * scale,
      minHeight: REF_HEIGHT * scale,
    }),
    [scale],
  );

  const screenStyle = useMemo<CSSProperties>(
    () => ({
      transform: `scale(${scale})`,
    }),
    [scale],
  );

  return (
    <main className="tuijian-page">
      <Helmet>
        <title>{`推荐 | ${TITLE_SUFFIX}`}</title>
      </Helmet>

      <div className="tuijian-scale-frame" style={frameStyle}>
        <div className="tuijian-screen" style={screenStyle}>
          <header className="tuijian-header" aria-label="升途AI 顶部导航">
            <img className="tuijian-logo" src={asset("logo")} alt="升途AI" draggable={false} />
            <label className="tuijian-search">
              <img src={asset("search-bar")} alt="" aria-hidden="true" draggable={false} />
              <input
                className="tuijian-search-input"
                type="search"
                placeholder="搜大学 / 专业 / 问答"
                aria-label="搜索大学、专业或问答"
              />
            </label>
            <button className="tuijian-header-schedule" type="button" aria-label="日程">
              <img src={asset("header-schedule")} alt="" aria-hidden="true" draggable={false} />
            </button>
            <button className="tuijian-header-avatar" type="button" aria-label="个人中心">
              <img src={asset("header-avatar")} alt="" aria-hidden="true" draggable={false} />
            </button>
          </header>

          <section className="tuijian-hero" aria-labelledby="tuijian-hero-title">
            <img className="tuijian-hero-bg" src={asset("hero-banner")} alt="" aria-hidden="true" draggable={false} />
            <img className="tuijian-hero-robot tuijian-decor" src={asset("hero-robot")} alt="" aria-hidden="true" draggable={false} />
            <div className="tuijian-hero-copy">
              <p className="tuijian-hero-kicker">升途AI · 你的未来合伙人</p>
              <h1 className="tuijian-hero-title" id="tuijian-hero-title">
                不止分数
                <br />
                更看见你的未来
              </h1>
              <p className="tuijian-hero-sub">✦ AI 科学填报，让每一分都更有价值</p>
              <button className="tuijian-hero-cta" type="button">
                立即探索未来
                <strong aria-hidden="true">›</strong>
              </button>
            </div>
          </section>

          <nav className="tuijian-nav-tabs" aria-label="频道导航">
            <img src={asset("nav-tabs")} alt="" aria-hidden="true" draggable={false} />
          </nav>

          <div className="tuijian-layer" aria-label="推荐内容">
            {contentCards.map((card) => (
              <button className={`tuijian-card ${card.className}`} key={card.key} type="button" aria-label={card.label}>
                <img src={asset(card.asset)} alt="" aria-hidden="true" draggable={false} />
              </button>
            ))}
          </div>

          <nav className="tuijian-tab-bar" aria-label="底部导航">
            <img className="tuijian-tab-bar-bg" src={asset("tab-bar")} alt="" aria-hidden="true" draggable={false} />
            <div className="tuijian-tab-actions">
              {bottomTabs.map((tab) => (
                <button
                  className={[
                    "tuijian-tab-btn",
                    tab.active ? "is-active" : undefined,
                    tab.ai ? "tuijian-tab-btn--ai" : undefined,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  key={tab.key}
                  type="button"
                  aria-current={tab.active ? "page" : undefined}
                >
                  {tab.ai ? <span className="tuijian-tab-ai-icon">AI</span> : <span aria-hidden="true">●</span>}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </nav>
        </div>
      </div>
    </main>
  );
}
