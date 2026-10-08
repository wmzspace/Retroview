import React from 'react';
import { CATEGORIES, QMETA, INTERVIEW_STATUS, findFreqGroups } from './constants.js';

/**
 * 首页 Dashboard：
 * - Hero：总览数据 + 问 AI / 上传面经快捷入口
 * - 掌握度分布条
 * - 分类分布（点击跳分类视图）
 * - 单场面试入口（点击跳面试视图）
 * - 高频考点 / 没答上来优先攻克（点击跳具体题目）
 */
export default function Dashboard({
  stats,
  allItems,
  onSelectCategory,
  onSelectCompany,
  onDeleteCompany,
  onOpenChat,
  onOpenImport,
  onJumpToItem,
}) {
  if (!stats || !allItems.length) return <div className="empty">加载中…</div>;

  const total = allItems.length;
  const byQuality = { good: 0, partial: 0, poor: 0 };
  for (const it of allItems) byQuality[it.quality] = (byQuality[it.quality] || 0) + 1;
  const goodRate = total ? Math.round((byQuality.good / total) * 100) : 0;

  const catEntries = CATEGORIES
    .map((c) => ({ ...c, n: stats.byCategory?.[c.id] || 0 }))
    .filter((c) => c.n > 0)
    .sort((a, b) => b.n - a.n);

  const companies = Object.entries(stats.byCompany || {}).sort((a, b) => b[1] - a[1]);

  const freq = findFreqGroups(allItems).slice(0, 6);
  const weakItems = allItems
    .filter((i) => i.quality === 'poor')
    .sort((a, b) => (a.company > b.company ? 1 : -1))
    .slice(0, 8);

  return (
    <div className="dashboard">
      {/* ===== Hero ===== */}
      <div className="dash-hero">
        <div className="hero-text">
          <h2>秋招面经 Dashboard</h2>
          <p>
            已收录 <b>{total}</b> 个知识点 · 覆盖 <b>{companies.length}</b> 家公司 ·
            掌握率 <b style={{ color: QMETA.good.color }}>{goodRate}%</b>
          </p>
        </div>
        <div className="hero-actions">
          <button className="hero-btn primary" onClick={onOpenChat}>
            <span className="hb-icon">💬</span>
            <span><b>问 AI</b><i>基于你的面经回答</i></span>
          </button>
          <button className="hero-btn" onClick={onOpenImport}>
            <span className="hb-icon">⬆</span>
            <span><b>上传面经</b><i>AI 分析后入库</i></span>
          </button>
        </div>
      </div>

      {/* ===== 掌握度概览 ===== */}
      <div className="dash-grid-4">
        <div className="dash-card stat">
          <div className="num" style={{ color: '#4f6ef7' }}>{total}</div>
          <div className="lbl">总知识点</div>
        </div>
        {Object.entries(QMETA).map(([q, m]) => (
          <div className="dash-card stat" key={q}>
            <div className="num" style={{ color: m.color }}>{byQuality[q]}</div>
            <div className="lbl">{m.label}</div>
          </div>
        ))}
      </div>

      {/* ===== 掌握度分布条 ===== */}
      <div className="dash-card">
        <div className="dc-title">掌握度分布</div>
        <div className="mastery-bar">
          {Object.entries(QMETA).map(([q, m]) => (
            <div
              key={q}
              className="mastery-seg"
              style={{ width: `${total ? (byQuality[q] / total) * 100 : 0}%`, background: m.color }}
              title={`${m.label} ${byQuality[q]} 题`}
            />
          ))}
        </div>
        <div className="mastery-legend">
          {Object.entries(QMETA).map(([q, m]) => (
            <span key={q}><i style={{ background: m.color }} />{m.label} {byQuality[q]}</span>
          ))}
        </div>
      </div>

      {/* ===== 分类分布 + 单场面试 ===== */}
      <div className="dash-grid-2">
        <div className="dash-card">
          <div className="dc-title">分类分布 <span className="dc-sub">点击进入分类</span></div>
          {catEntries.map((c) => (
            <div className="cat-bar-row" key={c.id} onClick={() => onSelectCategory(c.id)}>
              <span className="cb-label"><i className="gdot" style={{ background: c.color }} />{c.label}</span>
              <div className="cb-track">
                <div className="cb-fill" style={{ width: `${(c.n / total) * 100}%`, background: c.color }} />
              </div>
              <span className="cb-count">{c.n}</span>
            </div>
          ))}
        </div>

        <div className="dash-card">
          <div className="dc-title">单场面试 <span className="dc-sub">点击进入复盘</span></div>
          <div className="company-grid">
            {companies.map(([company, n]) => {
              const good = allItems.filter((i) => i.company === company && i.quality === 'good').length;
              const round = allItems.find((i) => i.company === company)?.round || '面试';
              return (
                <div className="company-card" key={company} onClick={() => onSelectCompany(company)}>
                  <button
                    className="cc-del"
                    title={`删除「${company}」整场面试`}
                    onClick={(e) => { e.stopPropagation(); onDeleteCompany?.(company); }}
                  >
                    🗑
                  </button>
                  <div className="cc-name">{company} · {round}</div>
                  <div className="cc-meta">
                    <span className="cc-n">
                      {n} 题
                      {stats.interviews?.[company] && (
                        <span
                          className="cc-status"
                          style={{ color: INTERVIEW_STATUS[stats.interviews[company]]?.color }}
                        >
                          {INTERVIEW_STATUS[stats.interviews[company]]?.label}
                        </span>
                      )}
                    </span>
                    <span className="cc-rate" style={{ color: QMETA.good.color }}>
                      掌握 {Math.round((good / n) * 100)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ===== 高频考点 + 优先攻克 ===== */}
      <div className="dash-grid-2">
        <div className="dash-card scroll">
          <div className="dc-title">高频考点 <span className="dc-sub">多家公司都问到</span></div>
          {freq.length ? freq.map((g, i) => {
            const comps = [...new Set(g.map((x) => x.company))];
            return (
              <div className="freq-row" key={i} onClick={() => onJumpToItem({ id: g[0].id })}>
                <div className="fq">{g[0].question}</div>
                <div className="fm">
                  {comps.slice(0, 4).map((c) => <span className="tag" key={c}>{c}</span>)}
                  <span className="tag hot">被问 {g.length} 次</span>
                </div>
              </div>
            );
          }) : <div className="empty" style={{ padding: '20px 0' }}>暂无数据</div>}
        </div>

        <div className="dash-card scroll">
          <div className="dc-title">
            优先攻克 <span className="dc-sub">没答上来的题（红色）</span>
          </div>
          {weakItems.length ? weakItems.map((it) => (
            <div className="weak-row" key={it.id} onClick={() => onJumpToItem({ id: it.id })}>
              <span className="wq">{it.question}</span>
              <span className="tag" style={{ background: '#f1f5f9', color: 'var(--muted)' }}>{it.company}</span>
            </div>
          )) : <div className="empty" style={{ padding: '20px 0' }}>没有没答上来的题，继续保持！</div>}
        </div>
      </div>
    </div>
  );
}
