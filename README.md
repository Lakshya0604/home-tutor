# Home Tutor

Paste notes, unit text or a text PDF and an animated teacher explains it slowly, line by line, in casual Hinglish, Hindi or English.
Pause, ask doubts, resume from the same line, then take an end-of-unit test with feedback and re-explanations.

## Stack (all free tier)
- `public/` static frontend on Vercel. No secrets in it.
- `server/` Node/Express API on Render (free web service): login (JWT), saved lesson progress, and an LLM proxy that holds the Groq key.
- Database: MongoDB Atlas free (M0) cluster, one user with readWrite on the `hometutor` database only.
- Secrets live only in the server environment (see `server/.env.example`). Nothing secret is committed.

## Notes and limits
- The Render free service sleeps after 15 minutes idle. The first login or AI request after that can take about a minute.
- Scanned PDFs need OCR (not built in). Video URLs cannot be fetched reliably from a browser: paste the transcript.
- Voices: natural browser/device voices are listed first when the browser has them (e.g. Edge "Online (Natural)"). In-browser Piper voices are a labelled, flatter fallback and are never chosen automatically.
- Lesson progress is saved to your account after each line, so you can continue after reload or logout.
- Text over 60,000 characters is cut to the first 60,000.
