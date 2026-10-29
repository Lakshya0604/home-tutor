# AI Teacher (working name)

Paste notes / unit text / a text PDF and an animated teacher explains it slowly in casual Hinglish, Hindi or English.
Pause, ask doubts, resume, then take an end-of-unit test with feedback.

- `public/` static frontend (Firebase Hosting). No secrets in here.
- `server/` optional API (auth, saved lessons, LLM proxy). Secrets live in server env vars only (see `server/.env.example`).
- Browser-only mode: paste your own free Groq / Gemini key in the in-app AI settings (kept in your browser's localStorage).

Limits: scanned PDFs need OCR (not built in). Video URLs cannot be fetched reliably from a browser; paste the transcript.
Voices: natural browser voices (e.g. Edge "Online (Natural)") are listed first; in-browser Piper voices are a labelled fallback.
