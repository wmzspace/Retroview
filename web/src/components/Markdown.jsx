import React from 'react';

/**
 * 轻量 Markdown 渲染器（聊天回答用，无第三方依赖）
 * 支持：代码块 ```、标题 #/##/###、无序/有序列表、加粗 **、行内代码 `、引用 >
 */

/** 行内解析：**加粗** 与 `行内代码` */
function Inline({ text }) {
  const parts = [];
  const re = /(\*\*[^*]+\*\*|`[^`\n]+`)/g;
  let last = 0;
  let m;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(<React.Fragment key={k++}>{text.slice(last, m.index)}</React.Fragment>);
    const t = m[0];
    if (t.startsWith('**')) parts.push(<b key={k++}>{t.slice(2, -2)}</b>);
    else parts.push(<code key={k++}>{t.slice(1, -1)}</code>);
    last = m.index + t.length;
  }
  if (last < text.length) parts.push(<React.Fragment key={k++}>{text.slice(last)}</React.Fragment>);
  return parts;
}

export default function Markdown({ text }) {
  const src = text || '';
  // 按代码块切分
  const segments = src.split(/```/);
  const blocks = [];

  segments.forEach((seg, si) => {
    // 奇数段是代码块
    if (si % 2 === 1) {
      // 去掉可能的首行语言标注
      const lines = seg.replace(/^\w*\n/, '');
      blocks.push(
        <pre className="md-code" key={`c${si}`}>
          <code>{lines.replace(/\n$/, '')}</code>
        </pre>,
      );
      return;
    }
    // 普通文本：逐行解析
    const lines = seg.split('\n');
    let list = null;       // { type: 'ul'|'ol', items: [] }
    let para = [];         // 段落行缓冲

    const flushList = () => {
      if (!list) return;
      const Tag = list.type === 'ol' ? 'ol' : 'ul';
      blocks.push(
        <Tag key={`l${si}-${blocks.length}`} className="md-list">
          {list.items.map((it, i) => <li key={i}><Inline text={it} /></li>)}
        </Tag>,
      );
      list = null;
    };
    const flushPara = () => {
      if (!para.length) return;
      blocks.push(<p key={`p${si}-${blocks.length}`} className="md-p"><Inline text={para.join('')} /></p>);
      para = [];
    };

    for (const raw of lines) {
      const line = raw.trimEnd();
      if (!line.trim()) { flushList(); flushPara(); continue; }

      // 标题
      const h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) {
        flushList(); flushPara();
        const level = Math.min(h[1].length + 2, 5); // # -> h3，### -> h5
        const Tag = `h${level}`;
        blocks.push(<Tag key={`h${si}-${blocks.length}`} className="md-h"><Inline text={h[2]} /></Tag>);
        continue;
      }
      // 引用
      if (line.startsWith('> ')) {
        flushList(); flushPara();
        blocks.push(<blockquote key={`q${si}-${blocks.length}`} className="md-quote"><Inline text={line.slice(2)} /></blockquote>);
        continue;
      }
      // 无序列表（- * ·）
      const ul = line.match(/^\s*(?:[-*·])\s+(.*)$/);
      if (ul) {
        flushPara();
        if (!list || list.type !== 'ul') { flushList(); list = { type: 'ul', items: [] }; }
        list.items.push(ul[1]);
        continue;
      }
      // 有序列表（1. 2. ）
      const ol = line.match(/^\s*\d+[.、)]\s+(.*)$/);
      if (ol) {
        flushPara();
        if (!list || list.type !== 'ol') { flushList(); list = { type: 'ol', items: [] }; }
        list.items.push(ol[1]);
        continue;
      }
      // 普通段落行（连续行合并）
      flushList();
      para.push(line);
    }
    flushList();
    flushPara();
  });

  return <div className="md-body">{blocks}</div>;
}
