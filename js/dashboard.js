// トップページ（ダッシュボード）
import { store } from './store.js';
import {
  DASH_CARDS, stageCounts, applications, appRow, actionItems, calendarItems, isClosed, statuses, stageOf, eventsFor,
  today, addDays, fmtDate, parseYmd, ymd, EVENT_TYPES, isActiveEvent,
} from './model.js';
import { esc, $, $$, icon, toast } from './ui.js';
import { tableHTML, sortRows, bindTable } from './table.js';
import { openNewApplication, openApplication, openEvent, caOptions, companyOptions, statusOptions } from './forms.js';
import { opts } from './ui.js';
import { showItem } from './calendar.js';

const FKEY = 'ra-filters';
const defaults = { q: '', ca: '', company: '', status: '', stage: '', period: '', periodDate: '', deadline: '', scope: 'active', sort: { key: 'nextAction', dir: 1 } };
export const filters = { ...defaults, ...JSON.parse(localStorage.getItem(FKEY) || '{}') };
const saveFilters = () => localStorage.setItem(FKEY, JSON.stringify(filters));
let collapsed = localStorage.getItem('ra-actions-collapsed') === '1';

// 絞り込み
export function filterApps(f = filters) {
  const t = today();
  const week = (() => { const d = parseYmd(t); const s = addDays(t, -((d.getDay() + 6) % 7)); return [s, addDays(s, 6)]; })();
  const q = f.q.trim().toLowerCase();
  return applications().map(appRow).filter(r => {
    if (f.scope === 'active' && isClosed(r.app)) return false;
    if (f.scope === 'closed' && !isClosed(r.app)) return false;
    if (f.stage && f.stage !== 'all' && r.stage !== f.stage) return false;
    if (f.ca && r.caId !== f.ca) return false;
    if (f.company && r.app.companyId !== f.company) return false;
    if (f.status && r.app.statusId !== f.status) return false;
    if (q && ![r.candName, r.cand?.kana, r.companyName, r.caName, r.app.memo].some(s => (s || '').toLowerCase().includes(q))) return false;
    if (f.period) {
      const range = { today: [t, t], tomorrow: [addDays(t, 1), addDays(t, 1)], week, nextweek: [addDays(week[0], 7), addDays(week[1], 7)], upcoming: [t, '9999'], date: [f.periodDate, f.periodDate] }[f.period];
      if (!range?.[0]) return true;
      if (!eventsFor({ applicationId: r.app.id, type: 'interview' }).some(e => isActiveEvent(e) && e.date >= range[0] && e.date <= range[1])) return false;
    }
    if (f.deadline) {
      const d = r.app.acceptDeadline?.slice(0, 10);
      if (!d) return false;
      if (f.deadline === 'overdue' && !(d < t)) return false;
      if (f.deadline === '3' && !(d >= t && d <= addDays(t, 3))) return false;
      if (f.deadline === '7' && !(d >= t && d <= addDays(t, 7))) return false;
    }
    return true;
  });
}

export function renderDashboard(main) {
  main.innerHTML = `
  <header class="page-head">
    <div><p class="eyebrow">${icon('sparkle')}RA SELECTION BOARD</p><h1>選考進捗ダッシュボード</h1><p class="muted">${esc(fmtDate(today(), { year: true }))}　誰が・どの企業に・どこまで進んでいるかをひと目で</p></div>
    <div class="head-actions"><a class="btn" href="#/calendar">${icon('calendar')}カレンダー</a><button class="btn primary big" data-new>${icon('plus')}新規応募登録</button></div>
  </header>
  <section class="stat-cards" id="d-cards"></section>
  <section class="dash-grid ${collapsed ? 'collapsed' : ''}">
    <div class="panel" id="d-actions"></div>
    <div class="panel" id="d-today"></div>
  </section>
  <section class="panel table-panel">
    <div class="panel-head"><div>${icon('list')}<h3>応募者一覧</h3><span class="count" id="d-count"></span></div>
      <div class="ph-actions"><button class="btn sm ghost" data-reset>${icon('refresh')}条件をリセット</button></div></div>
    <div class="filter-bar" id="d-filters"></div>
    <div id="d-table"></div>
  </section>`;
  $('[data-new]', main).onclick = () => openNewApplication();
  renderFilters();
  bindTable($('#d-table'), { onSort: key => { filters.sort = { key, dir: filters.sort.key === key ? -filters.sort.dir : 1 }; saveFilters(); refreshTable(); } });
  $('[data-reset]', main).onclick = () => { Object.assign(filters, structuredClone(defaults)); saveFilters(); renderFilters(); refreshAll(); };
  $('#d-cards').addEventListener('click', e => {
    const c = e.target.closest('[data-stage]');
    if (!c) return;
    const k = c.dataset.stage;
    filters.stage = filters.stage === k ? '' : k;
    // 終了系のカードを押したときは「すべて」に切り替えて見えるようにする
    if (['joined', 'closed'].includes(filters.stage) || filters.stage === 'all') filters.scope = 'all';
    saveFilters(); renderFilters(); refreshCards(); refreshTable();
    $('.table-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('#d-actions').addEventListener('click', onActionClick);
  $('#d-today').addEventListener('click', e => {
    const it = e.target.closest('[data-item]');
    if (it) { const item = todayItems.find(i => i.key === it.dataset.item); if (item) showItem(item); }
    const tab = e.target.closest('[data-day]');
    if (tab) { todayTab = tab.dataset.day; refreshToday(); }
  });
  refreshAll();
  return { refresh: refreshAll };
}

function refreshAll() {
  if (!$('#d-filters')?.contains(document.activeElement)) renderFilters();
  refreshCards(); refreshActions(); refreshToday(); refreshTable();
}

function refreshCards() {
  const c = stageCounts();
  $('#d-cards').innerHTML = DASH_CARDS.map(d => `<button class="stat-card c-${d.color} ${filters.stage === d.key ? 'active' : ''}" data-stage="${d.key}">
    <span class="sc-icon">${icon(d.icon)}</span><span class="sc-label">${esc(d.label)}</span><b>${c[d.key] || 0}<small>件</small></b></button>`).join('');
}

let actionCache = {};
function refreshActions() {
  const g = actionItems();
  actionCache = g;
  const total = Object.values(g).reduce((n, x) => n + x.items.length, 0);
  const reds = Object.values(g).reduce((n, x) => n + x.items.filter(i => i.level === 'red').length, 0);
  $('#d-actions').innerHTML = `<div class="panel-head"><div>${icon('bell')}<h3>対応が必要な案件</h3><span class="count ${reds ? 'red' : ''}">${total}件${reds ? `（至急 ${reds}）` : ''}</span></div>
    <div class="ph-actions"><span class="legend"><i class="lv red"></i>至急<i class="lv orange"></i>近い<i class="lv yellow"></i>注意</span><button class="btn sm ghost" data-collapse>${icon('chevD')}${collapsed ? '開く' : '折りたたむ'}</button></div></div>
    <div class="action-grid">${Object.entries(g).map(([k, grp]) => `<div class="action-group ag-${k}">
      <h4>${icon(grp.icon)}${esc(grp.label)}<span class="n ${grp.items.some(i => i.level === 'red') ? 'hot' : grp.items.length ? 'on' : ''}">${grp.items.length}</span></h4>
      ${grp.items.length ? `<ul>${grp.items.map((it, i) => `<li class="lv-${it.level}" data-act="${k}:${i}">
        <div class="ai-main"><b>${esc(it.title)}</b><small>${esc(it.sub)}</small></div>
        ${it.ca ? `<span class="ca-pill sm">${esc(it.ca)}</span>` : ''}
        ${it.remind ? `<button class="btn xs" data-remind-done="${k}:${i}" title="CAに連絡したらチェック">${icon('check')}済にする</button>` : ''}</li>`).join('')}</ul>` : '<p class="ok-msg">✓ ありません</p>'}
    </div>`).join('')}</div>`;
  $('.dash-grid').classList.toggle('collapsed', collapsed);
}
async function onActionClick(e) {
  if (e.target.closest('[data-collapse]')) { collapsed = !collapsed; localStorage.setItem('ra-actions-collapsed', collapsed ? '1' : '0'); return refreshActions(); }
  const done = e.target.closest('[data-remind-done]');
  if (done) {
    const [k, i] = done.dataset.remindDone.split(':');
    const it = actionCache[k].items[+i];
    await store.patch(it.ev.id, { reminded: true, remindedDate: today() });
    return toast(`${it.title}：リマインド済みにしました`);
  }
  const li = e.target.closest('[data-act]');
  if (!li) return;
  const [k, i] = li.dataset.act.split(':');
  const it = actionCache[k].items[+i];
  if (it.ev) openEvent({ id: it.ev.id });
  else if (it.app) openApplication(it.app.id);
}

let todayTab = 'today';
let todayItems = [];
function refreshToday() {
  const t = today();
  const day = todayTab === 'today' ? t : addDays(t, 1);
  todayItems = calendarItems().filter(i => i.date === day);
  const tomorrowN = calendarItems().filter(i => i.date === addDays(t, 1)).length;
  const todayN = todayTab === 'today' ? todayItems.length : calendarItems().filter(i => i.date === t).length;
  $('#d-today').innerHTML = `<div class="panel-head"><div>${icon('clock')}<h3>今日・明日の予定</h3></div>
    <div class="seg"><button class="${todayTab === 'today' ? 'on' : ''}" data-day="today">今日 ${todayN}</button><button class="${todayTab === 'tomorrow' ? 'on' : ''}" data-day="tomorrow">明日 ${tomorrowN}</button></div></div>
    <p class="today-date">${esc(fmtDate(day, { year: true }))}</p>
    ${todayItems.length ? `<ul class="timeline">${todayItems.map(i => `<li data-item="${esc(i.key)}" class="t-${EVENT_TYPES[i.type].color} ${i.cancelled ? 'cancel' : ''} ${i.done ? 'done' : ''}">
      <time>${esc(i.start || '終日')}${i.end ? `<small>〜${esc(i.end)}</small>` : ''}</time>
      <div><span class="type-tag t-${EVENT_TYPES[i.type].color}">${esc(EVENT_TYPES[i.type].label)}</span><b>${esc(i.title)}</b><small>${esc(i.sub)}${i.ev?.format ? '・' + esc(i.ev.format) : ''}${i.cand?.caId ? '・CA ' + esc(store.getAny(i.cand.caId)?.name || '') : ''}</small></div>
      ${i.ev && ['interview', 'offer', 'followup'].includes(i.type) ? `<span class="tag ${i.ev.reminded ? 'st-green' : 'st-red'}">${i.ev.reminded ? 'リマインド済' : 'リマインド未'}</span>` : ''}</li>`).join('')}</ul>`
      : `<div class="empty-small">${icon('coffee')}<p>予定はありません</p></div>`}
    <a class="more-link" href="#/calendar">カレンダーで見る ${icon('chevR')}</a>`;
}

function renderFilters() {
  const box = $('#d-filters');
  const f = filters;
  box.innerHTML = `
    <label class="search">${icon('search')}<input type="search" data-f="q" value="${esc(f.q)}" placeholder="求職者名・企業名・CA名で検索"></label>
    <select data-f="ca" aria-label="CA">${opts(caOptions(), f.ca, { empty: '全CA' })}</select>
    <select data-f="company" aria-label="企業">${opts(companyOptions(), f.company, { empty: '全企業' })}</select>
    <select data-f="status" aria-label="ステータス">${opts(statusOptions(), f.status, { empty: '全ステータス' })}</select>
    <select data-f="period" aria-label="面接予定日">${opts([['today', '面接：今日'], ['tomorrow', '面接：明日'], ['week', '面接：今週'], ['nextweek', '面接：来週'], ['upcoming', '面接：今後すべて'], ['date', '面接：日付指定']], f.period, { empty: '面接予定日：すべて' })}</select>
    ${f.period === 'date' ? `<input type="date" data-f="periodDate" value="${esc(f.periodDate)}">` : ''}
    <select data-f="deadline" aria-label="内定承諾期限">${opts([['overdue', '承諾期限：期限切れ'], ['3', '承諾期限：3日以内'], ['7', '承諾期限：7日以内'], ['has', '承諾期限：設定あり']], f.deadline, { empty: '承諾期限：すべて' })}</select>
    <div class="seg scope">${[['active', '対応中'], ['closed', '終了済み'], ['all', 'すべて']].map(([v, l]) => `<button class="${f.scope === v ? 'on' : ''}" data-scope="${v}">${l}</button>`).join('')}</div>
    ${f.stage ? `<span class="chip on">カード：${esc(DASH_CARDS.find(c => c.key === f.stage)?.label || '')}<button data-clear-stage aria-label="解除">${icon('x')}</button></span>` : ''}`;
  box.oninput = e => {
    const k = e.target.dataset.f;
    if (!k) return;
    filters[k] = e.target.value;
    saveFilters();
    if (k === 'period') renderFilters();
    refreshTable();
  };
  box.onclick = e => {
    const s = e.target.closest('[data-scope]');
    if (s) { filters.scope = s.dataset.scope; saveFilters(); renderFilters(); refreshTable(); }
    if (e.target.closest('[data-clear-stage]')) { filters.stage = ''; saveFilters(); renderFilters(); refreshCards(); refreshTable(); }
  };
}

function refreshTable() {
  const box = $('#d-table');
  if (!box) return;
  const scroller = $('.table-wrap', box);
  const pos = scroller ? [scroller.scrollLeft, scroller.scrollTop] : null;
  const rows = sortRows(filterApps(), filters.sort);
  box.innerHTML = tableHTML(rows, { sort: filters.sort, emptyText: applications().length ? '条件に合う応募はありません' : 'まだ応募が登録されていません。「新規応募登録」から追加してください' });
  if (pos) { const s = $('.table-wrap', box); s.scrollLeft = pos[0]; s.scrollTop = pos[1]; }
  $('#d-count').textContent = `${rows.length}件 / 全${applications().length}件`;
}
