import express from 'express'; import cors from 'cors'; import helmet from 'helmet'; import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose'; import bcrypt from 'bcryptjs'; import jwt from 'jsonwebtoken';
const { PORT = 8080, MONGODB_URI: URI_ENV, MONGODB_HOST, MONGODB_USER, MONGODB_PASS, JWT_SECRET, GROQ_API_KEY, GROQ_MODEL = 'llama-3.3-70b-versatile', ALLOWED_ORIGIN } = process.env;
const MONGODB_URI = URI_ENV || `mongodb+srv://${encodeURIComponent(MONGODB_USER)}:${encodeURIComponent(MONGODB_PASS)}@${MONGODB_HOST}/hometutor?authSource=admin&retryWrites=true&w=majority`;
if (!JWT_SECRET || (!URI_ENV && !(MONGODB_HOST && MONGODB_USER && MONGODB_PASS))) { console.error('JWT_SECRET and DB settings are required'); process.exit(1); }
await mongoose.connect(MONGODB_URI);
const User = mongoose.model('User', new mongoose.Schema({ name: String, email: { type: String, unique: true, lowercase: true, trim: true }, hash: String, createdAt: { type: Date, default: Date.now } }));
const Lesson = mongoose.model('Lesson', new mongoose.Schema({ user: { type: mongoose.Schema.Types.ObjectId, index: true }, title: String, lang: String, source: String, chunkIndex: Number, sentIndex: Number, finished: Boolean, score: String, updatedAt: { type: Date, default: Date.now } }));
const app = express();
app.set('trust proxy', 1);
app.use(helmet()); app.use(cors({ origin: ALLOWED_ORIGIN ? ALLOWED_ORIGIN.split(',') : false })); app.use(express.json({ limit: '300kb' }));
app.get('/health', (_, r) => r.json({ ok: true }));
const sign = u => jwt.sign({ id: u._id }, JWT_SECRET, { expiresIn: '14d' });
const auth = (q, r, n) => { try { q.uid = jwt.verify((q.headers.authorization || '').replace('Bearer ', ''), JWT_SECRET).id; n(); } catch { r.status(401).json({ error: 'Please log in' }); } };
const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
app.post('/api/auth/register', authLimit, async (q, r) => {
  const { name = '', email = '', password = '' } = q.body || {};
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return r.status(400).json({ error: 'Valid email and a password of 8+ characters required' });
  if (await User.findOne({ email })) return r.status(409).json({ error: 'Email already registered' });
  const u = await User.create({ name: String(name).slice(0, 60), email, hash: await bcrypt.hash(password, 11) });
  r.json({ token: sign(u), user: { name: u.name, email: u.email } });
});
app.post('/api/auth/login', authLimit, async (q, r) => {
  const { email = '', password = '' } = q.body || {}; const u = await User.findOne({ email: String(email).toLowerCase() });
  if (!u || !(await bcrypt.compare(String(password), u.hash))) return r.status(401).json({ error: 'Wrong email or password' });
  r.json({ token: sign(u), user: { name: u.name, email: u.email } });
});
app.get('/api/auth/me', auth, async (q, r) => { const u = await User.findById(q.uid); if (!u) return r.status(401).json({ error: 'Please log in' }); r.json({ user: { name: u.name, email: u.email } }); });
// LLM proxy: the Groq key stays in this server's environment only.
const llmLimit = rateLimit({ windowMs: 60 * 1000, max: 12, keyGenerator: q => q.uid || q.ip, validate: false });
app.post('/api/llm', auth, llmLimit, async (q, r) => {
  if (!GROQ_API_KEY) return r.status(503).json({ error: 'AI is not configured on the server' });
  const { messages, json = true, temperature = 0.4 } = q.body || {};
  if (!Array.isArray(messages) || JSON.stringify(messages).length > 60000) return r.status(400).json({ error: 'Bad request' });
  const body = { model: GROQ_MODEL, messages, temperature }; if (json) body.response_format = { type: 'json_object' };
  try {
    const x = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + GROQ_API_KEY }, body: JSON.stringify(body) });
    const t = await x.text(); if (!x.ok) console.error('groq', x.status, t.slice(0, 300)); if (!x.ok) return r.status(x.status === 429 ? 429 : 502).json({ error: x.status === 429 ? 'AI free limit reached, try again in a minute' : 'AI provider error' });
    r.type('json').send(t);
  } catch { r.status(502).json({ error: 'AI provider unreachable' }); }
});
// Saved lessons (progress so you can continue later)
app.get('/api/lessons', auth, async (q, r) => r.json(await Lesson.find({ user: q.uid }, 'title lang chunkIndex sentIndex finished score updatedAt').sort({ updatedAt: -1 }).limit(30)));
app.get('/api/lessons/:id', auth, async (q, r) => { const l = await Lesson.findOne({ _id: q.params.id, user: q.uid }); l ? r.json(l) : r.status(404).json({ error: 'Not found' }); });
app.post('/api/lessons', auth, async (q, r) => {
  const b = q.body || {}; const doc = { user: q.uid, title: String(b.title || 'Untitled').slice(0, 120), lang: b.lang, source: String(b.source || '').slice(0, 60000), chunkIndex: +b.chunkIndex || 0, sentIndex: +b.sentIndex || 0, finished: !!b.finished, score: b.score, updatedAt: new Date() };
  const l = b.id ? await Lesson.findOneAndUpdate({ _id: b.id, user: q.uid }, doc, { new: true }) : await Lesson.create(doc); r.json({ id: l?._id });
});
app.listen(PORT, () => console.log('API on', PORT));
