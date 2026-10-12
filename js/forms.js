// 入力フォーム（新規応募・応募詳細・予定・求職者・CA・企業）と削除処理
import { store } from './store.js';
import {
  statuses, nameOf, candidateOf, stageOf, eventsFor, appRow, childrenOf, today, fmtDate, fmtDateTime, fmtTimeRange,
  EVENT_TYPES, ROUNDS, INTERVIEW_RESULTS, FOLLOWUP_STATES, FORMATS_SIMPLE, FORMATS_FOLLOWUP, STAGES,
} from './model.js';
import { esc, $, $$, icon, openModal, confirmDialog, toast, formData, opts, draft } from './ui.js';

const byName = (a, b) => (a.name || '').localeCompare(b.name || '', 'ja');
export const caOptions = () => store.list('ca').sort(byName).map(c => [c.id, c.name]);
export const companyOptions = () => store.list('company').sort(byName).map(c => [c.id, c.name]);
export const candidateOptions = () => store.list('candidate').sort(byName).map(c => [c.id, c.name + (c.caId ? `（${nameOf(c.caId)}）` : '')]);
export const statusOptions = () => statuses().map(s => [s.id, s.name]);
export const appOptions = () => store.list('application').map(a => appRow(a)).sort((a, b) => a.candName.localeCompare(b.candName, 'ja'))
  .map(r => [r.app.id, `${r.candName}／${r.companyName}`]);

// 名前から既存レコードを探し、なければ新しく作る（入力の手間を減らすため）
async function idByName(kind, name, extra = {}) {
  name = (name || '').trim();
  if (!name) return '';
  const found = store.list(kind).filter(r => r.name === name);
  const hit = (extra.caId && found.find(r => r.caId === extra.caId)) || found[0];
  if (hit) return hit.id;
  return (await store.save(kind, { name, ...extra })).id;
}
const datalist = (id, list) => `<datalist id="${id}">${list.map(n => `<option value="${esc(n)}"></option>`).join('')}</datalist>`;
const field = (label, html, { cls = '', hint = '' } = {}) => `<label class="field ${cls}"><span>${label}</span>${html}${hint ? `<small>${hint}</small>` : ''}</label>`;
const saved = msg => toast(msg || '保存しました');

function draftNotice(root, key, onDiscard) {
  const n = document.createElement('div');
  n.className = 'draft-note';
  n.innerHTML = `${icon('edit')}<span>前回入力途中だった内容を復元しました</span><button type="button" class="btn sm ghost">破棄する</button>`;
  $('button', n).onclick = () => { draft.clear(key); n.remove(); onDiscard(); };
  root.prepend(n);
}

// ===================== 新規応募登録 =====================
export function openNewApplication(prefill = {}) {
  const key = 'new-app';
  const sts = statuses();
  const defSt = sts.find(s => s.name === '書類選考中')?.id || sts[0]?.id;
  const m = openModal({
    title: '新規応募登録', sub: '必須は「求職者名」と「応募企業」だけです。同じ求職者で複数企業もまとめて登録できます', icon: 'plus', wide: true,
    body: `<form class="fields" autocomplete="off">
      ${field('求職者名 <em>必須</em>', `<input name="candName" list="dl-cand" placeholder="例）山田 花子" value="${esc(prefill.candName || '')}">`, { hint: '登録済みの求職者は候補から選べます。新しい名前なら自動で登録されます' })}
      ${field('担当CA', `<input name="caName" list="dl-ca" placeholder="例）佐藤" value="${esc(prefill.caName || '')}">`, { hint: '新しいCA名なら自動で登録されます' })}
      ${field('応募企業 <em>必須</em>', `<div class="chips-input"><div class="chips"></div><input name="companyInput" list="dl-company" placeholder="企業名を入力してEnter（複数可）"></div>`, { cls: 'span2', hint: '複数社に応募する場合は1社ずつEnterで追加してください' })}
      ${field('応募日', `<input type="date" name="appliedAt" value="${today()}">`)}
      ${field('選考ステータス', `<select name="statusId">${opts(sts.map(s => [s.id, s.name]), defSt)}</select>`)}
      ${field('次回対応予定日', `<input type="date" name="nextActionDate">`)}
      ${field('次回対応内容', `<input name="nextActionNote" placeholder="例）推薦状送付">`)}
      ${field('備考', `<textarea name="memo" rows="2"></textarea>`, { cls: 'span2' })}
      <input type="hidden" name="companies">
      ${datalist('dl-cand', [...new Set(store.list('candidate').map(c => c.name))])}
      ${datalist('dl-ca', store.list('ca').map(c => c.name))}
      ${datalist('dl-company', store.list('company').map(c => c.name))}
    </form>`,
    foot: `<button class="btn" data-close>キャンセル</button><button class="btn primary" data-save>${icon('check')}登録する</button>`,
    onClose: reason => { if (reason === 'saved') draft.clear(key); },
  });
  const form = $('form', m.el);
  const chips = $('.chips', form);
  const hidden = $('[name=companies]', form);
  const input = $('[name=companyInput]', form);
  let companies = prefill.companyName ? [prefill.companyName] : [];
  const drawChips = () => {
    chips.innerHTML = companies.map((c, i) => `<span class="chip">${esc(c)}<button type="button" data-i="${i}" aria-label="外す">${icon('x')}</button></span>`).join('');
    hidden.value = companies.join('\n');
    hidden.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const addCompany = () => {
    input.value.split(/[,、\n]/).map(s => s.trim()).filter(Boolean).forEach(c => { if (!companies.includes(c)) companies.push(c); });
    input.value = '';
    drawChips();
  };
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); addCompany(); } });
  input.addEventListener('change', () => { if (store.list('company').some(c => c.name === input.value.trim())) addCompany(); });
  chips.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) { companies.splice(+b.dataset.i, 1); drawChips(); } });
  form.addEventListener('submit', e => e.preventDefault());

  const d = draft.load(key);
  if (d && !prefill.candName && !prefill.companyName) {
    draft.fill(form, d);
    companies = (d.companies || '').split('\n').filter(Boolean);
    draftNotice($('.modal-body', m.el), key, () => { form.reset(); companies = []; drawChips(); });
  }
  drawChips();
  draft.bind(key, form);
  // 求職者を選んだら担当CAを自動で入れる
  $('[name=candName]', form).addEventListener('change', e => {
    const c = store.list('candidate').find(x => x.name === e.target.value.trim());
    if (c?.caId && !$('[name=caName]', form).value) $('[name=caName]', form).value = nameOf(c.caId);
  });

  $('[data-save]', m.el).onclick = async () => {
    if (input.value.trim()) addCompany();
    const f = formData(form);
    if (!f.candName) return toast('求職者名を入力してください', 'err');
    if (!companies.length) return toast('応募企業を入力してください', 'err');
    const caId = await idByName('ca', f.caName);
    const candId = await idByName('candidate', f.candName, caId ? { caId } : {});
    const cand = store.get(candId);
    if (caId && cand && cand.caId !== caId) await store.patch(candId, { caId });
    for (const cn of companies) {
      const companyId = await idByName('company', cn);
      await store.save('application', {
        candidateId: candId, companyId, appliedAt: f.appliedAt, statusId: f.statusId,
        nextActionDate: f.nextActionDate, nextActionNote: f.nextActionNote, memo: f.memo,
      });
    }
    m.close('saved');
    saved(`${f.candName}さんの応募を${companies.length}件登録しました`);
  };
}

// ===================== 応募詳細（編集） =====================
export function openApplication(appId) {
  const app = store.get(appId);
  if (!app) return toast('この応募は見つかりません（削除された可能性があります）', 'err');
  const key = 'app:' + appId;
  const cand = candidateOf(app);
  const m = openModal({
    title: `${cand?.name || '求職者'}／${nameOf(app.companyId)}`, sub: `応募詳細　最終更新 ${new Date(app.updatedAt).toLocaleString('ja-JP')}`, icon: 'file', wide: true,
    body: `<form class="fields" autocomplete="off">
      ${field('求職者', `<select name="candidateId">${opts(candidateOptions(), app.candidateId)}</select>`)}
      ${field('担当CA（求職者ごと）', `<select name="caId">${opts(caOptions(), cand?.caId, { empty: '未設定' })}</select>`, { hint: '変更すると、この求職者の他の応募にも反映されます' })}
      ${field('応募企業', `<select name="companyId">${opts(companyOptions(), app.companyId)}</select>`)}
      ${field('応募日', `<input type="date" name="appliedAt" value="${esc(app.appliedAt || '')}">`)}
      ${field('選考ステータス', `<select name="statusId">${opts(statusOptions(), app.statusId, { empty: '未設定' })}</select>`)}
      ${field('内定日', `<input type="date" name="offerDate" value="${esc(app.offerDate || '')}">`)}
      ${field('内定承諾期限（日時）', `<input type="datetime-local" name="acceptDeadline" value="${esc(app.acceptDeadline || '')}">`)}
      ${field('内定承諾日', `<input type="date" name="acceptedDate" value="${esc(app.acceptedDate || '')}">`)}
      ${field('入社予定日', `<input type="date" name="joinDate" value="${esc(app.joinDate || '')}">`)}
      ${field('次回対応予定日', `<input type="date" name="nextActionDate" value="${esc(app.nextActionDate || '')}">`)}
      ${field('次回対応内容', `<input name="nextActionNote" value="${esc(app.nextActionNote || '')}" placeholder="例）面接日程の回答待ち">`, { cls: 'span2' })}
      ${field('備考', `<textarea name="memo" rows="3">${esc(app.memo || '')}</textarea>`, { cls: 'span2' })}
    </form>
    <div class="sched-lists"></div>`,
    foot: `<button class="btn danger ghost" data-del>${icon('trash')}この応募を削除</button><span class="grow"></span>
      <a class="btn" href="#/candidate/${esc(app.candidateId)}" data-close>${icon('user')}求職者ページ</a>
      <button class="btn" data-close>閉じる</button><button class="btn primary" data-save>${icon('check')}保存</button>`,
    onClose: reason => { off(); if (reason === 'saved' || reason === 'deleted') draft.clear(key); },
  });
  const form = $('form', m.el);
  const d = draft.load(key);
  if (d && d._at > new Date(app.updatedAt).getTime()) {
    draft.fill(form, d);
    draftNotice($('.modal-body', m.el), key, () => { m.close('discard'); openApplication(appId); });
  }
  draft.bind(key, form);

  const lists = $('.sched-lists', m.el);
  const drawLists = () => {
    const a = store.get(appId);
    if (!a) return;
    lists.innerHTML = eventListBlock('面接', 'interview', eventsFor({ applicationId: appId, type: 'interview' }), { applicationId: appId })
      + eventListBlock('オファー面談', 'offer', eventsFor({ applicationId: appId, type: 'offer' }), { applicationId: appId })
      + eventListBlock('定期面談（内定承諾後〜入社）', 'followup', eventsFor({ candidateId: a.candidateId, type: 'followup' }), { candidateId: a.candidateId })
      + eventListBlock('その他の予定', 'task', eventsFor({ applicationId: appId, type: 'task' }), { applicationId: appId, candidateId: a.candidateId });
  };
  drawLists();
  const off = store.onChange(drawLists);
  lists.addEventListener('click', onEventListClick);

  $('[data-save]', m.el).onclick = async () => {
    const f = formData(form);
    const { caId, ...rest } = f;
    await store.patch(appId, rest);
    const c = store.get(rest.candidateId);
    if (c && (c.caId || '') !== caId) await store.patch(c.id, { caId });
    m.close('saved');
    saved();
  };
  $('[data-del]', m.el).onclick = async () => {
    if (await removeRecord(store.get(appId))) m.close('deleted');
  };
}

// 予定一覧のブロック（応募詳細・求職者ページで使う）
export function eventListBlock(title, type, list, ctx) {
  const t = EVENT_TYPES[type];
  return `<section class="sched-block">
    <div class="sched-head"><h4><span class="dot ${t.color}"></span>${esc(title)}<small>${list.length}件</small></h4>
      <button type="button" class="btn sm" data-add-event="${type}" data-ctx='${esc(JSON.stringify(ctx))}'>${icon('plus')}追加</button></div>
    ${list.length ? `<ul class="sched-list">${list.map(e => eventLine(e)).join('')}</ul>` : '<p class="muted small">まだ登録されていません</p>'}
  </section>`;
}
export function eventLine(e) {
  const state = e.type === 'interview' ? (e.result || '予定') : e.type === 'task' ? (e.done ? '完了' : '予定') : (e.state || '予定');
  const label = e.type === 'interview' ? (e.round || '面接') : e.type === 'task' ? (e.title || '予定') : EVENT_TYPES[e.type].label;
  const app = store.get(e.applicationId);
  return `<li class="sched-item ${state === 'キャンセル' ? 'cancel' : ''}" data-event="${esc(e.id)}">
    <b>${esc(label)}</b><span>${e.date ? esc(fmtDate(e.date, { year: true }) + ' ' + fmtTimeRange(e)) : '<i class="muted">日時未定</i>'}</span>
    ${e.format ? `<span class="tag">${esc(e.format)}</span>` : ''}
    <span class="tag st-${state === '通過' || state === '完了' ? 'green' : state === '見送り' || state === 'キャンセル' ? 'mute' : state === '結果待ち' ? 'yellow' : 'blue'}">${esc(state)}</span>
    ${['interview', 'offer', 'followup'].includes(e.type) ? `<span class="tag ${e.reminded ? 'st-green' : 'st-red'}">${e.reminded ? 'リマインド済' : 'リマインド未'}</span>` : ''}
    ${e.type === 'followup' && app ? `<span class="muted small">${esc(nameOf(app.companyId))}</span>` : ''}
    ${e.memo ? `<span class="muted small ell">${esc(e.memo)}</span>` : ''}
    <span class="grow"></span>${icon('edit', 'muted')}</li>`;
}
export function onEventListClick(e) {
  const add = e.target.closest('[data-add-event]');
  if (add) return openEvent({ type: add.dataset.addEvent, ...JSON.parse(add.dataset.ctx || '{}') });
  const item = e.target.closest('[data-event]');
  if (item) openEvent({ id: item.dataset.event });
}

// ===================== 予定（面接・オファー面談・定期面談・その他） =====================
// 新規: openEvent({type, applicationId, candidateId, date})  編集: openEvent({id})
export function openEvent(init = {}) {
  const ev = init.id ? store.get(init.id) : null;
  if (init.id && !ev) return toast('この予定は見つかりません', 'err');
  if (!ev && ['deadline', 'join', 'action'].includes(init.type)) return openAppDate(init);
  const e = ev || { type: init.type || 'interview', applicationId: init.applicationId || '', candidateId: init.candidateId || '', date: init.date || '', format: '', reminded: false };
  const key = 'event:' + (ev?.id || 'new');
  const m = openModal({ title: ev ? '予定の編集' : '予定の追加', icon: 'calendar', wide: true, body: '<form class="fields" autocomplete="off"></form>',
    foot: `${ev ? `<button class="btn danger ghost" data-del>${icon('trash')}削除</button>` : ''}<span class="grow"></span>
      <button class="btn" data-close>キャンセル</button><button class="btn primary" data-save>${icon('check')}保存</button>`,
    onClose: r => { if (r === 'saved' || r === 'deleted') draft.clear(key); } });
  const form = $('form', m.el);

  const render = (type, keep = {}) => {
    const v = { ...e, ...keep, type };
    const isApp = type === 'interview' || type === 'offer';
    const app = store.get(v.applicationId);
    const typeSel = ev ? '' : field('予定の種類', `<select name="type">${opts([['interview', '面接'], ['offer', 'オファー面談'], ['followup', '定期面談（内定承諾後）'], ['task', 'その他の予定'], ['deadline', '内定承諾期限'], ['join', '入社予定日'], ['action', '次回対応予定日']], type)}</select>`, { cls: 'span2' });
    let html = typeSel;
    if (isApp) html += field('応募（求職者／企業） <em>必須</em>', `<select name="applicationId">${opts(appOptions(), v.applicationId, { empty: '選択してください' })}</select>`, { cls: 'span2' });
    if (type === 'followup') html += field('求職者 <em>必須</em>', `<select name="candidateId">${opts(candidateOptions(), v.candidateId || app?.candidateId, { empty: '選択してください' })}</select>`)
      + field('担当CA', `<input disabled class="ca-view" value="${esc(nameOf(store.get(v.candidateId || app?.candidateId)?.caId))}">`);
    if (type === 'task') html += field('タイトル <em>必須</em>', `<input name="title" value="${esc(v.title || '')}" placeholder="例）推薦文の作成">`, { cls: 'span2' })
      + field('関連する応募（任意）', `<select name="applicationId">${opts(appOptions(), v.applicationId, { empty: 'なし' })}</select>`, { cls: 'span2' });
    if (type === 'interview') html += field('回次', `<select name="round">${opts(ROUNDS.map(r => [r, r]), v.round || nextRound(v.applicationId))}</select>`);
    html += field('日付', `<input type="date" name="date" value="${esc(v.date || '')}">`, { hint: '未定なら空欄でOK' })
      + `<div class="field time-pair"><span>時刻（開始〜終了）</span><div><input type="time" name="start" value="${esc(v.start || '')}"><i>〜</i><input type="time" name="end" value="${esc(v.end || '')}"></div></div>`;
    if (isApp) html += field('形式', `<select name="format">${opts(FORMATS_SIMPLE.map(f => [f, f]), v.format, { empty: '未定' })}</select>`);
    if (type === 'followup') html += field('面談形式', `<select name="format">${opts(FORMATS_FOLLOWUP.map(f => [f, f]), v.format || 'Zoom')}</select>`);
    if (type === 'interview') html += field('結果', `<select name="result">${opts(INTERVIEW_RESULTS.map(r => [r, r]), v.result || '予定')}</select>`);
    if (type === 'offer' || type === 'followup') html += field(type === 'followup' ? '面談実施状況' : '状態', `<select name="state">${opts(FOLLOWUP_STATES.map(r => [r, r]), v.state || '予定')}</select>`);
    if (type === 'task') html += field('状態', `<label class="check"><input type="checkbox" name="done" ${v.done ? 'checked' : ''}>完了した</label>`);
    if (type !== 'task') html += `<div class="field remind-box span2"><span>CAへのリマインド</span><div>
        <label class="check big"><input type="checkbox" name="reminded" ${v.reminded ? 'checked' : ''}>CAへリマインド済み</label>
        <label class="inline">リマインド実施日 <input type="date" name="remindedDate" value="${esc(v.remindedDate || '')}"></label></div></div>`;
    html += field(type === 'followup' ? '面談メモ' : 'メモ', `<textarea name="memo" rows="3">${esc(v.memo || '')}</textarea>`, { cls: 'span2' });
    if (type === 'followup') html += field('次回面談予定日', `<input type="date" name="nextDate" value="${esc(v.nextDate || '')}">`)
      + `<label class="field"><span>&nbsp;</span><label class="check"><input type="checkbox" name="createNext" ${ev ? '' : 'checked'}>次回面談を「予定」として自動追加する</label></label>`;
    if (isApp && !ev) html += `<label class="field span2"><span>&nbsp;</span><label class="check"><input type="checkbox" name="updateStatus" checked>選考ステータスも「${type === 'interview' ? '面接予定' : 'オファー面談予定'}」に更新する</label></label>`;
    form.innerHTML = html;
  };
  const d = draft.load(key);
  const useDraft = d && (!ev || d._at > new Date(ev.updatedAt).getTime());
  render(useDraft && d.type && !ev ? d.type : e.type);
  if (useDraft) { draft.fill(form, d); draftNotice($('.modal-body', m.el), key, () => render(e.type)); }
  draft.bind(key, form);
  form.addEventListener('change', ev2 => {
    const n = ev2.target.name;
    if (n === 'type') {
      if (['deadline', 'join', 'action'].includes(ev2.target.value)) { const f = formData(form); m.close('switch'); return openAppDate({ ...init, type: ev2.target.value, applicationId: f.applicationId, date: f.date }); }
      render(ev2.target.value, formData(form));
    }
    if (n === 'candidateId') { const v = $('.ca-view', form); if (v) v.value = nameOf(store.get(ev2.target.value)?.caId); }
    if (n === 'reminded' && ev2.target.checked) { const r = $('[name=remindedDate]', form); if (!r.value) r.value = today(); }
    if (n === 'applicationId' && $('[name=round]', form) && !ev) $('[name=round]', form).value = nextRound(ev2.target.value);
  });

  $('[data-save]', m.el).onclick = async () => {
    const f = formData(form);
    const type = f.type || e.type;
    const { createNext, updateStatus, type: _t, ...data } = f;
    if ((type === 'interview' || type === 'offer') && !data.applicationId) return toast('応募を選択してください', 'err');
    if (type === 'followup' && !data.candidateId) return toast('求職者を選択してください', 'err');
    if (type === 'task' && !data.title) return toast('タイトルを入力してください', 'err');
    if (data.start && data.end && data.end < data.start) return toast('終了時刻が開始時刻より前になっています', 'err');
    const app = store.get(data.applicationId);
    if (app && !data.candidateId) data.candidateId = app.candidateId;
    if (!data.reminded) data.remindedDate = data.remindedDate || '';
    const savedEv = await store.save('event', { ...(ev || {}), ...data, type });
    if (updateStatus && app) {
      const want = type === 'interview' ? '面接予定' : 'オファー面談予定';
      const st = statuses().find(s => s.name === want);
      const order = ['prep', 'doc', 'interview', 'waiting', 'offer'];
      if (st && order.indexOf(stageOf(app)) <= order.indexOf(st.stage)) await store.patch(app.id, { statusId: st.id });
    }
    // 面接結果を入れたらステータスも合わせる
    if (type === 'interview' && app && ev && ev.result !== data.result) {
      const map = { '結果待ち': '面接結果待ち', '見送り': '面接見送り', '通過': '面接通過' };
      const st = statuses().find(s => s.name === map[data.result]);
      if (st && await confirmDialog(`選考ステータスも「${st.name}」に変更しますか？`, { title: 'ステータスの更新', ok: '変更する', danger: false })) await store.patch(app.id, { statusId: st.id });
    }
    if (type === 'followup' && createNext && data.nextDate) {
      const exists = eventsFor({ candidateId: data.candidateId, type: 'followup' }).some(x => x.date === data.nextDate && x.id !== savedEv.id);
      if (!exists) await store.save('event', { type: 'followup', candidateId: data.candidateId, date: data.nextDate, start: data.start, end: data.end, format: data.format, state: '予定', reminded: false });
    }
    m.close('saved');
    saved();
  };
  $('[data-del]', m.el)?.addEventListener('click', async () => {
    if (await removeRecord(ev)) m.close('deleted');
  });
}
function nextRound(applicationId) {
  const n = applicationId ? eventsFor({ applicationId, type: 'interview' }).length : 0;
  return ['一次', '二次', '三次'][n] || '最終';
}

// 内定承諾期限・入社予定日・次回対応予定日（応募に付く日付）をカレンダーから設定
export function openAppDate({ type, applicationId = '', date = '' }) {
  const label = EVENT_TYPES[type].label;
  const fieldName = { deadline: 'acceptDeadline', join: 'joinDate', action: 'nextActionDate' }[type];
  const app = store.get(applicationId);
  const cur = app?.[fieldName] || '';
  const val = type === 'deadline' ? (cur || (date ? date + 'T18:00' : '')) : (cur || date);
  const m = openModal({ title: label + 'の設定', icon: EVENT_TYPES[type].icon, body: `<form class="fields one" autocomplete="off">
      ${field('応募（求職者／企業） <em>必須</em>', `<select name="applicationId">${opts(appOptions(), applicationId, { empty: '選択してください' })}</select>`)}
      ${field(label, `<input type="${type === 'deadline' ? 'datetime-local' : 'date'}" name="value" value="${esc(val)}">`)}
      ${type === 'action' ? field('対応内容', `<input name="note" value="${esc(app?.nextActionNote || '')}">`) : ''}
    </form>`,
    foot: `${cur ? `<button class="btn danger ghost" data-clear>${icon('trash')}この日付を削除</button>` : ''}<span class="grow"></span><button class="btn" data-close>キャンセル</button><button class="btn primary" data-save>${icon('check')}保存</button>` });
  const form = $('form', m.el);
  $('[data-save]', m.el).onclick = async () => {
    const f = formData(form);
    if (!f.applicationId) return toast('応募を選択してください', 'err');
    const patch = { [fieldName]: f.value };
    if (type === 'action') patch.nextActionNote = f.note;
    await store.patch(f.applicationId, patch);
    m.close('saved'); saved();
  };
  $('[data-clear]', m.el)?.addEventListener('click', async () => {
    if (!await confirmDialog(`${label}を削除しますか？`, { detail: '応募そのものは削除されません' })) return;
    await store.patch(applicationId, { [fieldName]: '' });
    m.close('deleted'); toast(`${label}を削除しました`);
  });
}

// ===================== マスタ（求職者・CA・企業） =====================
export function openCandidate(id = null, preset = {}) {
  const c = id ? store.get(id) : { caId: preset.caId || '' };
  openMaster({ kind: 'candidate', rec: c, title: id ? '求職者の編集' : '求職者の追加', ic: 'user', fields: `
    ${field('求職者名 <em>必須</em>', `<input name="name" value="${esc(c.name || '')}">`)}
    ${field('ふりがな', `<input name="kana" value="${esc(c.kana || '')}">`)}
    ${field('担当CA', `<select name="caId">${opts(caOptions(), c.caId, { empty: '未設定' })}</select>`)}
    ${field('連絡先（任意）', `<input name="contact" value="${esc(c.contact || '')}">`)}
    ${field('備考', `<textarea name="memo" rows="3">${esc(c.memo || '')}</textarea>`, { cls: 'span2' })}` });
}
export function openCA(id = null) {
  const c = id ? store.get(id) : {};
  openMaster({ kind: 'ca', rec: c, title: id ? 'CAの編集' : 'CAの追加', ic: 'users', fields: `
    ${field('CA名 <em>必須</em>', `<input name="name" value="${esc(c.name || '')}">`)}
    ${field('連絡先（任意）', `<input name="contact" value="${esc(c.contact || '')}" placeholder="メール・Slackなど">`)}
    ${field('備考', `<textarea name="memo" rows="3">${esc(c.memo || '')}</textarea>`, { cls: 'span2' })}` });
}
export function openCompany(id = null) {
  const c = id ? store.get(id) : {};
  openMaster({ kind: 'company', rec: c, title: id ? '企業の編集' : '企業の追加', ic: 'building', fields: `
    ${field('企業名 <em>必須</em>', `<input name="name" value="${esc(c.name || '')}">`)}
    ${field('担当者名', `<input name="contactName" value="${esc(c.contactName || '')}">`)}
    ${field('連絡先', `<input name="contact" value="${esc(c.contact || '')}">`)}
    ${field('備考', `<textarea name="memo" rows="3">${esc(c.memo || '')}</textarea>`, { cls: 'span2' })}` });
}
function openMaster({ kind, rec, title, ic, fields }) {
  const key = `${kind}:${rec.id || 'new'}`;
  const m = openModal({ title, icon: ic, body: `<form class="fields" autocomplete="off">${fields}</form>`,
    foot: `${rec.id ? `<button class="btn danger ghost" data-del>${icon('trash')}削除</button>` : ''}<span class="grow"></span><button class="btn" data-close>キャンセル</button><button class="btn primary" data-save>${icon('check')}保存</button>`,
    onClose: r => { if (r === 'saved' || r === 'deleted') draft.clear(key); } });
  const form = $('form', m.el);
  const d = draft.load(key);
  if (d && (!rec.id || d._at > new Date(rec.updatedAt).getTime())) { draft.fill(form, d); draftNotice($('.modal-body', m.el), key, () => { m.close(); openMaster({ kind, rec, title, ic, fields }); }); }
  draft.bind(key, form);
  $('[data-save]', m.el).onclick = async () => {
    const f = formData(form);
    if (!f.name) return toast('名前を入力してください', 'err');
    await store.save(kind, { ...(rec.id ? store.get(rec.id) : {}), ...f });
    m.close('saved');
    saved(rec.id && rec.name !== f.name ? `名前を「${f.name}」に変更しました（関連データにも反映されます）` : '保存しました');
  };
  $('[data-del]', m.el)?.addEventListener('click', async () => { if (await removeRecord(store.get(rec.id))) m.close('deleted'); });
}

// ===================== 削除（確認 → ゴミ箱へ） =====================
const KIND_LABEL = { ca: 'CA', candidate: '求職者', company: '企業', application: '応募', event: '予定', status: 'ステータス' };
export function recordLabel(r) {
  if (!r) return '';
  if (r.kind === 'application') { const row = appRow(r); return `${row.candName}／${row.companyName}`; }
  if (r.kind === 'event') return `${r.type === 'task' ? (r.title || '予定') : EVENT_TYPES[r.type]?.label || '予定'} ${r.date ? fmtDate(r.date) : ''} ${nameOf(r.candidateId)}`;
  return r.name || '';
}
export async function removeRecord(rec) {
  if (!rec) return false;
  const children = childrenOf(rec);
  let detail = '削除したデータは「設定 → ゴミ箱」から復元できます。';
  if (rec.kind === 'candidate') detail = `この求職者の応募・予定（${children.length}件）も一緒にゴミ箱へ移動します。` + detail;
  if (rec.kind === 'company') detail = `この企業への応募・予定（${children.length}件）も一緒にゴミ箱へ移動します。` + detail;
  if (rec.kind === 'application' && children.length) detail = `この応募の面接などの予定（${children.length}件）も一緒にゴミ箱へ移動します。` + detail;
  if (rec.kind === 'ca') {
    const n = store.list('candidate').filter(c => c.caId === rec.id).length;
    if (n) detail = `担当している求職者${n}名は残ります（担当CAは「（削除済み）」と表示されます）。` + detail;
  }
  if (rec.kind === 'status') {
    const n = store.list('application').filter(a => a.statusId === rec.id).length;
    if (n) detail = `このステータスの応募が${n}件あります。応募は残り、ステータスは「（削除済み）」と表示されます。` + detail;
  }
  if (!await confirmDialog(`${KIND_LABEL[rec.kind]}「${recordLabel(rec)}」を削除しますか？`, { title: '削除の確認', detail })) return false;
  await store.remove(rec.id, children);
  toast('ゴミ箱へ移動しました（設定画面から復元できます）');
  return true;
}

// ステータスの説明（設定画面用）
export const stageOptions = () => Object.entries(STAGES).map(([k, v]) => [k, v.label]);
export { fmtDateTime };
