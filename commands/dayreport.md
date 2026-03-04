Generate a daily report from my coding session data.

## Non-negotiable delivery rule

- A /dayreport run is only considered complete after `aireport save-daily --date {SAVE_DATE} --content -` succeeds.
- `save-daily` is the webhook trigger point. If you skip it, Slack/Feishu/other webhook messages will NOT be sent.
- Never write `~/.ai-report/reports/{SAVE_DATE}.md` directly.

## Steps

1. Run the following command to get the aggregated data and prompt:

```
aireport daily --prompt-only
```

2. Read the output carefully. It contains:
   - A system prompt with instructions on how to generate the report
   - Aggregated session data in JSON format
   - At the end, metadata lines starting with `SAVE_DATE=` and `SESSION_IDS=`

3. Follow the system prompt instructions to generate a complete daily report in Markdown.

4. After generating the report, save it by piping the content through `save-daily`:
   - Extract the `SAVE_DATE` value (e.g. `2026-02-28`)
   - Write the generated Markdown to a temp file, then run:

```
aireport save-daily --date {SAVE_DATE} --content -
```

   Pass the full report markdown via stdin (pipe or heredoc). This command saves the report **and** pushes to any configured webhooks (Slack, Discord, Feishu, etc.).

   **MANDATORY: /dayreport must call save-daily. Do NOT write directly to ~/.ai-report/reports/.**

5. Verify send status from command output:
   - Success signal includes lines like `[feishu] Report pushed successfully` / `[slack] Report pushed successfully`
   - If webhook push fails, report the failure clearly and keep the run marked as failed-to-deliver

6. If there are multiple days to generate (the command may output multiple prompts), process them in order. For each subsequent day, include the previous day's key decisions as context.

7. After saving, tell me the file path and a brief summary of what the report covers.

## Notes

- If the command says "All reports are up to date", just tell me that — no report needed.
- If the command says "No sessions found", tell me there's no data to report on.
- The report language follows the `output_lang` setting in `~/.ai-report/config.json`.
