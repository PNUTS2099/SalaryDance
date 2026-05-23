# 微信小程序迁移 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有单页 HTML 工资钱包原型迁移为可导入微信开发者工具的小程序工程。

**Architecture:** 保留原 HTML 原型作为参考，新建 `miniprogram/` 目录作为小程序根目录。工资、个税、工时、历史记录、摸鱼记录等纯逻辑放入 `miniprogram/utils/core.js` 并通过 Node 测试验证，页面层只负责微信存储、事件和渲染。

**Tech Stack:** 微信小程序原生 WXML/WXSS/JS、CommonJS 模块、Node built-in test runner。

---

### Task 1: Core Calculation Module

**Files:**
- Create: `miniprogram/utils/core.js`
- Create: `tests/core.test.js`

- [x] Write tests for money sanitization, tax calculation, work snapshot, validation, slack summaries, and formatters.
- [x] Run `node --test tests\core.test.js` and verify the module is missing.
- [x] Implement reusable calculation functions in `miniprogram/utils/core.js`.
- [x] Run `node --test tests\core.test.js` and verify all tests pass.

### Task 2: Mini Program Shell

**Files:**
- Create: `miniprogram/app.js`
- Create: `miniprogram/app.json`
- Create: `miniprogram/app.wxss`
- Create: `miniprogram/sitemap.json`
- Create: `project.config.json`

- [ ] Add project files required by WeChat Developer Tools.
- [ ] Configure one page at `pages/index/index`.
- [ ] Use placeholder AppID so the user can replace it with their real AppID.

### Task 3: Index Page

**Files:**
- Create: `miniprogram/pages/index/index.js`
- Create: `miniprogram/pages/index/index.wxml`
- Create: `miniprogram/pages/index/index.wxss`
- Modify: `miniprogram/utils/core.js`

- [ ] Implement first-run setup/edit mode.
- [ ] Implement real-time earned salary display and salary metrics.
- [ ] Implement local storage for config, work history, and slack records.
- [ ] Implement early end, resume today, and slack timers.
- [ ] Implement lightweight wallet/money animation with WXML data nodes.

### Task 4: Release Notes

**Files:**
- Create: `docs/wechat-miniprogram-release.md`
- Modify: `README.md`

- [ ] Document what has been migrated.
- [ ] Document how to import the project in WeChat Developer Tools.
- [ ] Document the user-only publishing steps: AppID, login, upload, submit review, release.

### Task 5: Verification

**Files:**
- All changed files.

- [ ] Run `node --test tests\core.test.js`.
- [ ] Parse all JSON project files with Node.
- [ ] Check git status and summarize created files.
