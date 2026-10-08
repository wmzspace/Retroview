import React, { useEffect, useMemo, useState } from 'react';
import { fetchStats, fetchAllItems, deleteItems, deleteInterview, toggleFlag, toggleResolve, setInterviewStatus } from './api.js';
import ListView from './components/ListView.jsx';
import InterviewView from './components/InterviewView.jsx';
import Chat from './components/Chat.jsx';
import ImportDialog from './components/ImportDialog.jsx';
import Dashboard from './components/Dashboard.jsx';
import ConfirmDialog from './components/ConfirmDialog.jsx';
import { CATEGORIES, CAT_MAP, QMETA, INTERVIEW_STATUS, setCategories, findFreqGroups } from './components/constants.js';

export default function App() {
  const [stats, setStats] = useState(null);
  const [allItems, setAllItems] = useState([]);
  const [view, setView] = useState({ type: 'home' }); // home | overview | category | interview | chat
  const [search, setSearch] = useState('');
  const [weakOnly, setWeakOnly] = useState(false);
  const [qualityFilter, setQualityFilter] = useState(null); // null | good | partial | poor
  const [flaggedOnly, setFlaggedOnly] = useState(false);    // 只看红旗标记
  const [catFilter, setCatFilter] = useState('all');        // 单场面试视图：分类下拉筛选
  const [openIds, setOpenIds] = useState(new Set());
  const [chatOpen, setChatOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // 批量删除
  const [selectMode, setSelectMode] = useState(false);
  const [selection, setSelection] = useState(new Set());
  const [deleting, setDeleting] = useState(false);

  // 删除整场面试（悬浮垃圾桶 → 确认弹窗）
  const [delCompany, setDelCompany] = useState(null); // 待删除的公司名，null 表示弹窗关闭
  const [delBusy, setDelBusy] = useState(false);

  useEffect(() => {
    fetchStats().then((s) => { setStats(s); setCategories(s.categories); }).catch(console.error);
    fetchAllItems().then(setAllItems).catch(console.error);
  }, []);

  // 切换视图时重置分类下拉
  useEffect(() => setCatFilter('all'), [view]);

  const toggleCard = (id) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleSelect = (id, checked) =>
    setSelection((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });

  const doDelete = async () => {
    if (!selection.size || deleting) return;
    if (!window.confirm(`确认删除选中的 ${selection.size} 条题目？删除后不可恢复（原文切片保留）。`)) return;
    setDeleting(true);
    try {
      const ids = [...selection];
      await deleteItems(ids);
      setAllItems((items) => items.filter((i) => !ids.includes(i.id)));
      setStats(await fetchStats());
      setSelection(new Set());
      setSelectMode(false);
    } catch (e) {
      alert('删除失败：' + e.message);
    } finally {
      setDeleting(false);
    }
  };

  /** 确认删除整场面试：调后端接口，本地同步移除并刷新统计 */
  const doDeleteInterview = async () => {
    if (!delCompany || delBusy) return;
    setDelBusy(true);
    try {
      const r = await deleteInterview(delCompany);
      const company = delCompany;
      setAllItems((items) => items.filter((i) => i.company !== company));
      if (r?.stats) {
        setStats(r.stats);
        setCategories(r.stats.categories);
      }
      if (view.type === 'interview' && view.company === company) setView({ type: 'home' });
      setDelCompany(null);
    } catch (e) {
      alert('删除失败：' + (e.message || '请确认后端服务已启动'));
    } finally {
      setDelBusy(false);
    }
  };

  /** 已解决标记切换：调后端持久化，本地同步 + 轻提示 */
  const handleToggleResolve = async (id) => {
    try {
      const r = await toggleResolve(id);
      if (r.ok) {
        setAllItems((items) => items.map((i) => (i.id === id ? { ...i, resolved: r.resolved } : i)));
      }
    } catch {
      alert('标记失败，请确认后端服务已启动');
    }
  };

  /** 设置面试结果状态：调后端持久化，本地同步统计里的 interviews 表 */
  const handleSetStatus = async (company, status) => {
    try {
      const r = await setInterviewStatus(company, status);
      if (r.stats) {
        setStats(r.stats);
        setCategories(r.stats.categories);
      }
    } catch (e) {
      alert('状态更新失败：' + e.message);
    }
  };

  /** 红旗标记切换：调后端持久化，本地同步 */
  const handleToggleFlag = async (id) => {
    try {
      const r = await toggleFlag(id);
      if (r.ok) {
        setAllItems((items) => items.map((i) => (i.id === id ? { ...i, flagged: r.flagged } : i)));
      }
    } catch {
      alert('标记失败，请确认后端服务已启动');
    }
  };

  // ===== 当前视图数据 =====
  const filtered = useMemo(() => {
    let items = allItems;
    if (view.type === 'category') items = items.filter((i) => i.category === view.id);
    if (view.type === 'interview') {
      items = items.filter((i) => i.company === view.company);
      if (catFilter !== 'all') items = items.filter((i) => i.category === catFilter);
    }
    if (qualityFilter) items = items.filter((i) => i.quality === qualityFilter);
    else if (weakOnly) items = items.filter((i) => i.quality !== 'good');
    if (flaggedOnly) items = items.filter((i) => i.flagged);
    if (search.trim()) {
      const kw = search.trim().toLowerCase();
      items = items.filter((i) =>
        i.question.toLowerCase().includes(kw) ||
        i.quote.toLowerCase().includes(kw) ||
        i.answer_points.join(' ').toLowerCase().includes(kw),
      );
    }
    return items;
  }, [allItems, view, weakOnly, qualityFilter, flaggedOnly, catFilter, search]);

  const interview = useMemo(() => {
    if (view.type !== 'interview') return null;
    const items = allItems.filter((i) => i.company === view.company);
    const byCategory = {};
    const byQuality = {};
    for (const it of items) {
      byCategory[it.category] = (byCategory[it.category] || 0) + 1;
      byQuality[it.quality] = (byQuality[it.quality] || 0) + 1;
    }
    return {
      company: view.company,
      round: items[0]?.round,
      total: items.length,
      byCategory,
      byQuality,
      items,
    };
  }, [view, allItems]);

  const freqGroups = useMemo(() => findFreqGroups(allItems), [allItems]);

  /** 聊天会话隔离：首页/总览/每个分类/每场面试 各自独立会话 */
  const chatSessionId =
    view.type === 'chat' ? 'home'
    : view.type === 'category' ? `cat:${view.id}`
    : view.type === 'interview' ? `interview:${view.company}`
    : 'overview';
  const chatSessionLabel =
    view.type === 'chat' ? '首页会话'
    : view.type === 'category' ? CATEGORIES.find((c) => c.id === view.id)?.label
    : view.type === 'interview' ? view.company
    : '全部题目';

  const gotoItem = (ref) => {
    // 从聊天/首页跳转：定位到该题（切到 overview + 展开卡片）
    const item = allItems.find((i) => i.id === ref.id);
    if (!item) return;
    setView({ type: 'overview' });
    setQualityFilter(null);
    setWeakOnly(false);
    setSearch('');
    setOpenIds(new Set([item.id]));
    setChatOpen(false);
    setTimeout(() => {
      document.getElementById(`card-${item.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
  };

  /** 当前视图的静态题目集（分类视图按分类、面试视图按公司，其余为全部；不随筛选/搜索变化） */
  const viewItems = useMemo(() => {
    if (view.type === 'category') return allItems.filter((i) => i.category === view.id);
    if (view.type === 'interview') return allItems.filter((i) => i.company === view.company);
    return allItems;
  }, [allItems, view]);

  /** 掌握度计数：基于静态视图集合，点击筛选不改变显示数量 */
  const qualityCount = (q) => viewItems.filter((i) => i.quality === q).length;

  /** 点击掌握度卡片：切换筛选；再点一次取消 */
  const toggleQuality = (q) => {
    setQualityFilter((prev) => (prev === q ? null : q));
    setWeakOnly(false);
  };

  /** 上传导入成功后刷新首页数据 */
  const handleImported = async () => {
    const s = await fetchStats();
    setStats(s);
    setCategories(s.categories);
    setAllItems(await fetchAllItems());
  };

  return (
    <div className="app">
      {/* ===== 侧栏 ===== */}
      <aside className="sidebar">
        <div className="brand">
          <h1><span className="logo">面</span>面经复盘知识库</h1>
          <p>
            {stats ? `${stats.total} 个知识点 · ${stats.companies?.length || 0} 家公司` : '加载中…'}
          </p>
        </div>
        <div className="nav-section">
          <div className="nav-title">导航</div>
          <div
            className={`cat-item ${view.type === 'home' ? 'active' : ''}`}
            onClick={() => setView({ type: 'home' })}
          >
            <span className="cat-dot" style={{ background: '#111827' }} />
            <span className="name">首页 · Dashboard</span>
          </div>
          <div
            className={`cat-item ${view.type === 'chat' ? 'active' : ''}`}
            onClick={() => { setView({ type: 'chat' }); setChatOpen(false); }}
          >
            <span className="cat-dot" style={{ background: '#7c5cff' }} />
            <span className="name">💬 问答机器人</span>
          </div>
        </div>
        <div className="nav-section">
          <div className="nav-title">分类</div>
          <div
            className={`cat-item ${view.type === 'overview' ? 'active' : ''}`}
            onClick={() => setView({ type: 'overview' })}
          >
            <span className="cat-dot" style={{ background: '#4f6ef7' }} />
            <span className="name">全部</span>
            <span className="count">{allItems.length}</span>
          </div>
          {CATEGORIES.map((c) => (
            <div
              key={c.id}
              className={`cat-item ${view.type === 'category' && view.id === c.id ? 'active' : ''}`}
              onClick={() => setView({ type: 'category', id: c.id })}
            >
              <span className="cat-dot" style={{ background: c.color }} />
              <span className="name">{c.label}</span>
              <span className="count">{stats?.byCategory?.[c.id] || 0}</span>
            </div>
          ))}
        </div>
        <div className="nav-section">
          <div className="nav-title">单场面试</div>
          {Object.entries(stats?.byCompany || {}).map(([company, n]) => (
            <div
              key={company}
              className={`cat-item ${view.type === 'interview' && view.company === company ? 'active' : ''}`}
              onClick={() => setView({ type: 'interview', company })}
            >
              <span className="cat-dot" style={{ background: '#94a3b8' }} />
              <span className="name">{company} · {allItems.find((i) => i.company === company)?.round || '面试'}</span>
              {stats?.interviews?.[company] && (
                <span
                  className="iv-status"
                  style={{ color: INTERVIEW_STATUS[stats.interviews[company]]?.color }}
                >
                  {INTERVIEW_STATUS[stats.interviews[company]]?.label}
                </span>
              )}
              <span className="count">{n}</span>
              <button
                className="cat-del"
                title={`删除「${company}」整场面试`}
                onClick={(e) => { e.stopPropagation(); setDelCompany(company); }}
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* ===== 主区 ===== */}
      <main className="main">
        <div className="main-inner">
          {view.type === 'home' ? (
            <Dashboard
              stats={stats}
              allItems={allItems}
              onSelectCategory={(id) => setView({ type: 'category', id })}
              onSelectCompany={(company) => setView({ type: 'interview', company })}
              onDeleteCompany={setDelCompany}
              onOpenChat={() => setView({ type: 'chat' })}
              onOpenImport={() => setImportOpen(true)}
              onJumpToItem={gotoItem}
            />
          ) : view.type === 'chat' ? null : (
          <>
          {/* 工具条 */}
          <div className="toolbar">
            <div className="search-box">
              <span style={{ color: '#94a3b8' }}>🔍</span>
              <input
                value={search}
                placeholder="搜索问题、知识点、原文…（如：闭包、SSE、diff）"
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {view.type === 'interview' && (
              <select
                className="cat-select"
                value={catFilter}
                onChange={(e) => setCatFilter(e.target.value)}
                title="按分类筛选本场面试的题目"
              >
                <option value="all">全部分类</option>
                {Object.entries(interview?.byCategory || {})
                  .sort((a, b) => b[1] - a[1])
                  .map(([id, n]) => (
                    <option key={id} value={id}>
                      {CAT_MAP[id]?.label || id}（{n}）
                    </option>
                  ))}
              </select>
            )}
            <button
              className={`btn ${weakOnly ? 'primary' : ''}`}
              onClick={() => { setQualityFilter(null); setWeakOnly(!weakOnly); }}
            >
              只看没答好的
            </button>
            <button
              className={`btn ${flaggedOnly ? 'primary' : ''}`}
              onClick={() => setFlaggedOnly(!flaggedOnly)}
            >
              🚩 只看标记{flaggedOnly ? '' : ` (${viewItems.filter((i) => i.flagged).length})`}
            </button>
            {view.type !== 'interview' && (
              <button
                className={`btn ${selectMode ? 'primary' : ''}`}
                onClick={() => { setSelectMode(!selectMode); setSelection(new Set()); }}
              >
                {selectMode ? '退出批量' : '批量管理'}
              </button>
            )}
            {selectMode && (
              <>
                <span style={{ color: 'var(--muted)', fontSize: 13 }}>
                  已选 {selection.size} 项
                </span>
                <button
                  className="btn danger"
                  disabled={!selection.size || deleting}
                  onClick={doDelete}
                >
                  {deleting ? '删除中…' : `删除选中(${selection.size})`}
                </button>
              </>
            )}
          </div>

          {/* 掌握度统计卡片（搜索框下方；数量固定为当前视图的静态统计，点击仅切换筛选） */}
          <div className="stats-row">
              <div
                className={`stat-card clickable ${!qualityFilter && !weakOnly ? 'active' : ''}`}
                title="点击查看全部题目"
                onClick={() => { setQualityFilter(null); setWeakOnly(false); }}
              >
                <div className="num" style={{ color: '#4f6ef7' }}>{viewItems.length}</div>
                <div className="lbl">总数量</div>
              </div>
              {Object.entries(QMETA).map(([q, m]) => (
                <div
                  className={`stat-card clickable ${qualityFilter === q ? 'active' : ''}`}
                  key={q}
                  title="点击只看该掌握度的题目，再次点击取消"
                  onClick={() => toggleQuality(q)}
                >
                  <div className="num" style={{ color: m.color }}>{qualityCount(q)}</div>
                  <div className="lbl">{m.label}</div>
                </div>
              ))}
          </div>

          {/* 高频考点（仅总览） */}
          {view.type === 'overview' && (
            <>
              <div className="section-head">
                <h2>高频考点</h2>
                <span className="sub">多家公司都问到的题，优先复习</span>
              </div>
              <div className="freq-grid">
                {freqGroups.map((g, i) => {
                  const companies = [...new Set(g.map((x) => x.company))];
                  return (
                    <div
                      className="freq-card" key={i}
                      onClick={() => gotoItem({ id: g[0].id })}
                    >
                      <div className="fq">{g[0].question}</div>
                      <div className="companies">
                        {companies.map((c) => <span className="tag" key={c}>{c}</span>)}
                        <span className="tag hot">被问 {g.length} 次</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* 列表标题 */}
          <div className="section-head">
            <h2>
              {view.type === 'category' ? CATEGORIES.find((c) => c.id === view.id)?.label
                : view.type === 'interview'
                  ? `${view.company} · ${allItems.find((i) => i.company === view.company)?.round || '面试'} · 复盘`
                : '全部题目'}
            </h2>
            <span className="sub">
              共 {filtered.length} 题
            </span>
            {view.type === 'interview' && (
              <select
                className="status-select"
                value={stats?.interviews?.[view.company] || ''}
                onChange={(e) => handleSetStatus(view.company, e.target.value)}
                title="设置这场面试的结果状态"
              >
                <option value="">状态未标记</option>
                {Object.entries(INTERVIEW_STATUS).map(([id, s]) => (
                  <option key={id} value={id}>{s.label}</option>
                ))}
              </select>
            )}
          </div>

          {/* 视图内容 */}
          {view.type === 'interview' ? (
            <InterviewView
              interview={interview ? { ...interview, items: filtered } : null}
              selectMode={selectMode}
              onToggleSelectMode={() => { setSelectMode(!selectMode); setSelection(new Set()); }}
              selection={selection}
              onToggleSelect={toggleSelect}
              onToggleCard={toggleCard}
              openIds={openIds}
              onToggleFlag={handleToggleFlag}
              onToggleResolve={handleToggleResolve}
            />
          ) : (
            <ListView
              items={filtered}
              grouped={view.type === 'category'}
              selectMode={selectMode}
              selection={selection}
              onToggleSelect={toggleSelect}
              onToggleCard={toggleCard}
              openIds={openIds}
              onToggleFlag={handleToggleFlag}
              onToggleResolve={handleToggleResolve}
            />
          )}
          </>
          )}
        </div>
      </main>

      <Chat
        sessionId={chatSessionId}
        sessionLabel={chatSessionLabel}
        variant={view.type === 'chat' ? 'page' : 'panel'}
        open={chatOpen}
        onOpen={() => setChatOpen(true)}
        onClose={() => {
          if (view.type === 'chat') setView({ type: 'home' });
          else setChatOpen(false);
        }}
        onJumpToItem={gotoItem}
      />

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={handleImported}
      />

      <ConfirmDialog
        open={!!delCompany}
        title="删除整场面试"
        message={`确认删除「${delCompany || ''}」的整场面试？\n该场所有题目与原文切片都会被删除，不可恢复。`}
        confirmText={delBusy ? '删除中…' : '删除'}
        danger
        busy={delBusy}
        onConfirm={doDeleteInterview}
        onClose={() => { if (!delBusy) setDelCompany(null); }}
      />
    </div>
  );
}
