// Saves lesson progress to the server so a lesson can be continued after reload or logout/login.
import { API_BASE } from './config.js';
import { token } from './auth.js';
async function api(path, body) {
  const r = await fetch(API_BASE + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error('HTTP ' + r.status); return r.json();
}
export const saveProgress = body => api('/api/lessons', body);
export const listLessons = () => api('/api/lessons');
export const getLesson = id => api('/api/lessons/' + id);
