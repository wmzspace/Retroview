export const fetchStats = () => fetch('/api/stats').then((r) => r.json());

export const fetchAllItems = () =>
  fetch('/api/items').then((r) => r.json()).then((d) => d.items);

export const deleteItems = (ids) =>
  fetch('/api/items', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  }).then((r) => r.json());

/** 上传新面经：后端 LLM 分块抽取后入库，返回 { added, parts, stats } */
export const importInterview = ({ company, round, date, status, text }) =>
  fetch('/api/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ company, round, date, status, text }),
  }).then(async (r) => {
    const data = await r.json();
    if (!r.ok) throw new Error(data?.message || `分析失败 (${r.status})`);
    return data;
  });

/** 设置单场面试结果状态（通过/泡池子/挂），空 status 清除标记 */
export const setInterviewStatus = (company, status) =>
  fetch(`/api/interviews/${encodeURIComponent(company)}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  }).then(async (r) => {
    const data = await r.json();
    if (!r.ok || !data?.ok) throw new Error(data?.message || `更新失败 (${r.status})`);
    return data;
  });

/** 红旗标记切换：返回 { ok, flagged } */
export const toggleFlag = (id) =>
  fetch(`/api/items/${encodeURIComponent(id)}/flag`, { method: 'POST' })
    .then((r) => r.json());

/** 已解决标记切换：返回 { ok, resolved } */
export const toggleResolve = (id) =>
  fetch(`/api/items/${encodeURIComponent(id)}/resolve`, { method: 'POST' })
    .then((r) => r.json());

/** 删除整场面试（该公司的题目与原文切片），返回 { removed, stats } */
export const deleteInterview = (company) =>
  fetch(`/api/interviews/${encodeURIComponent(company)}`, { method: 'DELETE' })
    .then((r) => r.json());

/** SSE 流式问答 */
export async function chatStream({ message, history }, handlers) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`请求失败 ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split('\n\n');
    buf = parts.pop();
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith('data:')) continue;
      try {
        const evt = JSON.parse(line.slice(5).trim());
        if (evt.type === 'token') handlers.onToken?.(evt.content);
        else if (evt.type === 'refs') handlers.onRefs?.(evt.refs);
        else if (evt.type === 'error') handlers.onError?.(evt.message);
        else if (evt.type === 'done') handlers.onDone?.();
      } catch {
        // 忽略解析失败的分包
      }
    }
  }
  handlers.onDone?.();
}
