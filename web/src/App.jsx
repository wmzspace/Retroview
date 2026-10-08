import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchStats, fetchAllItems, deleteItems, deleteInterview, toggleFlag, toggleResolve, setInterviewStatus,
} from './api.js';
import Sidebar from './components/Sidebar.jsx';
import ItemsView from './components/ItemsView.jsx';
import Chat from './components/Chat.jsx';
import ImportDialog from './components/ImportDialog.jsx';
import Dashboard from './components/Dashboard.jsx';
import ConfirmDialog from './components/ConfirmDialog.jsx';
import Icon from './components/Icon.jsx';
import { useToast } from './components/Toast.jsx';
import { catOf, setCategories, findFreqGroups, viewFromHash, hashFromView } from './components/constants.js';

const titleOfView = (v) =>
  v.type === 'chat' ? '问答助手'
  : v.type === 'overview' ? '全部题目'
  : v.type === 'category' ? catOf(v.id).label
  : v.type === 'interview' ? `${v.company} 复盘`
  : '复习首页';

export default function App() {
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [allItems, setAllItems] = useState([]);
  const itemsRef = useRef(allItems);
  itemsRef.current = allItems;
  const [loadState, setLoadState] = useState('loading'); // loading | ready | error
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState(viewFromHash);
  const viewRef = useRef(view);
  const [navOpen, setNavOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [delCompany, setDelCompany] = useState(null);
  const [delBusy, setDelBusy] = useState(false);
  const mainRef = useRef(null);
  const nonce = useRef(0);

  const applyStats = (s) => { setCategories(s.categories); setStats(s); };

  const load = useCallback(async () => {
    setLoadState('loading');
    try {
      const [s, items] = await Promise.all([fetchStats(), fetchAllItems()]);
      applyStats(s);
      setAllItems(items);
      setLoadState('ready');
    } catch (e) {
      setLoadError(e.message);
      setLoadState('error');
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  // ===== 路由：视图 <-> location.hash =====
  const navigate = useCallback((v) => {
    viewRef.current = v;
    setView(v);
    const h = hashFromView(v);
    if (window.location.hash !== h) window.location.hash = h;
  }, []);
  useEffect(() => {
    const onHash = () => {
      const v = viewFromHash();
      if (hashFromView(v) !== hashFromView(viewRef.current)) { viewRef.current = v; setView(v); }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // 切换视图：回到顶部（定位到某题时由列表自己滚动），更新标签页标题
  useEffect(() => {
    if (!view.focus) mainRef.current?.scrollTo(0, 0);
    document.title = `${titleOfView(view)} · 面经错题本`;
  }, [view]);

  // ===== 数据操作（先改界面，失败再回滚） =====
  const toggleField = (field, api, label) => async function run(id) {
    const cur = itemsRef.current.find((i) => i.id === id);
    if (!cur) return;
    const next = !cur[field];
    const setTo = (val) => setAllItems((items) => items.map((i) => (i.id === id ? { ...i, [field]: val } : i)));
    setTo(next);
    try {
      const r = await api(id);
      setTo(r[field]);
      if (field === 'resolved' && r[field]) {
        toast('已标记为已解决', { tone: 'good', action: { label: '撤销', onClick: () => run(id) } });
      }
    } catch (e) {
      setTo(!next);
      toast(`${label}失败：${e.message}`, { tone: 'error' });
    }
  };
  const handleToggleResolve = toggleField('resolved', toggleResolve, '标记');
  const handleToggleFlag = toggleField('flagged', toggleFlag, '标记');

  const handleDeleteItems = async (ids) => {
    try {
      const r = await deleteItems(ids);
      setAllItems((items) => items.filter((i) => !ids.includes(i.id)));
      if (r?.stats) applyStats(r.stats);
      toast(`已删除 ${r?.removed ?? ids.length} 道题`);
      return true;
    } catch (e) {
      toast(`删除失败：${e.message}`, { tone: 'error' });
      return false;
    }
  };

  const doDeleteInterview = async () => {
    if (!delCompany || delBusy) return;
    setDelBusy(true);
    const company = delCompany;
    try {
      const r = await deleteInterview(company);
      setAllItems((items) => items.filter((i) => i.company !== company));
      if (r?.stats) applyStats(r.stats);
      if (viewRef.current.type === 'interview' && viewRef.current.company === company) navigate({ type: 'home' });
      setDelCompany(null);
      toast(`已删除「${company}」整场面试`);
    } catch (e) {
      toast(`删除失败：${e.message}`, { tone: 'error' });
    } finally {
      setDelBusy(false);
    }
  };

  const handleSetStatus = async (company, status) => {
    try {
      const r = await setInterviewStatus(company, status);
      if (r.stats) applyStats(r.stats);
    } catch (e) {
      toast(`更新结果失败：${e.message}`, { tone: 'error' });
    }
  };

  /** 从首页 / 问答跳到具体题目：进入该题所在的面试复盘并展开定位 */
  const gotoItem = (ref) => {
    const item = allItems.find((i) => i.id === ref.id);
    if (!item) { toast('这道题已被删除', { tone: 'error' }); return; }
    setChatOpen(false);
    navigate({ type: 'interview', company: item.company, focus: item.id, n: ++nonce.current });
  };

  const handleImported = async (r) => {
    if (r?.stats) applyStats(r.stats);
    try { setAllItems(await fetchAllItems()); } catch { /* 下次刷新再取 */ }
  };

  const freqGroups = useMemo(() => findFreqGroups(allItems), [allItems]);

  const isChatPage = view.type === 'chat';
  const itemsKey = `${hashFromView(view)}|${view.q || ''}|${view.focus || ''}|${view.n || ''}`;

  let content;
  if (loadState === 'loading' && !stats) {
    content = (
      <div className="skeleton" aria-busy="true" aria-label="正在加载">
        <div className="sk sk-title" /><div className="sk sk-line" />
        {Array.from({ length: 6 }, (_, i) => <div className="sk sk-row" key={i} />)}
      </div>
    );
  } else if (loadState === 'error') {
    content = (
      <div className="empty big" role="alert">
        <p><b>没能读取面经数据。</b></p>
        <p className="muted">{loadError}</p>
        <button className="btn primary" onClick={load}>重试</button>
      </div>
    );
  } else if (view.type === 'home') {
    content = (
      <Dashboard
        stats={stats} allItems={allItems} freqGroups={freqGroups}
        onNavigate={navigate}
        onOpenImport={() => setImportOpen(true)}
        onJumpToItem={gotoItem}
      />
    );
  } else if (!isChatPage) {
    content = (
      <ItemsView
        key={itemsKey}
        view={view} allItems={allItems} stats={stats} freqGroups={freqGroups}
        focusId={view.focus}
        onToggleFlag={handleToggleFlag}
        onToggleResolve={handleToggleResolve}
        onDeleteItems={handleDeleteItems}
        onSetStatus={handleSetStatus}
        onJumpToItem={gotoItem}
      />
    );
  }

  return (
    <div className="app">
      <a className="skip-link" href="#main">跳到正文</a>
      <Sidebar
        stats={stats} allItems={allItems} view={view}
        open={navOpen}
        onNavigate={navigate}
        onDeleteCompany={setDelCompany}
        onClose={() => setNavOpen(false)}
      />

      <main className="main" id="main" ref={mainRef}>
        <div className="topbar only-mobile">
          <button className="icon-btn" onClick={() => setNavOpen(true)} aria-label="打开导航"><Icon name="menu" /></button>
          <span className="topbar-title">面经错题本</span>
        </div>
        <div className="main-inner">{content}</div>
      </main>

      <Chat
        variant={isChatPage ? 'page' : 'panel'}
        open={chatOpen}
        onOpen={() => setChatOpen(true)}
        onClose={() => (isChatPage ? navigate({ type: 'home' }) : setChatOpen(false))}
        onJumpToItem={gotoItem}
      />

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={handleImported}
        onView={(company) => navigate({ type: 'interview', company })}
      />

      <ConfirmDialog
        open={!!delCompany}
        title="删除整场面试"
        message={`删除「${delCompany || ''}」整场面试？这场的所有题目和面试原文都会删除，无法恢复。`}
        confirmText="删除整场"
        danger
        busy={delBusy}
        onConfirm={doDeleteInterview}
        onClose={() => setDelCompany(null)}
      />
    </div>
  );
}
