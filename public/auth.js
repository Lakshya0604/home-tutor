import { API_BASE } from './config.js';
const TK = 'ht.token', UK = 'ht.user';
export const token = () => localStorage.getItem(TK) || '';
export const user = () => { try { return JSON.parse(localStorage.getItem(UK) || 'null'); } catch { return null; } };
export function logout() { localStorage.removeItem(TK); localStorage.removeItem(UK); location.reload(); }
async function call(path, body) {
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 70000); // free server may need ~50s to wake
  try {
    const r = await fetch(API_BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Request failed (' + r.status + ')');
    return j;
  } catch (e) { throw new Error(e.name === 'AbortError' ? 'Server is waking up, please try again in a minute.' : e.message); } finally { clearTimeout(to); }
}
export async function login(email, password) { const j = await call('/api/auth/login', { email, password }); localStorage.setItem(TK, j.token); localStorage.setItem(UK, JSON.stringify(j.user)); return j.user; }
export async function register(name, email, password) { const j = await call('/api/auth/register', { name, email, password }); localStorage.setItem(TK, j.token); localStorage.setItem(UK, JSON.stringify(j.user)); return j.user; }
// Shows the login/register dialog until signed in. Resolves with the user.
export function requireLogin() {
  return new Promise(resolve => {
    if (token() && user()) return resolve(user());
    const dlg = document.getElementById('authDlg'), $ = id => document.getElementById(id); let mode = 'login';
    const sync = () => { $('authName').hidden = mode === 'login'; $('authTitle').textContent = mode === 'login' ? 'Login to Home Tutor' : 'Create your Home Tutor account'; $('authGo').textContent = mode === 'login' ? 'Login' : 'Register'; $('authSwitch').textContent = mode === 'login' ? 'New here? Create account' : 'Have an account? Login'; $('authErr').textContent = ''; };
    $('authSwitch').onclick = e => { e.preventDefault(); mode = mode === 'login' ? 'register' : 'login'; sync(); };
    $('authGo').onclick = async e => {
      e.preventDefault(); $('authErr').textContent = ''; $('authGo').disabled = true; $('authGo').textContent = 'Please wait…';
      try { const u = mode === 'login' ? await login($('authEmail').value.trim(), $('authPass').value) : await register($('authName').value.trim(), $('authEmail').value.trim(), $('authPass').value); dlg.close(); resolve(u); }
      catch (err) { $('authErr').textContent = err.message; } finally { $('authGo').disabled = false; sync(); }
    };
    dlg.addEventListener('cancel', ev => ev.preventDefault());
    sync(); dlg.showModal();
  });
}
