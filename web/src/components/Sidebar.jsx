import React from 'react';
import Icon from './Icon.jsx';
import { CATEGORIES, INTERVIEW_STATUS, splitRound } from './constants.js';

function NavItem({ active, onClick, children }) {
  return (
    <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick} aria-current={active ? 'page' : undefined}>
      {children}
    </button>
  );
}

/** 侧栏导航；移动端作为抽屉使用（open 控制） */
export default function Sidebar({ stats, allItems, view, open, onNavigate, onDeleteCompany, onClose }) {
  const go = (v) => { onNavigate(v); onClose?.(); };
  const is = (type, key) =>
    view.type === type && (key === undefined || view.id === key || view.company === key);

  const companies = Object.entries(stats?.byCompany || {});
  const roundOf = (c) => splitRound(allItems.find((i) => i.company === c)?.round).round;
  const resolvedOf = (pred) => allItems.filter((i) => pred(i) && i.resolved).length;

  return (
    <>
      <div className={`scrim ${open ? 'show' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="导航">
        <div className="brand">
          <span className="seal" aria-hidden="true">面</span>
          <div>
            <h1>面经错题本</h1>
            <p>{stats ? `${stats.total} 道题，来自 ${stats.companies?.length || 0} 场面试` : '正在读取…'}</p>
          </div>
          <button className="icon-btn only-mobile" onClick={onClose} aria-label="收起导航">
            <Icon name="close" />
          </button>
        </div>

        <nav className="nav-section">
          <NavItem active={is('home')} onClick={() => go({ type: 'home' })}>
            <Icon name="home" /><span className="name">复习首页</span>
          </NavItem>
          <NavItem active={is('chat')} onClick={() => go({ type: 'chat' })}>
            <Icon name="chat" /><span className="name">问答助手</span>
          </NavItem>
          <NavItem active={is('overview')} onClick={() => go({ type: 'overview' })}>
            <Icon name="list" /><span className="name">全部题目</span>
            <span className="count">{allItems.length}</span>
          </NavItem>
        </nav>

        <nav className="nav-section">
          <div className="nav-title">按知识分类</div>
          {CATEGORIES.map((c) => {
            const n = stats?.byCategory?.[c.id] || 0;
            if (!n) return null;
            return (
              <NavItem key={c.id} active={is('category', c.id)} onClick={() => go({ type: 'category', id: c.id })}>
                <span className="cat-dot" style={{ background: c.color }} />
                <span className="name" title={c.desc}>{c.label}</span>
                <span className="count">{n}</span>
              </NavItem>
            );
          })}
        </nav>

        <nav className="nav-section">
          <div className="nav-title">按面试场次</div>
          {companies.map(([company, n]) => {
            const st = INTERVIEW_STATUS[stats?.interviews?.[company]];
            const done = resolvedOf((i) => i.company === company);
            return (
              <div key={company} className="nav-row">
                <NavItem active={is('interview', company)} onClick={() => go({ type: 'interview', company })}>
                  <span className="name">
                    {company}<span className="round">{roundOf(company)}</span>
                  </span>
                  {st && <span className={`status-pill ${st.tone}`}>{st.label}</span>}
                  <span className="count" title={`已解决 ${done} / 共 ${n} 题`}>{n}</span>
                </NavItem>
                <button
                  className="nav-del icon-btn"
                  title={`删除「${company}」整场面试`}
                  aria-label={`删除「${company}」整场面试`}
                  onClick={() => onDeleteCompany(company)}
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
