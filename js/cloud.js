// クラウド同期（Supabase：ログイン・データ保存・リアルタイム同期）
// - js/config.js の Project URL と Publishable(anon) key で接続
//   （この2つはブラウザに公開して良い値。秘密鍵 service_role / sb_secret は絶対に置かない）
// - ログインは Google またはメール＋パスワード。許可メンバー（ra_members）以外はデータを読めない（DB側のRLSで制限）
// - 変更はすぐ送信。他の端末の変更はリアルタイム受信（念のため60秒ごと・画面に戻ったときにも確認）

import { store, getMeta, setMeta } from './store.js';

const CONFIG_KEY = 'ra-senko-cloud-config';
const TABLE = 'ra_records';
const POLL_MS = 60000;

const listeners = new Set();
export const cloud = {
  status: 'local',      // local / setup / login / denied / syncing / ok / offline / error
  message: '',
  lastSync: null,
  user: null,
  live: false,          // リアルタイム接続中か
  onStatus(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};
function setStatus(status, message = '') {
  cloud.status = status;
  cloud.message = message;
  listeners.forEach(fn => fn(cloud));
}

export function getConfig() {
  const file = window.RA_CLOUD || {};
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}'); } catch { /* 無視 */ }
  const url = (file.url || saved.url || '').trim().replace(/\/+$/, '');
  const key = (file.anonKey || saved.anonKey || '').trim();
  return url && key ? { url, key, fromFile: !!(file.url && file.anonKey) } : null;
}
export function saveConfig(url, anonKey) {
  url = url.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
  localStorage.setItem(CONFIG_KEY, JSON.stringify({ url, anonKey: anonKey.trim() }));
  // serve.py で開いている場合は js/config.js にも書き込む（公開版に反映すれば全員ログインだけで使える）
  fetch('__cloud-config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, key: anonKey.trim() }) }).catch(() => {});
}
export function clearConfig() { localStorage.removeItem(CONFIG_KEY); }
export const isCloud = () => !!getConfig();

let sb = null;
export const client = () => sb;
function makeClient() {
  const cfg = getConfig();
  sb = window.supabase.createClient(cfg.url, cfg.key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce', storageKey: 'ra-senko-auth' },
  });
  return sb;
}

function niceError(e) {
  const m = e?.message || String(e);
  if (/invalid login/i.test(m)) return 'メールアドレスまたはパスワードが違います';
  if (/provider is not enabled|Unsupported provider/i.test(m)) return 'Googleログインがまだ有効になっていません（Supabase の Authentication → Providers で Google を有効化してください）';
  if (/relation .* does not exist|PGRST205|Could not find the table/i.test(m)) return 'データベースの準備がまだです（supabase/setup.sql を実行してください）';
  if (/row-level security|permission denied|42501/i.test(m)) return 'このアカウントには編集権限がありません（許可メンバーに登録されているか確認してください）';
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'ネットワークに接続できません';
  return m;
}
const isOffline = e => !navigator.onLine || /Failed to fetch|NetworkError|Load failed/i.test(e?.message || '');

// ---------- 送信 ----------
let pushing = null;
let pushAgain = false;
async function push() {
  if (pushing) { pushAgain = true; return pushing; }
  pushing = (async () => {
    do {
      pushAgain = false;
      const ids = store.pendingIds();
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const sent = {};
        const rows = chunk.map(id => {
          const r = store.pendingRecord(id);
          if (!r) return null;
          sent[id] = r.updatedAt;
          return { id: r.id, kind: r.kind, data: r, deleted: !!r.deleted };
        }).filter(Boolean);
        if (rows.length) {
          const { error } = await sb.from(TABLE).upsert(rows, { onConflict: 'id', returning: 'minimal' });
          if (error) throw error;
        }
        await store.clearPending(chunk, sent);
      }
    } while (pushAgain);
  })();
  try { await pushing; } finally { pushing = null; }
}

// ---------- 受信 ----------
async function pull() {
  // 少し前から取り直す（同時刻の書き込みの取りこぼし防止。重複は無害）
  const since = (await getMeta('lastPull')) || '1970-01-01T00:00:00Z';
  const from = new Date(new Date(since).getTime() - 60000).toISOString();
  let last = since, lastMs = new Date(since).getTime();
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await sb.from(TABLE).select('id,data,updated_at').gt('updated_at', from).order('updated_at').range(offset, offset + 999);
    if (error) throw error;
    if (!data.length) break;
    await store.applyRemote(data.map(r => r.data));
    data.forEach(r => { const ms = new Date(r.updated_at).getTime(); if (ms > lastMs) { lastMs = ms; last = r.updated_at; } });
    if (data.length < 1000) break;
  }
  await setMeta('lastPull', last);
}

let syncing = null;
export async function syncNow() {
  if (!sb || !cloud.user || cloud.status === 'denied') return;
  if (syncing) return syncing;
  syncing = (async () => {
    setStatus('syncing');
    try {
      await push();
      await pull();
      cloud.lastSync = new Date();
      setStatus('ok');
    } catch (e) {
      if (isOffline(e)) setStatus('offline', 'オフラインです。変更はこの端末に保存され、つながったら送信されます');
      else setStatus('error', niceError(e));
    }
  })();
  try { await syncing; } finally { syncing = null; }
}

let pushTimer = null;
function schedulePush() {
  if (!sb || !cloud.user) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    setStatus('syncing');
    try { await push(); cloud.lastSync = new Date(); setStatus('ok'); }
    catch (e) { isOffline(e) ? setStatus('offline', 'オフラインです。変更はこの端末に保存されています') : setStatus('error', niceError(e)); }
  }, 250);
}

// ---------- リアルタイム ----------
let channel = null;
function subscribe() {
  channel?.unsubscribe();
  channel = sb.channel('ra-records')
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, payload => {
      const row = payload.new;
      if (row?.data) store.applyRemote([row.data]);
    })
    .subscribe(st => {
      cloud.live = st === 'SUBSCRIBED';
      if (st === 'SUBSCRIBED') syncNow();   // つながり直したときの取りこぼしを回収
      listeners.forEach(fn => fn(cloud));
    });
}

// 許可メンバーか確認
async function checkMember() {
  const { data, error } = await sb.from('ra_members').select('email').eq('email', cloud.user.toLowerCase()).maybeSingle();
  if (error) throw error;
  return !!data;
}

let started = false;
export async function startCloud() {
  if (!isCloud()) { setStatus('local'); return 'local'; }
  if (!window.supabase) { setStatus('error', 'ライブラリの読み込みに失敗しました'); return 'error'; }
  makeClient();
  store.setSyncHook(schedulePush);
  await store.loadPurgedQueue();
  const { data: { session }, error } = await sb.auth.getSession();
  if (error) setStatus('login', niceError(error));
  if (!session) { cloud.user = null; setStatus('login', error ? niceError(error) : ''); return 'login'; }
  cloud.user = session.user.email;
  // 別のアカウントでこの端末を使っていた場合に混ざらないようにする
  const lastUser = await getMeta('user');
  if (lastUser && lastUser !== cloud.user && !store.pendingIds().length) await store.wipeLocal();
  await setMeta('user', cloud.user);
  try {
    if (!await checkMember()) { setStatus('denied', `${cloud.user} はまだ許可メンバーに登録されていません`); return 'denied'; }
  } catch (e) {
    if (isOffline(e) && store.count()) { setStatus('offline', 'オフラインです（この端末の保存データを表示しています）'); return 'offline'; }
    setStatus('error', niceError(e)); return 'error';
  }
  if (!started) {
    started = true;
    subscribe();
    setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, POLL_MS);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
    window.addEventListener('online', () => syncNow());
  }
  await syncNow();
  return cloud.status;
}

// ---------- ログイン ----------
const redirectUrl = () => location.origin + location.pathname;
export async function signInGoogle() {
  const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectUrl(), queryParams: { prompt: 'select_account' } } });
  if (error) throw new Error(niceError(error));
}
export async function signInPassword(email, password) {
  const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(niceError(error));
}
export async function signOut({ wipe = true } = {}) {
  try { await sb?.auth.signOut(); } catch { /* 無視 */ }
  if (wipe && !store.pendingIds().length) await store.wipeLocal();
  cloud.user = null;
  setStatus('login');
}

// ---------- 許可メンバー管理（設定画面用） ----------
export async function listMembers() {
  const { data, error } = await sb.from('ra_members').select('*').order('created_at');
  if (error) throw new Error(niceError(error));
  return data;
}
export async function addMember(email, name) {
  const { error } = await sb.from('ra_members').insert({ email: email.trim().toLowerCase(), name: name.trim() });
  if (error) throw new Error(/duplicate/i.test(error.message) ? 'すでに登録されています' : niceError(error));
}
export async function removeMember(email) {
  const { error } = await sb.from('ra_members').delete().eq('email', email);
  if (error) throw new Error(niceError(error));
}

// 接続テスト（設定画面用）
export async function testConnection(url, key) {
  url = url.trim().replace(/\/+$/, '');
  const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key.trim() } }).catch(() => null);
  if (!res?.ok) throw new Error(`接続できません${res ? `（HTTP ${res.status}）` : ''}。URLとキーを確認してください`);
  return res.json();
}
