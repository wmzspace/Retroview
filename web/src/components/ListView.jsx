import React from 'react';
import Icon, { GradeMark } from './Icon.jsx';
import { QMETA, catOf, splitRound } from './constants.js';

/** 搜索关键词高亮 */
export function Highlight({ text, kw }) {
  if (!kw) return text;
  const lower = text.toLowerCase();
  const k = kw.toLowerCase();
  const out = [];
  let i = 0;
  let at;
  while ((at = lower.indexOf(k, i)) !== -1) {
    if (at > i) out.push(text.slice(i, at));
    out.push(<mark key={at}>{text.slice(at, at + k.length)}</mark>);
    i = at + k.length;
  }
  out.push(text.slice(i));
  return out;
}

/** 单道题：一行题目 + 展开后的回答要点与原文 */
export function QRow({ item, open, onToggle, selectMode, checked, onCheck, onFlag, onResolve, keyword, flash, showCompany = true }) {
  const cat = catOf(item.category);
  const q = QMETA[item.quality];
  const { date, round } = splitRound(item.round);
  const headId = `qh-${item.id}`;

  const onHeadKey = (e) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectMode ? onCheck(item.id, !checked) : onToggle(); }
  };

  return (
    <li
      id={`card-${item.id}`}
      className={`q-row ${open ? 'open' : ''} ${item.resolved ? 'resolved' : ''} ${checked ? 'checked' : ''} ${flash ? 'flash' : ''}`}
    >
      <div
        className="q-head" id={headId} role="button" tabIndex={0}
        aria-expanded={selectMode ? undefined : open}
        onClick={() => (selectMode ? onCheck(item.id, !checked) : onToggle())}
        onKeyDown={onHeadKey}
      >
        {selectMode ? (
          <input
            type="checkbox" className="q-check" checked={checked} tabIndex={-1}
            aria-label="选择这道题"
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onCheck(item.id, e.target.checked)}
          />
        ) : (
          <span className="q-grade" title={q.label}><GradeMark quality={item.quality} /></span>
        )}
        <div className="q-body">
          <div className="q-text"><Highlight text={item.question} kw={keyword} /></div>
          <div className="q-meta">
            <span className="q-cat"><i style={{ background: cat.color }} />{cat.label}</span>
            {showCompany && <span>{item.company} {round}</span>}
            {date && <span title="面试日期">{date}</span>}
            <span className={`q-quality ${item.quality}`}>{q.label}</span>
            {item.resolved && <span className="q-done">已解决</span>}
          </div>
        </div>
        <Icon name="chevron" className="q-arrow" />
      </div>

      {!selectMode && (
        <div className="q-actions">
          <button
            className={`q-act resolve ${item.resolved ? 'on' : ''}`}
            title={item.resolved ? '取消已解决' : '标记为已解决'}
            aria-pressed={!!item.resolved}
            onClick={() => onResolve?.(item.id)}
          >
            <Icon name="check" size={15} strokeWidth={2} />
          </button>
          <button
            className={`q-act flag ${item.flagged ? 'on' : ''}`}
            title={item.flagged ? '取消标记' : '标记为重点'}
            aria-pressed={!!item.flagged}
            onClick={() => onFlag?.(item.id)}
          >
            <Icon name="flag" size={15} />
          </button>
        </div>
      )}

      {open && !selectMode && (
        <div className="q-detail" role="region" aria-labelledby={headId}>
          <h4>回答要点</h4>
          <ol>{item.answer_points.map((p, i) => <li key={i}><Highlight text={p} kw={keyword} /></li>)}</ol>
          <h4>面试官原话</h4>
          <blockquote><Highlight text={item.quote} kw={keyword} /></blockquote>
        </div>
      )}
    </li>
  );
}

/** 题目列表：支持批量选择 + 按分类 / 按公司分组 */
export default function ListView({
  items, groupBy = null, selectMode, selection, onToggleSelect, onToggleCard, openIds,
  onToggleFlag, onToggleResolve, keyword, flashId, showCompany = true, empty,
}) {
  if (!items.length) return empty;

  const renderRow = (it) => (
    <QRow
      key={it.id} item={it}
      open={openIds.has(it.id)}
      onToggle={() => onToggleCard(it.id)}
      selectMode={selectMode}
      checked={selection.has(it.id)}
      onCheck={onToggleSelect}
      onFlag={onToggleFlag}
      onResolve={onToggleResolve}
      keyword={keyword}
      flash={flashId === it.id}
      showCompany={showCompany}
    />
  );

  if (!groupBy) return <ul className="sheet">{items.map(renderRow)}</ul>;

  const groups = {};
  for (const it of items) (groups[it[groupBy]] ||= []).push(it);
  return (
    <div className="groups">
      {Object.entries(groups).map(([key, list]) => (
        <section key={key}>
          <h3 className="group-title">
            {groupBy === 'category' && <i style={{ background: catOf(key).color }} />}
            {groupBy === 'category' ? catOf(key).label : key}
            <span>{list.length} 题</span>
          </h3>
          <ul className="sheet">{list.map(renderRow)}</ul>
        </section>
      ))}
    </div>
  );
}
