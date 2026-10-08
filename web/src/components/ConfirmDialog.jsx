import React from 'react';

/**
 * 通用确认弹窗：
 * open 控制显隐，danger=true 时确认按钮为红色警示样式
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  busy = false,
  danger = false,
  onConfirm,
  onClose,
}) {
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={busy ? undefined : onClose}>
      <div className="modal confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          {!busy && <span className="modal-close" onClick={onClose}>✕</span>}
        </div>
        <div className="confirm-msg">{message}</div>
        <div className="modal-actions">
          <button className="btn" disabled={busy} onClick={onClose}>{cancelText}</button>
          <button className={`btn ${danger ? 'danger' : 'primary'}`} disabled={busy} onClick={onConfirm}>
            {busy ? '处理中…' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
