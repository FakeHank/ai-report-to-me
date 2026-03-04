<p align="center">
  <h1 align="center">AI Report to Me</h1>
  <p align="center">
    <strong>让你的 coding agent 给你写日报。</strong>
  </p>
  <p align="center">
    <a href="https://www.npmjs.com/package/ai-report-to-me"><img src="https://img.shields.io/npm/v/ai-report-to-me" alt="npm version"></a>
    <a href="./LICENSE"><img src="https://img.shields.io/github/license/FakeHank/ai-report-to-me" alt="license"></a>
    <a href="./package.json"><img src="https://img.shields.io/node/v/ai-report-to-me" alt="node version"></a>
    <br>
    <a href="./README.md">English</a> | 中文
  </p>
</p>

`aireport` 读取本地的 coding agent session 日志，分析编码模式，生成**每日报告**和 **90 天 Wrapped 总结** —— 包含摩擦点分析、习惯画像，以及"Vibe Coder"人格类型。

支持 **Claude Code**、**Gemini CLI**、**OpenCode** 和 **Codex**。所有数据都留在本地，绝不上传。

## 功能特性

- **每日报告** — 结构化总结今天做了什么、遇到了什么问题、学到了什么。包含"经验切片"：提炼出的问题解决故事，附带可迁移的认知。
- **90 天 Wrapped** — 类 Spotify Wrapped 的阶段性回顾，含 session 统计、小时级活跃热力图、Top 项目排行、"Vibe Coder"人格分类（如 *深夜幽灵型*、*闪现游击型*、*重构上瘾型*）。
- **摩擦检测** — 自动识别 session 中的重试循环、错误连锁和方向反复横跳。
- **启动提醒** — Claude Code 的 SessionStart hook 自动提示生成昨日报告。OpenCode 通过自定义 `ai_report_check` tool 在聊天中手动查看。
- **Webhook 推送** — 报告推送到 Slack、Discord、飞书、钉钉、企业微信、Microsoft Teams。
- **多语言** — 报告语言支持英文、中文、日文、韩文、俄文。

## 快速开始

**推荐方式：把下面这行粘贴到你的 coding agent**（Claude Code、Gemini CLI、OpenCode 或 Codex），让它自动完成全部安装：

```
curl -s https://raw.githubusercontent.com/FakeHank/ai-report-to-me/main/docs/agent-install.md
```

Agent 会读取安装指南，询问你的偏好（语言、Webhook），然后自动安装并配置。

**或手动安装：**

```bash
curl -fsSL https://raw.githubusercontent.com/FakeHank/ai-report-to-me/main/scripts/install.sh | bash
```

安装完成后，在 coding agent session 中使用 slash command：

```
/dayreport                # 生成日报
/qtreport                 # 生成 90 天 Wrapped
```

## 工作原理

```
┌─────────────┐     ┌───────────────┐     ┌────────────┐     ┌───────────┐
│   适配器      │────▶│    聚合器      │────▶│   分析器     │────▶│   渲染器    │
│              │     │               │     │            │     │           │
│ Claude Code  │     │ 按日分组       │     │ 摩擦检测    │     │ Markdown  │
│ Gemini CLI   │     │ 项目统计       │     │ 习惯分析    │     │ Vibe Card │
│ OpenCode     │     │ Token 用量     │     │ 人格分类    │     │ Webhooks  │
│ Codex        │     │ 工具调用       │     │ 改进建议    │     │           │
└─────────────┘     └───────────────┘     └────────────┘     └───────────┘
```

1. **适配器** 从各 CLI 工具解析 session 日志，标准化为统一格式
2. **聚合器** 按日期分组，计算各项目的详细统计
3. **分析器** 检测摩擦模式、分类编码习惯、提取人格信号
4. **渲染器** 生成 Markdown 报告（含 LLM 生成的叙事内容）和 PNG vibe card

报告保存在 `~/.ai-report/reports/`，内嵌元数据用于增量重建 —— 只有新 session 才会触发重新生成。

## 支持的 CLI 工具

| CLI 工具 | 数据来源 | Hook 支持 | 说明 |
|---|---|---|---|
| [Claude Code](https://claude.ai/code) | `~/.claude/projects/` | 完整 | SessionStart hook（启动检查） |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | `~/.gemini/tmp/` | 无 | 直接读取 session 数据 |
| [OpenCode](https://github.com/opencode-ai/opencode) | `~/.local/share/opencode/opencode.db` | 部分 | Plugin 自定义 `ai_report_check` tool |
| [Codex](https://github.com/openai/codex) | `~/.codex/sessions/` | 无 | 直接读取 session 数据 |

## CLI 命令参考

```
aireport install           # 交互式安装（选择数据源、语言、Webhook）
aireport daily             # 生成日报
aireport daily --date 2026-02-28   # 指定日期生成
aireport wrapped           # 生成 90 天 Wrapped
aireport wrapped --days 30         # 自定义周期
aireport status            # 查看安装状态和 session 统计
aireport config            # 管理配置
aireport uninstall         # 移除 hooks 并清理
```

## 配置

配置文件位于 `~/.ai-report/config.json`，在 `aireport install` 时自动创建：

```jsonc
{
  "output_lang": "zh",           // en | zh | ja | ko | ru
  "sources": ["claude-code"],    // 读取哪些 CLI 的数据
  "daily_reminder": true,        // 在 Claude Code 启动时显示提醒
  "backfill_limit": 7,           // 往前追溯几天的待生成报告
  "privacy_mode": false,         // 在报告数据中隐去文件路径和内容
  "wrapped_days": 90,            // Wrapped 默认周期
  "webhooks": {
    "slack_url": "",             // Slack Incoming Webhook URL
    "discord_url": "",           // Discord Webhook URL
    "feishu_url": "",            // 飞书机器人 Webhook URL
    "dingtalk_url": "",          // 钉钉机器人 Webhook URL
    "wecom_url": "",             // 企业微信机器人 URL
    "teams_url": ""              // Microsoft Teams Webhook URL
  }
}
```

## Webhook 推送

配置 Webhook URL 后，报告生成完毕会自动推送。每个平台使用其原生格式：

| 平台 | 消息格式 |
|---|---|
| Slack | Block Kit |
| Discord | Embeds |
| 飞书 / Lark | 交互式卡片 |
| 钉钉 | ActionCard |
| 企业微信 | Markdown |
| Microsoft Teams | Adaptive Card |

## 数据与隐私

所有 session 数据从本地文件系统读取，绝不离开你的机器。报告存储在本地 `~/.ai-report/`。可选的 `privacy_mode` 设置会在数据到达 LLM 之前隐去文件路径和代码内容。

Webhook 发送的是*生成后的报告文本*（而非原始 session 数据）。

## 参与贡献

```bash
git clone https://github.com/FakeHank/ai-report-to-me.git
cd ai-report-to-me
pnpm install
pnpm dev -- status         # 以开发模式运行任意 CLI 命令
pnpm test                  # 运行测试
pnpm typecheck             # 类型检查
```

纯 ESM TypeScript 项目（Node 20+，strict mode），测试使用 Vitest。

## 开源协议

[MIT](./LICENSE)
