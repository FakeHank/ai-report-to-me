/**
 * Shared slash command content templates for all CLI adapters.
 * All CLIs use the same dayreport/qtreport logic: call save-daily/save-wrapped
 * to ensure webhooks are triggered.
 */

export function getDayreportContent(): string {
  return `Generate a daily report from my coding session data.

## Non-negotiable delivery rule

- A /dayreport run is only considered complete after \`aireport save-daily --date {SAVE_DATE} --content -\` succeeds.
- \`save-daily\` is the webhook trigger point. If you skip it, Slack/Feishu/other webhook messages will NOT be sent.
- Never write \`~/.ai-report/reports/{SAVE_DATE}.md\` directly.

## Steps

1. Run the following command to get the aggregated data and prompt:

\`\`\`
aireport daily --prompt-only
\`\`\`

2. Read the output carefully. It contains:
   - A system prompt with instructions on how to generate the report
   - Aggregated session data in JSON format
   - At the end, metadata lines starting with \`SAVE_DATE=\` and \`SESSION_IDS=\`

3. Follow the system prompt instructions to generate a complete daily report in Markdown.

4. After generating the report, save it by piping the content through \`save-daily\`:
   - Extract the \`SAVE_DATE\` value (e.g. \`2026-02-28\`)
   - Write the generated Markdown to a temp file, then run:

\`\`\`
aireport save-daily --date {SAVE_DATE} --content -
\`\`\`

   Pass the full report markdown via stdin (pipe or heredoc). This command saves the report **and** pushes to any configured webhooks (Slack, Discord, Feishu, etc.).

   **MANDATORY: /dayreport must call save-daily. Do NOT write directly to ~/.ai-report/reports/.**

5. Verify send status from command output:
   - Success signal includes lines like \`[feishu] Report pushed successfully\` / \`[slack] Report pushed successfully\`
   - If webhook push fails, report the failure clearly and keep the run marked as failed-to-deliver

6. If there are multiple days to generate (the command may output multiple prompts), process them in order. For each subsequent day, include the previous day's key decisions as context.

7. After saving, tell me the file path and a brief summary of what the report covers.

## Notes

- If the command says "All reports are up to date", just tell me that — no report needed.
- If the command says "No sessions found", tell me there's no data to report on.
- The report language follows the \`output_lang\` setting in \`~/.ai-report/config.json\`.
`
}

export function getQtreportContent(): string {
  return `Generate a 90-day Vibe Coding Wrapped report from my coding session data.

## Steps

1. Run the following command to get the aggregated data and prompt:

\`\`\`
aireport wrapped --days 90 --prompt-only
\`\`\`

2. Read the output carefully. It contains:
   - A system prompt with detailed instructions for generating the 8-section Wrapped report
   - Aggregated session data including: session stats, project breakdown, vibe signals, habit analysis, improvement suggestions
   - At the end, metadata lines starting with \`SAVE_PERIOD=\` and \`SESSION_IDS=\`

3. Follow the system prompt instructions to generate the complete Wrapped report with all 8 sections.

4. After generating the report, save it by piping the content through \`save-wrapped\`:
   - Extract the \`SAVE_PERIOD\` value (e.g. \`2026-01-01_2026-03-31\`) and \`SESSION_IDS\`
   - Run:

\`\`\`
aireport save-wrapped --period {SAVE_PERIOD} --session-ids {SESSION_IDS} --content -
\`\`\`

   Pass the full report markdown via stdin (pipe or heredoc). This command saves the report, generates the vibe card PNG, **and** pushes to any configured webhooks.

   **Do NOT write directly to ~/.ai-report/wrapped/ — always use save-wrapped so webhooks are triggered.**

5. After saving, tell me the file path and highlight the Vibe Coder type result and the roast quote.

## Notes

- If the command says "No sessions found", tell me there's no data in the last 90 days.
- The report language follows the \`output_lang\` setting in \`~/.ai-report/config.json\`.
- Section 7 (Vibe Coder type) should be entertaining enough to screenshot — put extra effort into the roast.
`
}

export function getCodexSkillContent(): string {
  return `---
name: ai-report
description: Generate daily coding reports or 90-day Vibe Coding Wrapped summaries from coding session data. Use when the user asks for /dayreport, /qtreport, daily report, or wrapped report.
---

# AI Report — Daily & Wrapped Reports

This skill provides two report commands for AI Report to Me.

## /dayreport — Generate Daily Report

${getDayreportContent()}

---

## /qtreport — Generate 90-Day Wrapped Report

${getQtreportContent()}
`
}
