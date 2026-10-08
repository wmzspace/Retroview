// 构建 data/store.json：合并结构化知识点 + 原文切片（供问答 Agent 检索）
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(__dirname, "..", "..");
const RAW_DIR = path.join(APP_ROOT, "data", "raw");
const SRC_DIR = path.join(APP_ROOT, "..", "src");
const OUT = path.join(APP_ROOT, "data", "store.json");

const COMPANIES = {
  "字节": { company: "字节跳动", round: "一面" },
  "美团": { company: "美团", round: "一面" },
  "阿里虎鲸文娱": { company: "阿里虎鲸文娱", round: "一面" },
  "携程": { company: "携程", round: "一面" },
  "懂车帝": { company: "懂车帝", round: "一面" },
  "招银网络科技": { company: "招银网络科技", round: "技术面" },
};

const CATEGORIES = [
  { id: "agent", label: "Agent / AI", color: "#7c5cff", desc: "大模型、提示词、Agent 架构、RAG、数字员工" },
  { id: "frontend_framework", label: "前端 · Vue/React", color: "#00b4d8", desc: "框架原理、diff、响应式、hooks、状态管理" },
  { id: "frontend_basic", label: "前端 · HTML/CSS/JS", color: "#2ec4b6", desc: "语言基础、闭包、事件循环、防抖节流、浏览器" },
  { id: "frontend_engineering", label: "前端 · 工程化", color: "#ff9f1c", desc: "webpack/vite、微前端、构建、性能优化" },
  { id: "cs_fundamentals", label: "计算机基础", color: "#ef476f", desc: "计算机网络（HTTP/HTTPS、SSE/WebSocket）、操作系统、URL 全流程" },
  { id: "backend", label: "后端开发", color: "#e63946", desc: "Node、Java、中间件、数据库、后端模块设计" },
  { id: "algorithm", label: "算法 / 力扣", color: "#f72585", desc: "链表、LRU、手写题" },
  { id: "project_scenario", label: "项目 / 场景", color: "#64748b", desc: "项目深挖、需求分析、线上排查、软性场景题" },
];

// 1) 合并知识点
const items = [];
// 网络/OS 等计算机基础关键词：backend 中命中的迁移到 cs_fundamentals
const CS_KEYWORDS = ["HTTPS", "HTTP", "URL", "TLS", "SSE", "WebSocket", "NFS", "网关", "证书"];
for (const file of fs.readdirSync(RAW_DIR)) {
  if (!file.endsWith(".json")) continue;
  const key = file.replace(/\.json$/, "");
  const meta = COMPANIES[key];
  if (!meta) { console.warn("未知公司文件:", file); continue; }
  const arr = JSON.parse(fs.readFileSync(path.join(RAW_DIR, file), "utf-8"));
  arr.forEach((it, i) => {
    const category =
      it.category === "backend" && CS_KEYWORDS.some((k) => String(it.question || "").includes(k))
        ? "cs_fundamentals"
        : it.category;
    items.push({
      id: `${key}-${i + 1}`,
      company: meta.company,
      round: meta.round,
      category,
      question: it.question,
      answer_points: it.answer_points,
      quality: it.quality,
      quote: it.quote,
    });
  });
}

// 2) 原文切片
const SRC_MAP = {
  "字节一面_分享原文": "字节跳动",
  "美团一面_分享原文": "美团",
  "阿里虎鲸文娱一面_分享原文": "阿里虎鲸文娱",
  "携程一面_分享原文": "携程",
  "懂车帝一面_分享原文": "懂车帝",
  "招银网络科技面试自我介绍_分享原文": "招银网络科技",
};

function chunkText(text, size = 420) {
  const sentences = text.split(/(?<=[。？！!?])/);
  const chunks = [];
  let buf = "";
  for (const s of sentences) {
    if ((buf + s).length > size && buf) { chunks.push(buf.trim()); buf = s; }
    else buf += s;
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks;
}

const chunks = [];
for (const [stem, company] of Object.entries(SRC_MAP)) {
  const p = path.join(SRC_DIR, stem + ".txt");
  if (!fs.existsSync(p)) { console.warn("缺原文:", p); continue; }
  const text = fs.readFileSync(p, "utf-8");
  chunkText(text).forEach((t, i) => chunks.push({ id: `${company}-${i}`, company, text: t }));
}

// 3) 统计
const byCategory = {};
for (const c of CATEGORIES) byCategory[c.id] = items.filter((it) => it.category === c.id).length;
const byQuality = {};
for (const it of items) byQuality[it.quality] = (byQuality[it.quality] || 0) + 1;
const byCompany = {};
for (const it of items) byCompany[it.company] = (byCompany[it.company] || 0) + 1;

const store = {
  meta: {
    generated: new Date().toISOString(),
    total: items.length,
    companies: Object.keys(byCompany),
    byCategory, byQuality, byCompany,
    chunkCount: chunks.length,
  },
  categories: CATEGORIES,
  items,
  chunks,
};

fs.writeFileSync(OUT, JSON.stringify(store, null, 1), "utf-8");
console.log(`完成: ${items.length} 个知识点, ${chunks.length} 个原文切片 -> ${OUT}`);
