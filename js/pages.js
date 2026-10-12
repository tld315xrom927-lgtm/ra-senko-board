// CA・求職者・企業・定期面談の各ページ
import { store } from './store.js';
import {
  applications, appRow, caStats, isClosed, stageOf, statusColor, statusOf, nameOf, eventsFor, events, calendarItems,
  fmtDate, fmtTimeRange, today, addDays, candidateActive, EVENT_TYPES, FOLLOWUP_STATES, nextUpcoming,
} from './model.js';
import { esc, $, icon, toast, opts, openPopover } from './ui.js';
import { tableHTML, sortRows, bindTable } from './table.js';
import {
  openNewApplication, openCA, openCandidate, openCompany, openEvent, removeRecord, eventListBlock, onEventListClick,
  caOptions, eventLine,
} from './forms.js';
import { showItem } from './calendar.js';

const byName = (a, b) => (a.name || '').localeCompare(b.name || '', 'ja');
const head = (eyebrow, ic, title, desc, actions = '') => `<header class="page-head"><div><p class="eyebrow">${icon(ic)}${eyebrow}</p><h1>${esc(title)}</h1>${desc ? `<p class="muted">${desc}</p>` : ''}</div><div class="head-actions">${actions}</div></header>`;
const notFound = (main, what) => { main.innerHTML = `<div class="empty-page">${icon('alert')}<h2>${what}が見つかりません</h2><p>削除された可能性があります（設定 → ゴミ箱 から復元できます）</p><a class="btn" href="#/">トップへ戻る</a></div>`; return { refresh() {} }; };
const statusChip = app => { const s = statusOf(app); return `<span class="tag st-${statusColor(s)}">${esc(s?.name || '未設定')}</span>`; };

// 一覧テーブル（並び替え付き）を描くヘルパー
function appTable(box, getRows, { hide = [], key }) {
  const sk = 'ra-sort:' + key;
  let sort = JSON.parse(localStorage.getItem(sk) || 'null') || { key: 'nextAction', dir: 1 };
  const draw = () => {
    const s = $('.table-wrap', box);
    const pos = s ? s.scrollLeft : 0;
    box.innerHTML = tableHTML(sortRows(getRows(), sort), { sort, hide });
    $('.table-wrap', box).scrollLeft = pos;
  };
  bindTable(box, { onSort: k => { sort = { key: k, dir: sort.key === k ? -sort.dir : 1 }; localStorage.setItem(sk, JSON.stringify(sort)); draw(); } });
  draw();
  return draw;
}

// ===================== CA一覧 =====================
export function renderCAList(main) {
  const draw = () => {
    const cas = store.list('ca').sort(byName);
    main.innerHTML = head('CAREER ADVISORS', 'users', 'CA一覧', 'CAをクリックすると個人ページ（担当求職者・選考状況）を表示します', `<button class="btn primary" data-add>${icon('plus')}CAを追加</button>`)
      + `<div class="card-grid">${cas.map(c => { const s = caStats(c.id); return `<a class="person-card" href="#/ca/${esc(c.id)}">
        <span class="avatar">${esc((c.name || '?').slice(0, 1))}</span><div class="pc-main"><b>${esc(c.name)}</b><small>${esc(c.contact || '連絡先未登録')}</small></div>
        <div class="pc-stats"><span><b>${s.candidates}</b>担当求職者</span><span><b>${s.active}</b>選考中</span><span><b>${s.joined}</b>入社決定</span></div></a>`; }).join('') || '<p class="muted">CAが登録されていません</p>'}</div>`;
    $('[data-add]', main).onclick = () => openCA();
  };
  draw();
  return { refresh: draw };
}

// ===================== CA個人ページ =====================
export function renderCAPage(main, { id }) {
  let tab = sessionStorage.getItem('ra-ca-tab') || 'active';
  const ca0 = store.get(id);
  if (!ca0) return notFound(main, 'CA');
  main.innerHTML = `<div id="ca-head"></div>
    <div class="ca-layout"><section class="panel table-panel"><div class="panel-head"><div class="tabs" id="ca-tabs"></div><button class="btn sm" data-new>${icon('plus')}新規応募</button></div><div id="ca-table"></div></section>
    <aside class="panel" id="ca-upcoming"></aside></div>`;
  const rows = () => applications().map(appRow).filter(r => r.caId === id && (tab === 'active' ? !isClosed(r.app) : isClosed(r.app)));
  const drawTable = appTable($('#ca-table'), rows, { hide: ['ca'], key: 'ca' });
  $('[data-new]', main).onclick = () => openNewApplication({ caName: store.get(id)?.name });
  $('#ca-tabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) { tab = b.dataset.tab; sessionStorage.setItem('ra-ca-tab', tab); draw(); } };
  $('#ca-upcoming').onclick = e => { const it = e.target.closest('[data-item]'); if (it) showItem(upcoming.find(x => x.key === it.dataset.item)); };
  let upcoming = [];
  const draw = () => {
    const ca = store.get(id);
    if (!ca) return notFound(main, 'CA');
    const s = caStats(id);
    const all = applications().map(appRow).filter(r => r.caId === id);
    $('#ca-head').innerHTML = head('CA PAGE', 'user', `${ca.name}さんのページ`, esc(ca.contact || ''), `<button class="btn" data-edit>${icon('edit')}CA情報を編集</button>`)
      + `<div class="mini-stats"><div><span>担当求職者</span><b>${s.candidates}<small>名</small></b></div><div><span>選考中の応募</span><b>${s.active}<small>件</small></b></div><div><span>入社決定（承諾〜入社済み）</span><b>${s.joined}<small>件</small></b></div><div><span>リマインド未対応</span><b class="red">${events().filter(e => !e.reminded && e.date >= today() && ['followup', 'interview', 'offer'].includes(e.type) && store.getAny(e.candidateId)?.caId === id && e.state !== 'キャンセル' && e.state !== '完了' && e.result !== 'キャンセル').length}<small>件</small></b></div></div>`;
    $('[data-edit]', main).onclick = () => openCA(id);
    $('#ca-tabs').innerHTML = [['active', '対応中の求職者', all.filter(r => !isClosed(r.app)).length], ['past', '過去の求職者', all.filter(r => isClosed(r.app)).length]]
      .map(([k, l, n]) => `<button class="tab ${tab === k ? 'on' : ''}" data-tab="${k}">${l}<span>${n}</span></button>`).join('');
    drawTable();
    upcoming = calendarItems({ caId: id }).filter(i => i.date >= today() && i.date <= addDays(today(), 14) && !i.cancelled);
    $('#ca-upcoming').innerHTML = `<div class="panel-head"><div>${icon('calendar')}<h3>今後2週間の予定</h3><span class="count">${upcoming.length}件</span></div></div>
      ${upcoming.length ? `<ul class="timeline compact">${upcoming.map(i => `<li data-item="${esc(i.key)}" class="t-${EVENT_TYPES[i.type].color}"><time>${esc(fmtDate(i.date))}<small>${esc(i.start)}</small></time><div><span class="type-tag t-${EVENT_TYPES[i.type].color}">${esc(EVENT_TYPES[i.type].label)}</span><b>${esc(i.title)}</b>${i.ev && ['interview', 'offer', 'followup'].includes(i.type) ? `<small class="${i.ev.reminded ? 'ok' : 'ng'}">${i.ev.reminded ? '✓ リマインド済' : '● リマインド未'}</small>` : ''}</div></li>`).join('')}</ul>` : `<div class="empty-small">${icon('coffee')}<p>予定はありません</p></div>`}`;
  };
  draw();
  return { refresh: draw };
}

// ===================== 求職者一覧 =====================
export function renderCandidates(main) {
  const f = JSON.parse(sessionStorage.getItem('ra-cand-f') || '{"q":"","ca":"","scope":"active"}');
  main.innerHTML = head('CANDIDATES', 'user', '求職者一覧', '同じ求職者が複数企業に応募していても、応募ごとに選考状況を管理できます', `<button class="btn" data-add>${icon('plus')}求職者だけ追加</button><button class="btn primary" data-new>${icon('plus')}新規応募登録</button>`)
    + `<section class="panel"><div class="filter-bar"><label class="search">${icon('search')}<input type="search" data-f="q" placeholder="求職者名で検索" value="${esc(f.q)}"></label>
      <select data-f="ca">${opts(caOptions(), f.ca, { empty: '全CA' })}</select>
      <div class="seg">${[['active', '対応中'], ['past', '過去'], ['all', 'すべて']].map(([v, l]) => `<button data-scope="${v}" class="${f.scope === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div id="cand-list"></div></section>`;
  $('[data-add]', main).onclick = () => openCandidate();
  $('[data-new]', main).onclick = () => openNewApplication();
  const bar = $('.filter-bar', main);
  bar.oninput = e => { if (e.target.dataset.f) { f[e.target.dataset.f] = e.target.value; save(); draw(); } };
  bar.onclick = e => { const b = e.target.closest('[data-scope]'); if (b) { f.scope = b.dataset.scope; bar.querySelectorAll('[data-scope]').forEach(x => x.classList.toggle('on', x === b)); save(); draw(); } };
  const save = () => sessionStorage.setItem('ra-cand-f', JSON.stringify(f));
  const draw = () => {
    const q = f.q.trim().toLowerCase();
    const list = store.list('candidate').sort((a, b) => (a.kana || a.name).localeCompare(b.kana || b.name, 'ja')).filter(c => {
      if (f.ca && c.caId !== f.ca) return false;
      if (q && !(c.name + (c.kana || '')).toLowerCase().includes(q)) return false;
      const act = candidateActive(c);
      return f.scope === 'all' || (f.scope === 'active' ? act : !act);
    });
    $('#cand-list').innerHTML = `<div class="table-wrap"><table class="simple-table"><thead><tr><th>求職者名</th><th>担当CA</th><th>応募先と選考状況</th><th>入社予定日</th><th>次回定期面談</th><th>備考</th><th>更新</th></tr></thead><tbody>
      ${list.map(c => {
        const apps = applications().filter(a => a.candidateId === c.id);
        const join = apps.map(a => a.joinDate).filter(Boolean).sort()[0];
        const fu = nextUpcoming(eventsFor({ candidateId: c.id, type: 'followup' }));
        return `<tr data-href="#/candidate/${esc(c.id)}"><td><a class="name-link" href="#/candidate/${esc(c.id)}">${esc(c.name)}</a>${c.kana ? `<small class="muted block">${esc(c.kana)}</small>` : ''}</td>
          <td>${c.caId ? `<span class="ca-pill">${esc(nameOf(c.caId))}</span>` : '<span class="muted">未設定</span>'}</td>
          <td><div class="app-chips">${apps.map(a => `<span class="app-chip">${esc(nameOf(a.companyId))}${statusChip(a)}</span>`).join('') || '<span class="muted small">応募なし</span>'}</div></td>
          <td>${join ? esc(fmtDate(join, { year: true })) : ''}</td><td>${fu ? esc(fmtDate(fu.date) + ' ' + fmtTimeRange(fu)) : ''}</td>
          <td class="memo"><span class="ell2">${esc(c.memo || '')}</span></td><td class="muted small">${esc(new Date(c.updatedAt).toLocaleDateString('ja-JP'))}</td></tr>`;
      }).join('') || '<tr><td colspan="7" class="empty-row">該当する求職者はいません</td></tr>'}</tbody></table></div>`;
  };
  $('#cand-list').onclick = e => { const tr = e.target.closest('tr[data-href]'); if (tr && !e.target.closest('a')) location.hash = tr.dataset.href; };
  draw();
  return { refresh: draw };
}

// ===================== 求職者詳細 =====================
export function renderCandidatePage(main, { id }) {
  if (!store.get(id)) return notFound(main, '求職者');
  main.innerHTML = `<div id="cp-head"></div><section class="panel table-panel"><div class="panel-head"><div>${icon('building')}<h3>応募先ごとの選考状況</h3><span class="count" id="cp-n"></span></div><button class="btn sm" data-new>${icon('plus')}この求職者で応募を追加</button></div><div id="cp-table"></div></section>
    <div class="two-col"><section class="panel" id="cp-follow"></section><section class="panel" id="cp-history"></section></div>`;
  const rows = () => applications().map(appRow).filter(r => r.app.candidateId === id);
  const drawTable = appTable($('#cp-table'), rows, { hide: ['cand'], key: 'cand' });
  $('[data-new]', main).onclick = () => { const c = store.get(id); openNewApplication({ candName: c?.name, caName: nameOf(c?.caId) }); };
  $('#cp-follow').addEventListener('click', onEventListClick);
  $('#cp-history').addEventListener('click', onEventListClick);
  const draw = () => {
    const c = store.get(id);
    if (!c) return notFound(main, '求職者');
    const apps = rows();
    $('#cp-head').innerHTML = head('CANDIDATE', 'user', `${c.name}さん`, `${c.kana ? esc(c.kana) + '　' : ''}担当CA：${c.caId ? `<a href="#/ca/${esc(c.caId)}">${esc(nameOf(c.caId))}</a>` : '未設定'}${c.contact ? '　連絡先：' + esc(c.contact) : ''}`,
      `<button class="btn danger ghost" data-del>${icon('trash')}削除</button><button class="btn" data-edit>${icon('edit')}求職者情報を編集</button>`)
      + (c.memo ? `<p class="memo-box">${icon('edit')}${esc(c.memo)}</p>` : '');
    $('[data-edit]', main).onclick = () => openCandidate(id);
    $('[data-del]', main).onclick = async () => { if (await removeRecord(store.get(id))) location.hash = '#/candidates'; };
    $('#cp-n').textContent = `${apps.length}社`;
    drawTable();
    $('#cp-follow').innerHTML = `<div class="panel-head"><div>${icon('coffee')}<h3>定期面談（内定承諾後〜入社）</h3></div></div><div class="pad">${eventListBlock('定期面談', 'followup', eventsFor({ candidateId: id, type: 'followup' }), { candidateId: id })}</div>`;
    const hist = events().filter(e => e.candidateId === id && e.type !== 'followup').sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    $('#cp-history').innerHTML = `<div class="panel-head"><div>${icon('clock')}<h3>面接・面談の履歴</h3><span class="count">${hist.length}件</span></div></div>
      <div class="pad">${hist.length ? `<ul class="sched-list">${hist.map(e => eventLine(e).replace('<b>', `<span class="tag">${esc(nameOf(store.getAny(e.applicationId)?.companyId))}</span><b>`)).join('')}</ul>` : '<p class="muted small">まだありません。一覧の「面接日時」セルから登録できます</p>'}</div>`;
  };
  draw();
  return { refresh: draw };
}

// ===================== 企業一覧・詳細 =====================
export function renderCompanies(main) {
  const draw = () => {
    const list = store.list('company').sort(byName);
    main.innerHTML = head('COMPANIES', 'building', '企業一覧', '自社が直接契約している企業と、応募者の選考状況', `<button class="btn primary" data-add>${icon('plus')}企業を追加</button>`)
      + `<section class="panel"><div class="table-wrap"><table class="simple-table"><thead><tr><th>企業名</th><th>担当者名</th><th>連絡先</th><th>応募者数</th><th>選考状況</th><th>備考</th></tr></thead><tbody>
      ${list.map(c => {
        const apps = applications().filter(a => a.companyId === c.id);
        const act = apps.filter(a => !isClosed(a));
        return `<tr data-href="#/company/${esc(c.id)}"><td><a class="name-link" href="#/company/${esc(c.id)}">${esc(c.name)}</a></td><td>${esc(c.contactName || '')}</td><td>${esc(c.contact || '')}</td>
          <td><b>${apps.length}</b><small class="muted">（選考中 ${act.length}）</small></td>
          <td><div class="app-chips">${act.slice(0, 6).map(a => `<span class="app-chip">${esc(nameOf(store.getAny(a.candidateId)?.id))}${statusChip(a)}</span>`).join('')}${act.length > 6 ? `<span class="muted small">他${act.length - 6}件</span>` : ''}</div></td>
          <td class="memo"><span class="ell2">${esc(c.memo || '')}</span></td></tr>`;
      }).join('') || '<tr><td colspan="6" class="empty-row">企業が登録されていません</td></tr>'}</tbody></table></div></section>`;
    $('[data-add]', main).onclick = () => openCompany();
    $('tbody', main).onclick = e => { const tr = e.target.closest('tr[data-href]'); if (tr && !e.target.closest('a')) location.hash = tr.dataset.href; };
  };
  draw();
  return { refresh: draw };
}
export function renderCompanyPage(main, { id }) {
  if (!store.get(id)) return notFound(main, '企業');
  let scope = 'active';
  main.innerHTML = `<div id="co-head"></div><section class="panel table-panel"><div class="panel-head"><div class="tabs" id="co-tabs"></div><button class="btn sm" data-new>${icon('plus')}この企業への応募を追加</button></div><div id="co-table"></div></section>`;
  const rows = () => applications().map(appRow).filter(r => r.app.companyId === id && (scope === 'all' || (scope === 'active' ? !isClosed(r.app) : isClosed(r.app))));
  const drawTable = appTable($('#co-table'), rows, { hide: ['company'], key: 'company' });
  $('[data-new]', main).onclick = () => openNewApplication({ companyName: store.get(id)?.name });
  $('#co-tabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) { scope = b.dataset.tab; draw(); } };
  const draw = () => {
    const c = store.get(id);
    if (!c) return notFound(main, '企業');
    const all = applications().filter(a => a.companyId === id);
    $('#co-head').innerHTML = head('COMPANY', 'building', c.name, [c.contactName && '担当：' + esc(c.contactName), c.contact && '連絡先：' + esc(c.contact)].filter(Boolean).join('　'),
      `<button class="btn danger ghost" data-del>${icon('trash')}削除</button><button class="btn" data-edit>${icon('edit')}企業情報を編集</button>`) + (c.memo ? `<p class="memo-box">${icon('edit')}${esc(c.memo)}</p>` : '');
    $('[data-edit]', main).onclick = () => openCompany(id);
    $('[data-del]', main).onclick = async () => { if (await removeRecord(store.get(id))) location.hash = '#/companies'; };
    $('#co-tabs').innerHTML = [['active', '選考中', all.filter(a => !isClosed(a)).length], ['past', '終了済み', all.filter(a => isClosed(a)).length], ['all', 'すべて', all.length]]
      .map(([k, l, n]) => `<button class="tab ${scope === k ? 'on' : ''}" data-tab="${k}">${l}<span>${n}</span></button>`).join('');
    drawTable();
  };
  draw();
  return { refresh: draw };
}

// ===================== 定期面談管理 =====================
export function renderFollowups(main) {
  const f = JSON.parse(sessionStorage.getItem('ra-fu-f') || '{"ca":"","state":"予定","unreminded":false}');
  main.innerHTML = head('FOLLOW-UP MEETINGS', 'coffee', '定期面談管理', '内定承諾後〜入社までの定期面談。CAへ連絡したら「リマインド済」にチェックしてください（未チェックはトップページに表示されます）', `<button class="btn primary" data-add>${icon('plus')}定期面談を追加</button>`)
    + `<div id="fu-need"></div><section class="panel"><div class="filter-bar"><select data-f="ca">${opts(caOptions(), f.ca, { empty: '全CA' })}</select>
      <select data-f="state">${opts([['予定', '予定のみ'], ['完了', '完了'], ['キャンセル', 'キャンセル'], ['', 'すべて']], f.state)}</select>
      <label class="check"><input type="checkbox" data-f="unreminded" ${f.unreminded ? 'checked' : ''}>リマインド未対応のみ</label></div><div id="fu-list"></div></section>`;
  $('[data-add]', main).onclick = () => openEvent({ type: 'followup' });
  $('.filter-bar', main).onchange = e => { const k = e.target.dataset.f; if (!k) return; f[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; sessionStorage.setItem('ra-fu-f', JSON.stringify(f)); draw(); };
  const draw = () => {
    const list = events().filter(e => e.type === 'followup').filter(e => {
      const c = store.getAny(e.candidateId);
      if (f.ca && c?.caId !== f.ca) return false;
      if (f.state && (e.state || '予定') !== f.state) return false;
      if (f.unreminded && e.reminded) return false;
      return true;
    }).sort((a, b) => ((a.date || '9') + (a.start || '')).localeCompare((b.date || '9') + (b.start || '')) * (f.state === '予定' ? 1 : -1));
    $('#fu-list').innerHTML = `<div class="table-wrap"><table class="simple-table fu-table"><thead><tr><th>面談予定日</th><th>時刻</th><th>求職者名</th><th>担当CA</th><th>入社予定日</th><th>形式</th><th>実施状況</th><th>CAへリマインド</th><th>リマインド実施日</th><th>面談メモ</th><th>次回面談予定日</th><th></th></tr></thead><tbody>
      ${list.map(e => {
        const c = store.getAny(e.candidateId);
        const join = applications().filter(a => a.candidateId === e.candidateId && ['accepted', 'joining', 'joined'].includes(stageOf(a))).map(a => a.joinDate).filter(Boolean)[0];
        const n = e.date ? Math.round((new Date(e.date) - new Date(today())) / 86400000) : null;
        return `<tr data-ev="${esc(e.id)}" class="${!e.reminded && (e.state || '予定') === '予定' && n !== null && n >= 0 ? (n <= 1 ? 'row-red' : n <= 3 ? 'row-orange' : '') : ''}">
          <td><b>${e.date ? esc(fmtDate(e.date, { year: true })) : '未定'}</b></td><td>${esc(fmtTimeRange(e))}</td>
          <td><a class="name-link" href="#/candidate/${esc(e.candidateId)}">${esc(c?.name || '')}</a></td><td>${c?.caId ? `<span class="ca-pill">${esc(nameOf(c.caId))}</span>` : ''}</td>
          <td>${join ? esc(fmtDate(join, { year: true })) : ''}</td><td>${esc(e.format || '')}</td>
          <td><select data-state>${opts(FOLLOWUP_STATES.map(s => [s, s]), e.state || '予定')}</select></td>
          <td><label class="check big"><input type="checkbox" data-reminded ${e.reminded ? 'checked' : ''}>${e.reminded ? '済' : '未'}</label></td>
          <td>${e.remindedDate ? esc(fmtDate(e.remindedDate)) : ''}</td><td class="memo edit" data-memo><span class="ell2">${esc(e.memo || '')}</span></td>
          <td>${e.nextDate ? esc(fmtDate(e.nextDate, { year: true })) : ''}</td><td><button class="icon-btn sm" data-open>${icon('edit')}</button></td></tr>`;
      }).join('') || '<tr><td colspan="12" class="empty-row">該当する定期面談はありません</td></tr>'}</tbody></table></div>`;
    // 内定承諾済み・入社待ちなのに今後の定期面談が入っていない求職者
    const need = [...new Set(applications().filter(a => ['accepted', 'joining'].includes(stageOf(a))).map(a => a.candidateId))]
      .filter(cid => !nextUpcoming(eventsFor({ candidateId: cid, type: 'followup' }))).map(cid => store.get(cid)).filter(Boolean);
    $('#fu-need').innerHTML = need.length ? `<div class="notice">${icon('alert')}<div><b>次回の定期面談が未登録の求職者（内定承諾済み・入社待ち）</b><div class="app-chips">${need.map(c => `<button class="app-chip btn-chip" data-need="${esc(c.id)}">${esc(c.name)}<small>${esc(nameOf(c.caId))}</small>${icon('plus')}</button>`).join('')}</div></div></div>` : '';
  };
  main.addEventListener('click', e => {
    const need = e.target.closest('[data-need]');
    if (need) return openEvent({ type: 'followup', candidateId: need.dataset.need });
    const tr = e.target.closest('tr[data-ev]');
    if (!tr) return;
    if (e.target.closest('[data-open]')) return openEvent({ id: tr.dataset.ev });
    const memo = e.target.closest('[data-memo]');
    if (memo) { const ev = store.get(tr.dataset.ev); openPopover(memo, { label: '面談メモ', type: 'textarea', value: ev.memo || '', onSave: v => store.patch(ev.id, { memo: v }).then(() => toast('保存しました')) }); }
  });
  main.addEventListener('change', async e => {
    const tr = e.target.closest('tr[data-ev]');
    if (!tr) return;
    if (e.target.matches('[data-state]')) { await store.patch(tr.dataset.ev, { state: e.target.value }); toast('実施状況を更新しました'); }
    if (e.target.matches('[data-reminded]')) { const on = e.target.checked; await store.patch(tr.dataset.ev, { reminded: on, remindedDate: on ? today() : '' }); toast(on ? 'リマインド済みにしました' : 'リマインド未対応に戻しました'); }
  });
  draw();
  return { refresh: draw };
}
