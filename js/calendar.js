// 月間カレンダー
import { store } from './store.js';
import { calendarItems, EVENT_TYPES, today, ymd, parseYmd, fmtDate, fmtDateTime, nameOf, appRow, fmtTimeRange } from './model.js';
import { esc, $, icon, openModal, toast, opts, confirmDialog } from './ui.js';
import { openEvent, openAppDate, openApplication, caOptions, companyOptions, removeRecord } from './forms.js';

const CKEY = 'ra-calendar';
const st = { month: today().slice(0, 7), sel: today(), ca: '', company: '', types: Object.keys(EVENT_TYPES), ...JSON.parse(localStorage.getItem(CKEY) || '{}') };
const saveSt = () => localStorage.setItem(CKEY, JSON.stringify({ ca: st.ca, company: st.company, types: st.types }));
const MAX_IN_CELL = 3;

export function renderCalendar(main, params = {}) {
  if (params.date) { st.sel = params.date; st.month = params.date.slice(0, 7); }
  main.innerHTML = `<header class="page-head">
      <div><p class="eyebrow">${icon('calendar')}CALENDAR</p><h1>カレンダー</h1><p class="muted">面接・面談・内定承諾期限・入社日がまとめて表示されます。日付をクリックするとその日の予定を時刻順に表示します</p></div>
      <div class="head-actions"><button class="btn primary" data-add>${icon('plus')}予定を追加</button></div></header>
    <div class="cal-layout">
      <section class="panel cal-panel">
        <div class="cal-toolbar">
          <div class="cal-nav"><button class="icon-btn" data-mv="-1" aria-label="前の月">${icon('chevL')}</button><h2 id="c-title"></h2><button class="icon-btn" data-mv="1" aria-label="次の月">${icon('chevR')}</button><button class="btn sm" data-today>今日</button></div>
          <div class="cal-filters"><select data-cf="ca">${opts(caOptions(), st.ca, { empty: '全CA' })}</select><select data-cf="company">${opts(companyOptions(), st.company, { empty: '全企業' })}</select></div>
        </div>
        <div class="type-toggles">${Object.entries(EVENT_TYPES).map(([k, t]) => `<label class="type-toggle t-${t.color}"><input type="checkbox" data-type="${k}" ${st.types.includes(k) ? 'checked' : ''}><span>${esc(t.label)}</span></label>`).join('')}</div>
        <div class="cal-grid" id="c-grid"></div>
      </section>
      <aside class="panel day-panel" id="c-day"></aside>
    </div>`;
  main.querySelector('.cal-toolbar').addEventListener('click', e => {
    const mv = e.target.closest('[data-mv]');
    if (mv) { const d = parseYmd(st.month + '-01'); d.setMonth(d.getMonth() + +mv.dataset.mv); st.month = ymd(d).slice(0, 7); refresh(); }
    if (e.target.closest('[data-today]')) { st.month = today().slice(0, 7); st.sel = today(); refresh(); }
  });
  main.querySelector('.cal-filters').addEventListener('change', e => { st[e.target.dataset.cf] = e.target.value; saveSt(); refresh(); });
  main.querySelector('.type-toggles').addEventListener('change', e => {
    const k = e.target.dataset.type;
    st.types = e.target.checked ? [...st.types, k] : st.types.filter(x => x !== k);
    saveSt(); refresh();
  });
  $('[data-add]', main).onclick = () => openEvent({ date: st.sel });
  $('#c-grid').addEventListener('click', e => {
    const chip = e.target.closest('[data-item]');
    if (chip) { const it = items.find(i => i.key === chip.dataset.item); if (it) return showItem(it); }
    const cell = e.target.closest('[data-date]');
    if (cell) { st.sel = cell.dataset.date; refresh(); if (window.innerWidth < 900) $('#c-day').scrollIntoView({ behavior: 'smooth' }); }
  });
  $('#c-day').addEventListener('click', e => {
    const it = e.target.closest('[data-item]');
    if (it) { const item = items.find(i => i.key === it.dataset.item); if (item) showItem(item); }
    if (e.target.closest('[data-add-day]')) openEvent({ date: st.sel });
  });
  refresh();
  return { refresh };
}

let items = [];
function refresh() {
  items = calendarItems({ caId: st.ca, companyId: st.company, types: st.types });
  const byDate = {};
  items.forEach(i => (byDate[i.date] ||= []).push(i));
  const [y, m] = st.month.split('-').map(Number);
  $('#c-title').textContent = `${y}年 ${m}月`;
  const first = new Date(y, m - 1, 1);
  const start = new Date(first); start.setDate(1 - first.getDay());
  const t = today();
  let html = ['日', '月', '火', '水', '木', '金', '土'].map((w, i) => `<div class="cal-wd ${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}">${w}</div>`).join('');
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const ds = ymd(d);
    if (i >= 35 && d.getMonth() !== m - 1) break;
    const list = byDate[ds] || [];
    const hasRed = list.some(x => x.type === 'deadline');
    html += `<div class="cal-cell ${d.getMonth() !== m - 1 ? 'other' : ''} ${ds === t ? 'today' : ''} ${ds === st.sel ? 'sel' : ''} ${d.getDay() === 0 ? 'sun' : d.getDay() === 6 ? 'sat' : ''} ${hasRed ? 'has-deadline' : ''}" data-date="${ds}">
      <span class="cd">${d.getDate()}</span>
      ${list.slice(0, MAX_IN_CELL).map(x => chip(x)).join('')}
      ${list.length > MAX_IN_CELL ? `<span class="more">＋${list.length - MAX_IN_CELL}件</span>` : ''}
      <span class="dots">${list.slice(0, 6).map(x => `<i class="t-${EVENT_TYPES[x.type].color}"></i>`).join('')}</span>
    </div>`;
  }
  $('#c-grid').innerHTML = html;
  const day = byDate[st.sel] || [];
  $('#c-day').innerHTML = `<div class="panel-head"><div>${icon('clock')}<h3>${esc(fmtDate(st.sel, { year: true }))}の予定</h3><span class="count">${day.length}件</span></div>
      <button class="btn sm" data-add-day>${icon('plus')}追加</button></div>
    ${day.length ? `<ul class="timeline">${day.map(i => `<li data-item="${esc(i.key)}" class="t-${EVENT_TYPES[i.type].color} ${i.cancelled ? 'cancel' : ''} ${i.done ? 'done' : ''}">
      <time>${esc(i.start || '終日')}${i.end ? `<small>〜${esc(i.end)}</small>` : ''}</time>
      <div><span class="type-tag t-${EVENT_TYPES[i.type].color}">${esc(EVENT_TYPES[i.type].label)}</span><b>${esc(i.title)}</b><small>${esc(i.sub)}${i.ev?.format ? '・' + esc(i.ev.format) : ''}${i.cand?.caId ? '・CA ' + esc(nameOf(i.cand.caId)) : ''}</small></div></li>`).join('')}</ul>`
      : `<div class="empty-small">${icon('coffee')}<p>この日の予定はありません</p></div>`}`;
}
const chip = x => `<button class="cal-chip t-${EVENT_TYPES[x.type].color} ${x.cancelled ? 'cancel' : ''} ${x.done ? 'done' : ''}" data-item="${esc(x.key)}" title="${esc(EVENT_TYPES[x.type].label + ' ' + x.title)}">${x.start ? `<i>${esc(x.start)}</i>` : ''}${esc(x.cand?.name || x.title)}<em>${esc(x.type === 'interview' ? x.ev.round || '面接' : EVENT_TYPES[x.type].label)}</em></button>`;

// 予定の詳細（カレンダー・トップページ共通）
export function showItem(it) {
  const t = EVENT_TYPES[it.type];
  const r = it.app ? appRow(it.app) : null;
  const ev = it.ev;
  const rows = [
    ['種類', t.label + (ev?.round ? `（${ev.round}）` : '')],
    ['日時', it.type === 'deadline' ? fmtDateTime(it.app.acceptDeadline) : `${fmtDate(it.date, { year: true })} ${ev ? fmtTimeRange(ev) : ''}`],
    ['求職者', it.cand?.name || ''],
    ['担当CA', nameOf(it.cand?.caId)],
    ['応募企業', r?.companyName || ''],
    ['選考ステータス', r?.statusName || ''],
    ev?.format && ['形式', ev.format],
    ev?.result && ['結果', ev.result],
    ev?.state && ['状態', ev.state],
    ev && ['interview', 'offer', 'followup'].includes(ev.type) && ['CAリマインド', ev.reminded ? `済み${ev.remindedDate ? '（' + fmtDate(ev.remindedDate) + '）' : ''}` : '未対応'],
    it.type === 'action' && ['対応内容', it.app.nextActionNote || ''],
    r?.app.joinDate && ['入社予定日', fmtDate(r.app.joinDate, { year: true })],
    ev?.memo && ['メモ', ev.memo],
    ev?.nextDate && ['次回面談予定日', fmtDate(ev.nextDate, { year: true })],
  ].filter(x => x && x[1]);
  const m = openModal({ title: it.title, sub: t.label, icon: t.icon, body: `<dl class="detail-list">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`,
    foot: `<button class="btn danger ghost" data-del>${icon('trash')}削除</button><span class="grow"></span>
      ${ev && ['interview', 'offer', 'followup'].includes(ev.type) ? `<button class="btn" data-remind>${icon(ev.reminded ? 'x' : 'check')}${ev.reminded ? 'リマインド未に戻す' : 'リマインド済にする'}</button>` : ''}
      ${it.cand ? `<a class="btn" href="#/candidate/${esc(it.cand.id)}" data-close>${icon('user')}求職者ページ</a>` : ''}
      ${it.app ? `<button class="btn" data-app>${icon('file')}応募詳細</button>` : ''}
      <button class="btn primary" data-edit>${icon('edit')}編集</button>` });
  $('[data-edit]', m.el).onclick = () => { m.close(); ev ? openEvent({ id: ev.id }) : openAppDate({ type: it.type, applicationId: it.app.id }); };
  $('[data-app]', m.el)?.addEventListener('click', () => { m.close(); openApplication(it.app.id); });
  $('[data-remind]', m.el)?.addEventListener('click', async () => { await store.patch(ev.id, { reminded: !ev.reminded, remindedDate: ev.reminded ? '' : today() }); m.close(); toast('リマインド状況を更新しました'); });
  $('[data-del]', m.el).onclick = async () => {
    if (ev) { if (await removeRecord(ev)) m.close(); return; }
    const field = it.field;
    if (!await confirmDialog(`${t.label}（${fmtDate(it.date)}）を削除しますか？`, { detail: '応募そのものは削除されません' })) return;
    await store.patch(it.app.id, field === 'nextActionDate' ? { nextActionDate: '', nextActionNote: '' } : { [field]: '' });
    m.close(); toast(`${t.label}を削除しました`);
  };
}
