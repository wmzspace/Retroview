# 前端面经知识库

面经分类复盘 + AI 问答系统。6 份面试录音转写实录 → 144 个结构化知识点。

## 技术栈

- **前端**：React 18 + Vite（`app/web`）
- **后端**：NestJS（`app/server`）
- **问答机器人**：LangGraph（retrieve → generate 两节点图）+ DeepSeek API，SSE 流式输出
- **数据**：`app/data/store.json`（由 `app/data/raw/*.json` 构建，支持删除后持久化）

## 目录结构

```
app/
├── data/
│   ├── raw/          # 每场面试的结构化知识点（按公司一个 JSON）
│   └── store.json    # 运行时数据库（知识点 + 原文切片 + 统计）
├── server/           # NestJS 后端
│   ├── src/data/     # 数据模块：统计 / 列表 / 单场面试 / 批量删除
│   ├── src/agent/    # LangGraph Agent：BM25 检索 + DeepSeek 生成
│   ├── scripts/build-data.mjs
│   └── .env          # DeepSeek API Key 配置
└── web/              # React 前端
```

## 启动

```bash
cd app/server
npm install
npm run start:dev        # 后端 http://localhost:3001

cd app/web
npm install
npm run dev              # 前端 http://localhost:5173
```

## 配置 DeepSeek API Key

复制 `app/server/.env.example` 为 `app/server/.env`，填入你的 key：

```
DEEPSEEK_API_KEY=sk-xxxx
DEEPSEEK_MODEL=deepseek-chat
```

重启后端后，聊天机器人即从「本地检索模式」切换为 AI 生成回答。

## 功能

1. **总览**：掌握度统计、高频考点聚类（多家公司重复问到的题）
2. **分类浏览**：Agent/AI、Vue/React、HTML/CSS/JS、工程化、后端/网络、算法、项目/场景
3. **单场面试复盘**：点侧栏某公司进入，看分类分布条 + 掌握度统计，可按「答得不错 / 没答好」筛选，可按分类分组
4. **批量删除**：任意视图点「批量管理」→ 勾选题目 → 删除（写回 store.json）
5. **问答机器人**：右下角 💬，基于 LangGraph 检索增强回答，回答附「参考来源」可一键跳转题目

## API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/stats` | 全局统计 |
| GET | `/api/items?category=&company=&quality=&search=` | 题目列表 |
| GET | `/api/interviews/:company` | 单场面试数据 |
| DELETE | `/api/items` | 批量删除，body: `{"ids": [...]}` |
| POST | `/api/chat` | SSE 流式问答，body: `{"message": "...", "history": [...]}` |

## 新增面经

1. 新 docx 放入 `面经/` 目录
2. 参照 `app/data/raw/` 现有 JSON 的格式，抽取该场面试知识点为新 JSON（字段：category/question/answer_points/quality/quote）
3. 在 `app/server/scripts/build-data.mjs` 的 `COMPANIES` 和 `SRC_MAP` 中登记新公司
4. `node app/server/scripts/build-data.mjs` 重建数据，重启后端
