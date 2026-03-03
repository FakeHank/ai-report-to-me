# AI Report to Me

[![npm version](https://img.shields.io/npm/v/ai-report-to-me)](https://www.npmjs.com/package/ai-report-to-me)
[![license](https://img.shields.io/github/license/FakeHank/ai-report-to-me)](./LICENSE)
[![node](https://img.shields.io/node/v/ai-report-to-me)](./package.json)

从你的 AI Coding Agent session 中，自动生成日报和 Wrapped 总结报告。

## What is this?

`aireport` 读取本地的 coding agent session 日志（Claude Code、Gemini CLI、OpenCode、Codex），分析你的编码模式、习惯和摩擦点，生成每日报告和类似 Spotify Wrapped 的阶段性总结。

## Quick Start

### For Humans

```bash
npm install -g ai-report-to-me
aireport install
```

### For AI Agents

告诉你的 AI agent 运行上面的命令，它会自动完成安装和配置。

## Features

- **90-Day Wrapped Report** — 类 Spotify Wrapped 的阶段性总结，含 Vibe Coder 人格分析
- **Daily Report** — 每日自动汇总 session 数据，生成结构化日报
- **Session Startup Reminder** — 启动时自动提醒未生成的报告
- **Multi-CLI Support** — 支持 Claude Code、Gemini CLI、OpenCode、Codex

## Usage

### 生成季度报告

在 Claude Code 中直接使用 slash command：

```
/qtreport
```

或手动运行：

```bash
aireport wrapped --days 90
```

### 生成日报

在 Claude Code 中直接使用 slash command：

```
/dayreport
```

或手动运行：

```bash
aireport daily
```

### 查看状态

```bash
aireport status
```

### 配置

```bash
aireport config
```

## Uninstall

```bash
aireport uninstall
```

## License

[MIT](./LICENSE)
