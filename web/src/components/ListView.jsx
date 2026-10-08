import React, { useEffect, useRef, useState } from 'react';
import { QMETA, CAT_MAP } from './constants.js';

/** 单张题目卡片 */
export function QCard({ item, open, onToggle, selectMode, checked, onCheck, onFlag, onResolve }) {
  const cat = CAT_MAP[item.category];
  const q = QMETA[item.quality];
  // 轮次形如「9.11 一面」：拆出日期单独成标签
  const m = String(item.round || '').match(/^(\d{1,2}\.\d{1,2}(?:\.\d{1,2})?)\s*(.*)$/);
  const date = m ? m[1] : '';
  const roundLabel = m ? (m[2] || '面试') : item.round;

  // 点击 ✓ 后在按钮旁弹出短提示（resolved 状态变化时触发）
  const [hint, setHint] = useState('');
  const prevResolved = useRef(item.resolved);
  const hintTimer = useRef(null);
  useEffect(() => {
    if (prevResolved.current !== item.resolved) {
      prevResolved.current = item.resolved;
      if (hintTimer.current) clearTimeout(hintTimer.current);
      setHint(item.resolved ? '已解决' : '已取消解决');
      hintTimer.current = setTimeout(() => setHint(''), 1500);
    }
  }, [item.resolved]);

  return (
    <div className={`q-card ${open ? 'open' : ''} ${item.resolved ? 'resolved' : ''}`} id={`card-${item.id}`}>
      <div className="head" onClick={onToggle}>
        {selectMode && (
          <input
            type="checkbox" className="q-check" checked={checked}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onCheck(item.id, e.target.checked)}
          />
        )}
        <div className="qbody">
          <div className="qtext">{item.question}</div>
          <div className="metarow">
            <span className="badge cat" style={{ background: cat.color }}>{cat.label}</span>
            <span className="badge company">{item.company} · {roundLabel}</span>
            {date && <span className="badge time" title="面试日期">📅 {date}</span>}
            <span className={`badge quality ${item.quality}`}>{q.label}</span>
          </div>
        </div>
        <div className="q-corner">
          {hint && <span className="q-hint">{hint}</span>}
          <button
            className={`q-resolve ${item.resolved ? 'on' : ''}`}
            title={item.resolved ? '取消「已解决」标记' : '标记为已解决'}
            onClick={(e) => { e.stopPropagation(); onResolve?.(item.id); }}
          >
            ✓
          </button>
          <button
            className={`q-flag ${item.flagged ? 'on' : ''}`}
            title={item.flagged ? '取消红旗标记' : '插红旗标记'}
            onClick={(e) => { e.stopPropagation(); onFlag?.(item.id); }}
          >
            🚩
          </button>
        </div>
        <span className="arrow">▶</span>
      </div>
      <div className="detail">
        <div className="dtitle">回答要点</div>
        <ul>{item.answer_points.map((p, i) => <li key={i}>{p}</li>)}</ul>
        <div className="dtitle">原文定位</div>
        <div className="quote">“{item.quote}”</div>
      </div>
    </div>
  );
}

/** 通用题目列表：支持批量选择 + 分组展示 */
export default function ListView({
  items,
  grouped = false,
  selectMode,
  selection,
  onToggleSelect,
  onToggleCard,
  openIds,
  onToggleFlag,
  onToggleResolve,
}) {
  if (!items.length) return <div className="empty">没有匹配的题目，换个关键词试试</div>;

  const renderCard = (it) => (
    <QCard
      key={it.id} item={it}
      open={openIds.has(it.id)}
      onToggle={() => onToggleCard(it.id)}
      selectMode={selectMode}
      checked={selection.has(it.id)}
      onCheck={onToggleSelect}
      onFlag={onToggleFlag}
      onResolve={onToggleResolve}
    />
  );

  if (!grouped) return <div className="card-list">{items.map(renderCard)}</div>;

  // 按分类分组
  const groups = {};
  for (const it of items) (groups[it.category] ||= []).push(it);
  return (
    <div>
      {Object.entries(groups).map(([catId, list]) => (
        <div key={catId}>
          <div className="group-title">
            <span className="gdot" style={{ background: CAT_MAP[catId]?.color }} />
            {CAT_MAP[catId]?.label || catId}
            <span className="gcount">· {list.length} 题</span>
          </div>
          <div className="card-list">{list.map(renderCard)}</div>
        </div>
      ))}
    </div>
  );
}
