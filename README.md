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
- Scanned PDFs: in-browser OCR (Tesseract.js from jsDelivr, Hindi + English, first 12 pages). OCR output can contain mistakes, so check the text before starting. Video URLs cannot be fetched reliably from a browser: paste the transcript.
- Voices: natural browser/device voices are listed first when the browser has them (e.g. Edge "Online (Natural)"). In-browser Piper voices are a labelled, flatter fallback and are never chosen automatically.
- Lesson progress is saved to your account after each line, so you can continue after reload or logout.
- Text over 60,000 characters is cut to the first 60,000.

## Voice licences
Piper voices come from https://huggingface.co/rhasspy/piper-voices. Only Kristin (English, public domain) is offered. The Hindi Piper voices are CC BY-NC-SA 4.0 or have unreviewed licences, so they are not offered. Check a voice's MODEL_CARD before adding it, especially for commercial use.

## Teacher avatar and teaching flow

- The teacher is a 3D human model ("Ember", VRM) by [VTubeMe](https://vtubeme.com/free-vrm-avatars/ember), licensed CC BY 4.0 (credit shown in the app). It is drawn with three.js and @pixiv/three-vrm loaded from jsDelivr. If WebGL or the model cannot load, the app falls back to the drawn teacher. Gestures move the model's arm bones; the mouth follows speech activity (no phoneme lip-sync).
- The whole text or PDF is read first and split into topics. Each topic is taught completely (board notes, diagrams, step-by-step derivations and numericals with a "from:" source for each step), then the lesson pauses so you can ask doubts and press Next topic. For very long material the topic plan uses the opening lines of each part; every part is still taught from its full text.
- Speed: 0.75x, 1x, 1.25x, 1.5x, 2x. Doubts: type, or use the browser's speech recognition (Chrome/Edge; needs microphone permission).
