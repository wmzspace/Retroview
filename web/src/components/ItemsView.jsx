import React, { useEffect, useMemo, useRef, useState } from 'react';
import ListView from './ListView.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import Icon from './Icon.jsx';
import { QMETA, INTERVIEW_STATUS, catOf, splitRound } from './constants.js';

const QFILTERS = [
  { id: 'all', label: '全部' },
  { id: 'weak', label: '待加强', test: (i) => i.quality !== 'good', hint: '答得欠缺 + 没答上来' },
  ...Object.entries(QMETA).map(([id, m]) => ({ id, label: m.label, test: (i) => i.quality === id })),
];

/**
 * 题目视图（全部 / 分类 / 单场面试 共用）
 * 筛选状态都在组件内，切换视图时由父组件以 key 重新挂载，从而自然重置
 */
export default function ItemsView({
  view, allItems, stats, freqGroups, focusId,
  onToggleFlag, onToggleResolve, onDeleteItems, onSetStatus, onJumpToItem,
}) {
  const isInterview = view.type === 'interview';
  const [search, setSearch] = useState('');
  const [qf, setQf] = useState(view.q || 'all');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [hideResolved, setHideResolved] = useState(false);
  const [catFilter, setCatFilter] = useState('all');
  const [groupBy, setGroupBy] = useState(isInterview ? 'category' : '');
  const [openIds, setOpenIds] = useState(() => new Set(focusId ? [focusId] : []));
  const [selectMode, setSelectMode] = useState(false);
  const [selection, setSelection] = useState(new Set());
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [flashId, setFlashId] = useState(focusId);
  const searchRef = useRef(null);

  // 跳转定位：滚动到目标题并短暂高亮
  useEffect(() => {
    if (!focusId) return;
    const t1 = setTimeout(() => {
      document.getElementById(`card-${focusId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
    const t2 = setTimeout(() => setFlashId(null), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [focusId]);

  // 「/」聚焦搜索，Esc 清空搜索 / 退出批量
  useEffect(() => {
    const h = (e) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
      if (e.key === '/' && !typing) { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'Escape' && document.activeElement === searchRef.current) { setSearch(''); searchRef.current.blur(); }
      else if (e.key === 'Escape' && selectMode && !document.querySelector('.modal-overlay')) exitSelect();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  // 当前视图的静态题目集（不随筛选变化，用于计数）
  const viewItems = useMemo(() => {
    if (view.type === 'category') return allItems.filter((i) => i.category === view.id);
    if (isInterview) return allItems.filter((i) => i.company === view.company);
    return allItems;
  }, [allItems, view, isInterview]);

  // 掌握度计数跟随分类下拉（面试视图），其余筛选不影响计数
  const baseItems = useMemo(
    () => (catFilter === 'all' ? viewItems : viewItems.filter((i) => i.category === catFilter)),
    [viewItems, catFilter],
  );

  const kw = search.trim();
  const filtered = useMemo(() => {
    let items = baseItems;
    const f = QFILTERS.find((x) => x.id === qf);
    if (f?.test) items = items.filter(f.test);
    if (flaggedOnly) items = items.filter((i) => i.flagged);
    if (hideResolved) items = items.filter((i) => !i.resolved);
    if (kw) {
      const k = kw.toLowerCase();
      items = items.filter((i) =>
        i.question.toLowerCase().includes(k)
        || i.quote.toLowerCase().includes(k)
        || i.answer_points.join(' ').toLowerCase().includes(k));
    }
    return items;
  }, [baseItems, qf, flaggedOnly, hideResolved, kw]);

  const countOf = (f) => (f.test ? baseItems.filter(f.test).length : baseItems.length);
  const flaggedCount = baseItems.filter((i) => i.flagged).length;
  const resolvedCount = viewItems.filter((i) => i.resolved).length;
  const filtersActive = qf !== 'all' || flaggedOnly || hideResolved || kw || catFilter !== 'all';

  const clearFilters = () => {
    setSearch(''); setQf('all'); setFlaggedOnly(false); setHideResolved(false); setCatFilter('all');
  };

  const toggleCard = (id) => setOpenIds((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const allOpen = filtered.length > 0 && filtered.every((i) => openIds.has(i.id));
  const toggleAll = () => setOpenIds(allOpen ? new Set() : new Set(filtered.map((i) => i.id)));

  const toggleSelect = (id, checked) => setSelection((prev) => {
    const next = new Set(prev);
    checked ? next.add(id) : next.delete(id);
    return next;
  });
  const allSelected = filtered.length > 0 && filtered.every((i) => selection.has(i.id));
  const selectAll = () => setSelection(allSelected ? new Set() : new Set(filtered.map((i) => i.id)));
  function exitSelect() { setSelectMode(false); setSelection(new Set()); }

  const doDelete = async () => {
    setDeleting(true);
    const ok = await onDeleteItems([...selection]);
    setDeleting(false);
    setConfirmDel(false);
    if (ok) exitSelect();
  };

  // ===== 标题区 =====
  const cat = view.type === 'category' ? catOf(view.id) : null;
  const ivRound = isInterview ? splitRound(viewItems[0]?.round) : null;
  const title = cat ? cat.label : isInterview ? view.company : '全部题目';
  const subtitle = cat ? cat.desc
    : isInterview ? [ivRound.date, ivRound.round].filter(Boolean).join(' ') + ' 复盘'
    : '所有面试里被问到的题，按场次排列';
  const status = isInterview ? stats?.interviews?.[view.company] || '' : '';
  const pct = viewItems.length ? Math.round((resolvedCount / viewItems.length) * 100) : 0;

  const interviewCats = useMemo(() => {
    const m = {};
    for (const i of viewItems) m[i.category] = (m[i.category] || 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [viewItems]);

  const showFreq = view.type === 'overview' && !filtersActive && freqGroups.length > 0;

  return (
    <div className="items-view">
      <header className="page-head">
        <div className="page-title">
          {cat && <span className="title-dot" style={{ background: cat.color }} />}
          <h2>{title}</h2>
          {isInterview && (
            <label className={`status-select ${INTERVIEW_STATUS[status]?.tone || ''}`}>
              <span className="sr-only">面试结果</span>
              <select value={status} onChange={(e) => onSetStatus(view.company, e.target.value)}>
                <option value="">结果未标记</option>
                {Object.entries(INTERVIEW_STATUS).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}
              </select>
            </label>
          )}
        </div>
        {subtitle && <p className="page-sub">{subtitle}</p>}
        <div className="progress" title={`已解决 ${resolvedCount} / ${viewItems.length}`}>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
          <span>已解决 <b>{resolvedCount}</b> / {viewItems.length}</span>
        </div>
      </header>

      {showFreq && (
        <section className="freq-strip">
          <h3>多家公司都问过</h3>
          <div className="freq-list">
            {freqGroups.slice(0, 6).map((g) => {
              const companies = [...new Set(g.map((x) => x.company))];
              return (
                <button key={g[0].id} className="freq-item" onClick={() => onJumpToItem(g[0])}>
                  <span className="fq">{g[0].question}</span>
                  <span className="fm">{companies.join('、')}<b>{g.length} 次</b></span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ===== 筛选栏（吸顶） ===== */}
      <div className="filterbar">
        <div className="filter-top">
          <div className="search-box">
            <Icon name="search" />
            <input
              ref={searchRef} value={search} type="search"
              placeholder="搜索题目、要点、原话"
              aria-label="搜索题目"
              onChange={(e) => setSearch(e.target.value)}
            />
            {search ? (
              <button className="icon-btn" onClick={() => setSearch('')} aria-label="清空搜索"><Icon name="close" size={14} /></button>
            ) : <kbd title="按 / 快速搜索">/</kbd>}
          </div>
          {isInterview && interviewCats.length > 1 && (
            <select className="select" value={catFilter} onChange={(e) => setCatFilter(e.target.value)} aria-label="按分类筛选">
              <option value="all">全部分类</option>
              {interviewCats.map(([id, n]) => <option key={id} value={id}>{catOf(id).label}（{n}）</option>)}
            </select>
          )}
        </div>

        <div className="filter-row">
          <div className="seg" role="radiogroup" aria-label="按掌握度筛选">
            {QFILTERS.map((f) => (
              <button
                key={f.id} role="radio" aria-checked={qf === f.id}
                className={`seg-btn ${f.id} ${qf === f.id ? 'on' : ''}`}
                title={f.hint}
                onClick={() => setQf(f.id)}
              >
                {f.label}<span>{countOf(f)}</span>
              </button>
            ))}
          </div>
          <div className="toggles">
            <button className={`chip ${flaggedOnly ? 'on' : ''}`} aria-pressed={flaggedOnly} onClick={() => setFlaggedOnly(!flaggedOnly)}>
              <Icon name="flag" size={14} />重点<span>{flaggedCount}</span>
            </button>
            <button className={`chip ${hideResolved ? 'on' : ''}`} aria-pressed={hideResolved} onClick={() => setHideResolved(!hideResolved)}>
              <Icon name="check" size={14} />隐藏已解决
            </button>
          </div>
        </div>
      </div>

      {/* ===== 列表操作条 ===== */}
      <div className="list-bar">
        {selectMode ? (
          <>
            <label className="select-all">
              <input type="checkbox" checked={allSelected} onChange={selectAll} />
              全选当前 {filtered.length} 题
            </label>
            <span className="muted">已选 {selection.size} 题</span>
            <span className="spacer" />
            <button className="btn danger" disabled={!selection.size} onClick={() => setConfirmDel(true)}>
              <Icon name="trash" size={14} />删除
            </button>
            <button className="btn" onClick={exitSelect}>完成</button>
          </>
        ) : (
          <>
            <span className="muted">
              {filtersActive ? <>筛出 <b>{filtered.length}</b> 题</> : <>共 <b>{filtered.length}</b> 题</>}
              {filtersActive && <button className="link-btn" onClick={clearFilters}>清除筛选</button>}
            </span>
            <span className="spacer" />
            <select className="select ghost" value={groupBy} onChange={(e) => setGroupBy(e.target.value)} aria-label="分组方式">
              <option value="">不分组</option>
              {view.type !== 'category' && <option value="category">按分类分组</option>}
              {!isInterview && <option value="company">按面试分组</option>}
            </select>
            <button className="btn ghost" onClick={toggleAll} disabled={!filtered.length}>
              <Icon name={allOpen ? 'collapse' : 'expand'} size={14} />{allOpen ? '全部收起' : '全部展开'}
            </button>
            <button className="btn ghost" onClick={() => setSelectMode(true)} disabled={!filtered.length}>
              <Icon name="select" size={14} />批量管理
            </button>
          </>
        )}
      </div>

      <ListView
        items={filtered}
        groupBy={groupBy || null}
        selectMode={selectMode}
        selection={selection}
        onToggleSelect={toggleSelect}
        onToggleCard={toggleCard}
        openIds={openIds}
        onToggleFlag={onToggleFlag}
        onToggleResolve={onToggleResolve}
        keyword={kw}
        flashId={flashId}
        showCompany={!isInterview}
        empty={
          <div className="empty">
            {kw ? <p>没有包含「{kw}」的题目。</p> : <p>当前筛选下没有题目。</p>}
            {filtersActive && <button className="btn" onClick={clearFilters}>清除筛选</button>}
          </div>
        }
      />

      <ConfirmDialog
        open={confirmDel}
        title="删除题目"
        message={`删除选中的 ${selection.size} 道题？删除后无法恢复，面试原文保留，问答助手仍可检索原文。`}
        confirmText={`删除 ${selection.size} 题`}
        danger busy={deleting}
        onConfirm={doDelete}
        onClose={() => setConfirmDel(false)}
      />
    </div>
  );
}
