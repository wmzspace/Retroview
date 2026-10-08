import React, { useEffect, useRef, useState } from 'react';
import { chatStream } from '../api.js';
import { QMETA } from './constants.js';
import Markdown from './Markdown.jsx';

/**
 * 问答机器人：多会话管理版
 * - 会话不与页面入口强绑定：可新建、切换、筛选、重命名、删除
 * - page 形态（首页全页聊天）：左侧固定会话菜单栏
 * - panel 形态（面经页侧滑面板）：模态框选择会话
 * 后端为 NestJS + LangGraph（retrieve -> generate）+ DeepSeek，SSE 流式返回
 */
export default function Chat({
  sessionId = 'default',
  sessionLabel = '',
  open, onOpen, onClose, onJumpToItem,
  variant = 'panel',
}) {
  const [sessions, setSessions] = useState({});  // { [id]: { label, msgs, createdAt, updatedAt } }
  const [activeId, setActiveId] = useState(null);
  const [listOpen, setListOpen] = useState(false);   // panel 形态的会话模态框
  const [sessionSearch, setSessionSearch] = useState('');
  const [input, setInput] = useState('');
  const [busyId, setBusyId] = useState(null);
  const historyRef = useRef({});   // { [id]: [...] } 每会话发给后端的对话历史
  const msgsEndRef = useRef(null);
  const seqRef = useRef(0);

  // 初始化：定位到入口建议的会话（不存在则创建一次）
  useEffect(() => {
    if (activeId) return;
    if (sessions[sessionId]) { setActiveId(sessionId); return; }
    const id = sessionId;
    setSessions((prev) => ({
      ...prev,
      [id]: { label: sessionLabel ? `${sessionLabel}会话` : '默认会话', msgs: [], createdAt: Date.now(), updatedAt: Date.now() },
    }));
    setActiveId(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const session = sessions[activeId] || { msgs: [], label: '' };
  const busy = busyId === activeId;

  useEffect(() => {
    msgsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session.msgs, activeId]);

  const send = async () => {
    const q = input.trim();
    if (!q || busy) return;
    const sid = activeId;
    setBusyId(sid);
    setInput('');
    setSessions((prev) => {
      const cur = prev[sid];
      if (!cur) return prev;
      return { ...prev, [sid]: { ...cur, msgs: [...cur.msgs, { role: 'user', text: q }], updatedAt: Date.now() } };
    });

    const updateBot = (fn) =>
      setSessions((prev) => {
        const cur = prev[sid];
        if (!cur) return prev;
        const msgs = cur.msgs.slice();
        const last = msgs[msgs.length - 1];
        if (last && last.role === 'bot') msgs[msgs.length - 1] = fn(last);
        return { ...prev, [sid]: { ...cur, msgs, updatedAt: Date.now() } };
      });
    setSessions((prev) => {
      const cur = prev[sid];
      if (!cur) return prev;
      return { ...prev, [sid]: { ...cur, msgs: [...cur.msgs, { role: 'bot', text: '', refs: [] }] } };
    });

    try {
      const history = (historyRef.current[sid] || []).slice(-6);
      let answer = '';
      await chatStream(
        { message: q, history },
        {
          onToken: (t) => { answer += t; updateBot((x) => ({ ...x, text: x.text + t })); },
          onRefs: (refs) => updateBot((x) => ({ ...x, refs })),
          onError: (msg) => updateBot((x) => ({ ...x, text: x.text + `\n\n[出错] ${msg}` })),
        },
      );
      historyRef.current[sid] ||= [];
      historyRef.current[sid].push({ role: 'user', content: q });
      historyRef.current[sid].push({ role: 'assistant', content: answer });
    } catch (e) {
      updateBot((x) => ({ ...x, text: `请求失败：${e.message}\n\n请确认后端服务（NestJS, 端口 3001）已启动。` }));
    } finally {
      setBusyId((cur) => (cur === sid ? null : cur));
    }
  };

  /** 新建会话并切换过去 */
  const newSession = () => {
    const id = `s-${Date.now()}-${seqRef.current++}`;
    setSessions((prev) => ({
      ...prev,
      [id]: { label: sessionLabel ? `${sessionLabel}会话` : `会话 ${Object.keys(prev).length + 1}`, msgs: [], createdAt: Date.now(), updatedAt: Date.now() },
    }));
    setActiveId(id);
    setListOpen(false);
    setInput('');
  };

  /** 删除会话（删的是当前会话则切到最近的其他会话；全删则重开默认会话） */
  const removeSession = (id, e) => {
    e.stopPropagation();
    setSessions((prev) => {
      const next = { ...prev };
      delete next[id];
      delete historyRef.current[id];
      const ids = Object.keys(next);
      if (!ids.length) {
        const nid = `s-${Date.now()}-r`;
        setActiveId(nid);
        return { [nid]: { label: '默认会话', msgs: [], createdAt: Date.now(), updatedAt: Date.now() } };
      }
      if (id === activeId) {
        const latest = ids.sort((a, b) => (next[b].updatedAt || 0) - (next[a].updatedAt || 0))[0];
        setActiveId(latest);
      }
      return next;
    });
  };

  /** 重命名会话 */
  const renameSession = (id, e) => {
    e.stopPropagation();
    const cur = sessions[id];
    const name = window.prompt('重命名会话', cur?.label || '');
    if (name === null) return;
    setSessions((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], label: name.trim() || prev[id].label } } : prev));
  };

  // 会话列表（按更新时间倒序 + 搜索筛选：名称或首条用户消息）
  const sessionList = Object.entries(sessions)
    .map(([id, s]) => ({
      id, ...s,
      preview: (s.msgs.find((m) => m.role === 'user')?.text || s.msgs[0]?.text || '新会话').slice(0, 40),
    }))
    .filter((s) => {
      if (!sessionSearch.trim()) return true;
      const kw = sessionSearch.trim().toLowerCase();
      return s.label.toLowerCase().includes(kw) || s.preview.toLowerCase().includes(kw);
    })
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  const renderWelcome = () => (
    <div className="chat-welcome">
      <div className="cw-emoji">🤖</div>
      <div className="cw-body">
        <div className="cw-title">面经问答机器人</div>
        <div className="cw-desc">你好！我是基于你面经构建的问答机器人（LangGraph + DeepSeek），可以问我：</div>
        <div className="cw-suggestions">
          <button onClick={() => { setInput('我在哪些面试被问到过 SSE？怎么答比较好？'); }}>
            我在哪些面试被问到过 SSE？
          </button>
          <button onClick={() => { setInput('React diff 我答得怎么样，怎么补强？'); }}>
            React diff 我答得怎么样，怎么补强？
          </button>
          <button onClick={() => { setInput('帮我总结 Agent 相关的高频问题'); }}>
            帮我总结 Agent 相关的高频问题
          </button>
        </div>
        <div className="cw-tip">回答上方附有参考来源，点击可直接跳转到对应题目</div>
      </div>
    </div>
  );

  /** 会话列表条目（侧栏与模态框共用） */
  const renderSessionItems = () => (
    <>
      {sessionList.length === 0 && <div className="sl-empty">没有匹配的会话</div>}
      {sessionList.map((s) => (
        <div
          key={s.id}
          className={`sl-item ${s.id === activeId ? 'on' : ''}`}
          onClick={() => { setActiveId(s.id); setListOpen(false); }}
        >
          <div className="sl-main">
            <div className="sl-label">{s.label}</div>
            <div className="sl-preview">{s.preview}</div>
          </div>
          <div className="sl-meta">
            <span className="sl-count">{s.msgs.length} 条</span>
            <button className="sl-btn" title="重命名" onClick={(e) => renameSession(s.id, e)}>✎</button>
            <button className="sl-btn del" title="删除" onClick={(e) => removeSession(s.id, e)}>🗑</button>
          </div>
        </div>
      ))}
    </>
  );

  const chatMain = (
    <>
      <div className="chat-head">
        <span className="t">💬 {session.label || '面经问答机器人'}</span>
        {variant === 'panel' && (
          <button className="s-op" title="选择会话" onClick={() => setListOpen(true)}>☰ 会话</button>
        )}
        <button className="icon-btn" onClick={onClose} title={variant === 'page' ? '返回首页' : '关闭'}>
          {variant === 'page' ? '← 返回' : '✕'}
        </button>
      </div>
      <div className="chat-msgs">
        {session.msgs.length === 0 && renderWelcome()}
        {session.msgs.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.refs?.length > 0 && (
              <div className="refs">
                <div className="r-title">📎 参考来源（点击跳转题目）</div>
                {m.refs.map((r) => (
                  <button key={r.id} className="r-item"
                    onClick={() => onJumpToItem?.(r)}>
                    · [{r.company}·{QMETA[r.quality]?.label}] {r.question.slice(0, 36)}
                    {r.question.length > 36 ? '…' : ''}
                  </button>
                ))}
              </div>
            )}
            {m.role === 'bot' ? <Markdown text={m.text} /> : m.text}
          </div>
        ))}
        {busy && <div className="typing">思考中…</div>}
        <div ref={msgsEndRef} />
      </div>
      <div className="chat-input">
        <textarea
          value={input}
          placeholder="例如：我在哪几场面试被问到 SSE？怎么答比较好？"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
          }}
        />
        <button disabled={busy || !input.trim()} onClick={send}>发送</button>
      </div>
    </>
  );

  // ===== 全页聊天：左侧会话菜单栏 + 主聊天区 =====
  if (variant === 'page') {
    return (
      <div className="chat-page">
        <aside className="chat-sessions">
          <div className="cs-head">
            <span className="cs-title">会话</span>
            <button className="s-op primary" onClick={newSession}>＋ 新建</button>
          </div>
          <div className="cs-search">
            <input
              value={sessionSearch}
              placeholder="筛选会话（名称或内容）…"
              onChange={(e) => setSessionSearch(e.target.value)}
            />
          </div>
          <div className="cs-items">{renderSessionItems()}</div>
        </aside>
        <div className="chat-main">{chatMain}</div>
      </div>
    );
  }

  /** 会话选择模态框（限定在聊天面板区域内弹出） */
  const renderSessionModal = () => (
    <div className="session-overlay" onClick={() => setListOpen(false)}>
      <div className="session-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>选择会话</h3>
          <span className="modal-close" onClick={() => setListOpen(false)}>✕</span>
        </div>
        <div className="sl-search">
          <input
            value={sessionSearch}
            placeholder="筛选会话（名称或内容）…"
            onChange={(e) => setSessionSearch(e.target.value)}
          />
          <button className="s-op primary" onClick={newSession}>＋ 新建</button>
        </div>
        <div className="sl-items modal-sl-items">{renderSessionItems()}</div>
      </div>
    </div>
  );

  // ===== 侧滑面板：模态框只覆盖面板区域 =====
  return (
    <>
      <button className="chat-fab" title="问答机器人" onClick={onOpen}>💬</button>
      <div className={`chat-panel ${open ? 'show' : ''}`}>
        {chatMain}
        {listOpen && renderSessionModal()}
      </div>
    </>
  );
}
