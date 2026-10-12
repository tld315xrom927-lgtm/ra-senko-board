// アプリの起動・画面の切り替え・ログイン画面
import { store } from './store.js';
import { ensureStatuses } from './model.js';
import { cloud, startCloud, isCloud, signInGoogle, signInPassword, signOut, getConfig, saveConfig, testConnection } from './cloud.js';
import { esc, $, $$, icon, toast, closePopover } from './ui.js';
import { renderDashboard } from './dashboard.js';
import { renderCalendar } from './calendar.js';
import { renderCAList, renderCAPage, renderCandidates, renderCandidatePage, renderCompanies, renderCompanyPage, renderFollowups } from './pages.js';
import { renderSettings } from './settings.js';
import { insertDemo } from './demo.js';
import { openNewApplication } from './forms.js';

const NAV = [
  ['#/', 'home', 'ホーム'], ['#/calendar', 'calendar', 'カレンダー'], ['#/followups', 'coffee', '定期面談'],
  ['#/ca', 'users', 'CA'], ['#/candidates', 'user', '求職者'], ['#/companies', 'building', '企業'], ['#/settings', 'settings', '設定'],
];
const ROUTES = [
  [/^#?\/?$/, renderDashboard, 'ホーム'],
  [/^#\/calendar(?:\/(?<date>\d{4}-\d{2}-\d{2}))?$/, renderCalendar, 'カレンダー'],
  [/^#\/followups$/, renderFollowups, '定期面談'],
  [/^#\/ca$/, renderCAList, 'CA'],
  [/^#\/ca\/(?<id>[\w-]+)$/, renderCAPage, 'CA'],
  [/^#\/candidates$/, renderCandidates, '求職者'],
  [/^#\/candidate\/(?<id>[\w-]+)$/, renderCandidatePage, '求職者'],
  [/^#\/companies$/, renderCompanies, '企業'],
  [/^#\/company\/(?<id>[\w-]+)$/, renderCompanyPage, '企業'],
  [/^#\/settings$/, renderSettings, '設定'],
];
const isLocalHost = () => /^(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\])/.test(location.hostname) || location.protocol === 'file:';

let view = null;
function route() {
  closePopover();
  const hash = location.hash || '#/';
  const hit = ROUTES.find(([re]) => re.test(hash)) || ROUTES[0];
  const params = hash.match(hit[0])?.groups || {};
  // ページごとに新しい main を作る（前のページのイベントを残さない）
  const old = $('#main');
  const main = document.createElement('main');
  main.id = 'main';
  old.replaceWith(main);
  view = hit[1](main, params);
  $$('.nav a').forEach(a => a.classList.toggle('active', a.dataset.label === hit[2]));
  document.title = `${hit[2] === 'ホーム' ? '' : hit[2] + '｜'}選考進捗ボード`;
  window.scrollTo(0, 0);
}

let refreshQueued = false;
function onData() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(() => { refreshQueued = false; try { view?.refresh?.(); } catch (e) { console.error(e); } });
}

function shell() {
  document.body.innerHTML = `<div class="app">
    <aside class="side">
      <a class="brand" href="#/"><span class="logo">${icon('sparkle')}</span><div><b>選考進捗ボード</b><small>RA SELECTION BOARD</small></div></a>
      <button class="btn primary new-btn" data-new>${icon('plus')}<span>新規応募登録</span></button>
      <nav class="nav">${NAV.map(([h, ic, l]) => `<a href="${h}" data-label="${l}">${icon(ic)}<span>${l}</span></a>`).join('')}</nav>
      <footer class="side-foot"><div id="sync-badge"></div></footer>
    </aside>
    <main id="main"></main>
  </div><div id="toasts"></div>`;
  $('[data-new]').onclick = () => openNewApplication();
  cloud.onStatus(drawBadge);
  drawBadge();
}
function drawBadge() {
  const box = $('#sync-badge');
  if (!box) return;
  const map = {
    local: ['warn', 'この端末だけに保存中', 'クラウド未接続'], ok: ['ok', cloud.live ? 'リアルタイム同期中' : '同期済み', cloud.user],
    syncing: ['busy', '同期中…', cloud.user], offline: ['warn', 'オフライン', '変更は端末に保存中'], error: ['err', '同期エラー', cloud.message], login: ['warn', '要ログイン', ''],
  };
  const [cls, label, sub] = map[cloud.status] || ['warn', cloud.status, ''];
  box.innerHTML = `<a class="sync ${cls}" href="#/settings" title="${esc(cloud.message || '')}"><i></i><div><b>${esc(label)}</b><small>${esc(sub || '')}</small></div></a>`;
}

// ---------- ログイン・準備画面 ----------
function gate(inner) {
  document.body.innerHTML = `<div class="gate"><div class="gate-card"><div class="gate-logo">${icon('sparkle')}</div><h1>選考進捗ボード</h1><p class="muted">RA業務専用｜許可されたメンバーのみ利用できます</p>${inner}</div></div><div id="toasts"></div>`;
}
function loginScreen(msg = '') {
  gate(`${msg ? `<p class="gate-msg">${esc(msg)}</p>` : ''}
    <button class="btn google" data-google><svg viewBox="0 0 48 48" class="ic"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.7 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z"/><path fill="#FBBC05" d="M10.6 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.6l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.7 10.7z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.8-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.4 2.3-6.2 0-11.5-4.2-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>Googleでログイン</button>
    <div class="or"><span>またはメールアドレスで</span></div>
    <form class="gate-form"><input type="email" name="email" placeholder="メールアドレス" autocomplete="username" required><input type="password" name="password" placeholder="パスワード" autocomplete="current-password" required><button class="btn primary">ログイン</button></form>
    <p class="small muted">${icon('lock')}データは許可メンバーだけが閲覧・編集できます</p>`);
  $('[data-google]').onclick = async () => { try { await signInGoogle(); } catch (e) { toast(e.message, 'err'); } };
  $('.gate-form').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const btn = $('button', e.target);
    btn.disabled = true; btn.textContent = 'ログイン中…';
    try { await signInPassword(f.get('email'), f.get('password')); location.reload(); }
    catch (err) { toast(err.message, 'err'); btn.disabled = false; btn.textContent = 'ログイン'; }
  };
}
function deniedScreen() {
  gate(`<p class="gate-msg">${icon('lock')}${esc(cloud.message)}</p><p class="small">管理者に「設定 → 許可メンバー」へ、このメールアドレスを追加してもらってください。追加後にこの画面を再読み込みすると使えます</p>
    <div class="btn-row center"><button class="btn" data-reload>${icon('refresh')}再読み込み</button><button class="btn" data-out>${icon('logout')}別のアカウントでログイン</button></div>`);
  $('[data-reload]').onclick = () => location.reload();
  $('[data-out]').onclick = async () => { await signOut(); location.reload(); };
}
function setupScreen() {
  gate(`<p class="gate-msg">このアプリはまだデータベースに接続されていません</p>
    <p class="small">管理者の方は、Supabase の Project URL と Publishable（anon）key を入力してください</p>
    <form class="gate-form"><input name="url" placeholder="https://xxxx.supabase.co" required><input name="key" placeholder="Publishable / anon key" required><button class="btn primary">接続する</button></form>`);
  $('.gate-form').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    if (/service_role|sb_secret_/.test(f.get('key'))) return toast('それは秘密鍵です。Publishable（anon）key を入力してください', 'err');
    try { await testConnection(f.get('url'), f.get('key')); saveConfig(f.get('url'), f.get('key')); location.reload(); } catch (err) { toast(err.message, 'err'); }
  };
}
function errorScreen(msg) {
  gate(`<p class="gate-msg">${icon('alert')}${esc(msg)}</p><div class="btn-row center"><button class="btn" data-reload>${icon('refresh')}再読み込み</button><button class="btn" data-out>${icon('logout')}ログアウト</button></div>`);
  $('[data-reload]').onclick = () => location.reload();
  $('[data-out]').onclick = async () => { await signOut(); location.reload(); };
}

async function boot() {
  try {
    await store.init();
  } catch (e) {
    return errorScreen('この端末のブラウザ保存領域を開けませんでした（プライベートブラウズでは使えない場合があります）');
  }
  if (!isCloud() && !isLocalHost()) return setupScreen();   // 公開URLでは必ずクラウド＋ログインで使う
  const st = await startCloud();
  if (st === 'login') return loginScreen(cloud.message);
  if (st === 'denied') return deniedScreen();
  if (st === 'error' && !store.count()) return errorScreen(cloud.message);
  // ステータスの初期登録（クラウドの場合は同期が済んでから）
  if (st === 'local' || st === 'ok') await ensureStatuses();
  if (st === 'local' && !localStorage.getItem('ra-demo-seeded')) {
    localStorage.setItem('ra-demo-seeded', '1');
    if (store.list('application').length === 0) await insertDemo();
  }
  shell();
  store.onChange(onData);
  window.addEventListener('hashchange', route);
  route();
  if (st === 'error') toast(cloud.message, 'err');
}
boot().finally(() => document.documentElement.classList.remove('booting'));
