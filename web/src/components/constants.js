/** 全局常量（分类/掌握度元信息），若 API 返回了 categories 则会覆盖 CAT_MAP */
export const CATEGORIES = [
  { id: 'agent', label: 'Agent / AI', color: '#7c5cff', desc: '大模型、提示词、Agent 架构、RAG、数字员工' },
  { id: 'frontend_framework', label: '前端 · Vue/React', color: '#00b4d8', desc: '框架原理、diff、响应式、hooks、状态管理' },
  { id: 'frontend_basic', label: '前端 · HTML/CSS/JS', color: '#2ec4b6', desc: '语言基础、闭包、事件循环、防抖节流、浏览器' },
  { id: 'frontend_engineering', label: '前端 · 工程化', color: '#ff9f1c', desc: 'webpack/vite、微前端、构建、性能优化' },
  { id: 'cs_fundamentals', label: '计算机基础', color: '#ef476f', desc: '计算机网络（HTTP/HTTPS、SSE/WebSocket）、操作系统、URL 全流程' },
  { id: 'backend', label: '后端开发', color: '#e63946', desc: 'Node、Java、中间件、数据库、后端模块设计' },
  { id: 'algorithm', label: '算法 / 力扣', color: '#f72585', desc: '链表、LRU、手写题' },
  { id: 'project_scenario', label: '项目 / 场景', color: '#64748b', desc: '项目深挖、需求分析、线上排查、软性场景题' },
];

export const QMETA = {
  good: { label: '答得不错', color: '#16a34a' },
  partial: { label: '答得欠缺', color: '#d97706' },
  poor: { label: '没答上来', color: '#dc2626' },
};

/** 单场面试结果状态 */
export const INTERVIEW_STATUS = {
  pass: { label: '通过', color: '#16a34a' },
  pool: { label: '泡池子', color: '#d97706' },
  fail: { label: '挂', color: '#dc2626' },
};

export let CAT_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
export function setCategories(list) {
  if (Array.isArray(list) && list.length) {
    CAT_MAP = Object.fromEntries(list.map((c) => [c.id, c]));
  }
}

/** 问题相似度聚类，找高频考点 */
export function findFreqGroups(items, minCount = 2, limit = 10) {
  const toks = items.map((it) => tokenize(it.question));
  const used = new Array(items.length).fill(false);
  const groups = [];
  for (let i = 0; i < items.length; i++) {
    if (used[i]) continue;
    const g = [i];
    used[i] = true;
    for (let j = i + 1; j < items.length; j++) {
      if (!used[j] && jaccard(toks[i], toks[j]) > 0.42) { g.push(j); used[j] = true; }
    }
    if (g.length >= minCount) groups.push(g);
  }
  groups.sort((a, b) => b.length - a.length);
  return groups.slice(0, limit).map((g) => g.map((i) => items[i]));
}

function tokenize(s) {
  const clean = (s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ');
  const set = new Set();
  for (const p of clean.split(/\s+/).filter(Boolean)) {
    if (/^[a-z]+$/.test(p) && p.length > 1) set.add(p);
    else for (let i = 0; i < p.length - 1; i++) set.add(p.slice(i, i + 2));
  }
  return set;
}
function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}
