import React, { useRef, useState } from 'react';
import { importInterview } from '../api.js';
import { INTERVIEW_STATUS } from './constants.js';

/**
 * 上传新面经弹窗：
 * 填公司/日期/轮次/结果状态 + 粘贴文本或选择 .txt/.md 文件
 * → POST /api/import（后端 LLM 分块抽取知识点并写入 store）
 * → 成功后回调刷新首页数据
 */
export default function ImportDialog({ open, onClose, onImported }) {
  const [company, setCompany] = useState('');
  const [date, setDate] = useState('');
  const [round, setRound] = useState('一面');
  const [status, setStatus] = useState('');
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);   // { added, parts }
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  if (!open) return null;

  const canSubmit = !busy && company.trim() && text.trim().length >= 50;
  const estParts = Math.max(1, Math.ceil(text.trim().length / 6000));

  const reset = () => {
    setCompany(''); setDate(''); setRound('一面'); setStatus('');
    setText('');
    setFileName(''); setResult(null); setError('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const pickFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setError('');
    try {
      const content = await f.text();
      setText(content);
    } catch {
      setError('文件读取失败，请直接粘贴文本');
    }
  };

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const r = await importInterview({
        company: company.trim(),
        date: date.trim(),
        round: round.trim(),
        status,
        text: text.trim(),
      });
      setResult({ added: r.added, parts: r.parts });
      onImported?.(r);
    } catch (e) {
      setError(e.message || '分析失败，请稍后重试');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={busy ? undefined : onClose}>
      <div className="modal import-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>上传新面经</h3>
          {!busy && <span className="modal-close" onClick={onClose}>✕</span>}
        </div>

        {result ? (
          <div className="import-result">
            <div className="ok-icon">✓</div>
            <p>
              已完成分析并写入知识库：新增 <b>{result.added}</b> 条知识点
              （原文分 {result.parts} 段入库，问答机器人同样可检索）。
            </p>
            <div className="modal-actions">
              <button className="btn primary" onClick={() => { reset(); onClose(); }}>好的</button>
              <button className="btn" onClick={reset}>继续上传</button>
            </div>
          </div>
        ) : (
          <>
            <div className="form-row">
              <label>公司 *</label>
              <input
                value={company} placeholder="如：百度"
                disabled={busy}
                onChange={(e) => setCompany(e.target.value)}
              />
              <label style={{ marginLeft: 12 }}>日期</label>
              <input
                value={date} placeholder="如：9.20"
                disabled={busy} style={{ width: 90 }}
                onChange={(e) => setDate(e.target.value)}
              />
              <label>轮次</label>
              <input
                value={round} placeholder="一面"
                disabled={busy} style={{ width: 90 }}
                onChange={(e) => setRound(e.target.value)}
              />
              <label>状态</label>
              <select
                value={status}
                disabled={busy} style={{ width: 110 }}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">未标记</option>
                {Object.entries(INTERVIEW_STATUS).map(([id, s]) => (
                  <option key={id} value={id}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="import-hint">
              日期会拼进轮次一起展示（如「9.20 一面」）；状态可选 通过 / 泡池子 / 挂，留空则之后在复盘页再标记。
            </div>

            <div className="form-row" style={{ alignItems: 'center' }}>
              <label>文本 *</label>
              <span style={{ flex: 1, fontSize: 12.5, color: 'var(--muted)' }}>
                支持粘贴转写文本，或选择 .txt / .md 文件（docx 请先另存为 txt）
              </span>
              <input
                ref={fileRef} type="file" accept=".txt,.md,text/plain"
                style={{ display: 'none' }} onChange={pickFile}
              />
              <button className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>
                {fileName ? `重新选择 (${fileName})` : '选择文件'}
              </button>
            </div>

            <textarea
              className="import-textarea"
              value={text}
              disabled={busy}
              placeholder="把面试录音转写文本粘贴到这里（至少 50 字）…"
              onChange={(e) => { setText(e.target.value); setFileName(''); }}
            />
            <div className="import-meta">
              {text.trim() ? `${text.trim().length} 字 · 预计分 ${estParts} 段分析` : '等待输入…'}
            </div>

            {error && <div className="import-error">{error}</div>}
            {busy && (
              <div className="import-busy">
                AI 正在阅读并抽取知识点（约 {estParts} 段，预计 1-3 分钟），请勿关闭…
              </div>
            )}

            <div className="modal-actions">
              <button className="btn" disabled={busy} onClick={onClose}>取消</button>
              <button className="btn primary" disabled={!canSubmit} onClick={submit}>
                {busy ? '分析中…' : '开始分析并入库'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
