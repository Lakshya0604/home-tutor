# Exact detailed-note board regressions

Dependency-free checks:

```sh
node --test tests/note-board.test.mjs
```

Browser check, with Playwright installed locally:

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
node tests/note-board.browser.mjs
```

Set `CHROME_PATH` to use an existing Chrome executable. Optional `SCREENSHOT_DIR` writes desktop/mobile evidence.

The UI check uses synthetic local generation, speech and save doubles, and blocks external requests. It starts through the source UI, reaches line three, pauses, resumes through the actual control (rebuilding the board), and checks full unchanged board text, retained cursor and unchanged raw response on desktop/mobile. It does not verify real speech or generated teaching accuracy.

Display scope: where a detailed-note sentence has a board entry, copy the complete English sentence instead of an independent summary. Keep no-board sentences, math-step payloads and topic-mode boards unchanged. This preserves the sentence's own qualifications; it cannot make a wrong sentence true or validate Hindi translation.

Pause/Resume also checks that replaying an interrupted sentence twice does not duplicate its visible teaching transcript row. Audio replay is still intentional so the interrupted sentence is heard in full.

## Sign-in and generation-schema regressions

`node --test tests/*.test.mjs` checks array size constraints, the unchanged minimum explanation quality gate, concise doubt compatibility, and the bilingual teaching shape: labeled roles, a final source-answerable question, rejection of copied source lines as explanations, invented review-question numbers, review questions that drift to concepts absent from the source, and lessons that leave the board completely empty. These are narrow structural checks, not semantic proof.

`CHROME_PATH=/path/to/chrome node tests/auth-error.browser.mjs` runs a synthetic failed-then-successful sign-in through the real login dialog. It checks error retention, mode switching and button recovery. It does not use real accounts or call production services. Screenshots are written to `/downloads/` for desktop/mobile inspection.

The lesson prompt now states the same minimum length the existing coverage validator requires. This does not prove factual accuracy or guarantee model compliance. Hindi browser speech and end-to-end teaching still require live verification.
