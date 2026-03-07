Generate a 90-day Vibe Coding Wrapped report from my coding session data.

## Steps

1. Run the following command to get the aggregated data and prompt:

```
aireport wrapped --days 90 --prompt-only
```

2. Read the output carefully. It contains:
   - A system prompt with detailed instructions for generating the 8-section Wrapped report
   - Aggregated session data including: session stats, project breakdown, vibe signals, habit analysis, improvement suggestions
   - At the end, metadata lines starting with `SAVE_PERIOD=` and `SESSION_IDS=`

3. Follow the system prompt instructions to generate the complete Wrapped report with all 8 sections.

4. After generating the report, save it by piping the content through `save-wrapped`:
   - Extract the `SAVE_PERIOD` value (e.g. `2026-01-01_2026-03-31`), `SESSION_IDS`, and `STATS`
   - Run:

```
aireport save-wrapped --period {SAVE_PERIOD} --session-ids {SESSION_IDS} --stats {STATS} --content -
```

   Pass the full report markdown via stdin (pipe or heredoc). The `--stats` flag passes pre-computed stats so the card generator doesn't need to re-read all sessions. This command saves the report, generates the vibe card PNG, **and** pushes to any configured webhooks.

   **Do NOT write directly to ~/.ai-report/wrapped/ — always use save-wrapped so webhooks are triggered.**

5. After saving, tell me the file path and highlight the Vibe Coder type result and the roast quote.

## Notes

- If the command says "No sessions found", tell me there's no data in the last 90 days.
- The report language follows the `output_lang` setting in `~/.ai-report/config.json`.
- Section 7 (Vibe Coder type) should be entertaining enough to screenshot — put extra effort into the roast.
