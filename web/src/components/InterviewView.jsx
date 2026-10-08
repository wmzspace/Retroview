import React from 'react';
import ListView from './ListView.jsx';

/**
 * 单场面试视图：
 * - 顶部标题（公司/轮次/题数）由 App 工具栏统一展示
 * - 掌握度筛选、搜索均由 App 工具栏统一处理（与分类视图一致）
 * - 直接展示平铺题目列表
 */
export default function InterviewView({
  interview,       // { company, round, total, byCategory, byQuality, items(已筛选) } 或 null
  selectMode,
  selection, onToggleSelect, onToggleCard, openIds, onToggleFlag, onToggleResolve,
}) {
  if (!interview) return <div className="empty">没有这场面试的数据</div>;

  const { items } = interview;

  return (
    <ListView
      items={items}
      grouped={false}
      selectMode={selectMode}
      selection={selection}
      onToggleSelect={onToggleSelect}
      onToggleCard={onToggleCard}
      openIds={openIds}
      onToggleFlag={onToggleFlag}
      onToggleResolve={onToggleResolve}
    />
  );
}
