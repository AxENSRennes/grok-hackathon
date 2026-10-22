# Sidequest Live — Hackathon question bank

Drafted for the Grok Bot Community Engineering London Hackathon on 22 October 2026.
Humor-only selection, ending with an explicit closing question. These are opinion/self-report polls, not knowledge quizzes. No answer is marked correct.

## Verified topical hooks

- **21 October 2026 — PHP security releases / PHP2Shell.** The PHP Foundation confirmed that releases fixed two critical vulnerabilities. Avoid claiming a specific company was breached.
  - https://thephp.foundation/blog/2026/10/21/todays-php-security-release-and-how-were-strengthening-php-security/
  - Official X notice and follow-up thread, read in Chrome: https://x.com/ThePHPF/status/2112633155631108544
- **16 October 2026 — Cursor cloud-agent canvases.** Agents can produce and share interactive canvases.
  - https://cursor.com/changelog
  - Official post dated 16 October, read in Chrome and cross-checked against the changelog: https://x.com/cursor_ai/status/2111193957527146711
- **6 October 2026 — Cursor remote control for local agents.** A hook for the pizza/autonomous-agent joke.
  - https://cursor.com/changelog
- Event context: member introductions, useful community information, repeatable events and live demos.
  - https://gb-community-eng-hackathon-10-2026.teamdeel.workers.dev/hackathon#tracks

## Suggested running order

| # | Tone | Question | Format | Answer labels |
|---|---|---|---|---|
| 1 | Fun / agents | How much of your code could you explain without asking your AI? | scale | Every single line / Please don't ask |
| 2 | Fun / PHP | Your AI agent suggests rewriting everything in PHP. Your reaction? | choice | You're fired / Let it cook / At least it ships / What is PHP? |
| 3 | Fun / demos | What's most likely to break your live demo? | choice | Wi-Fi / API credits / One last deploy / Me |
| 4 | Fun / demos | How production-ready is your project? | scale | NASA could use it / Please don't refresh |
| 5 | Fun / agents | Who deserves the prize if you win? | choice | Me / My team / My agent / The person who brought pizza |
| 6 | Closing | Same time next week? | choice | I'm in / Only for the pizza / My agent already RSVP'd / I'll still be deploying |

The playable source is `src/server/questions/hackathon.en.json`. This document records the editorial selection and research context.

## Host notes

- Always keep question 6 last. The server rejects another `next` command after it.
- Each question currently lasts 30 seconds; the duration is editable in the source.
- Keep the atmosphere playful; vote positions express opinions.
- Suggested PHP follow-up line: "Somewhere, a WordPress site just felt that."
- Suggested code-explanation follow-up line: "The left side is writing the README. The right side is asking their agent what a README is."
- Suggested production-readiness follow-up line: "Confidence is high. Evidence is still loading."
- Suggested closing line: "Thanks for playing. You can stop deploying now."
