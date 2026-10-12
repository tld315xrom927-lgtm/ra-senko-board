// 応募者一覧（横長テーブル）。トップページ・CAページ・企業ページで共通利用
import { store } from './store.js';
import { appRow, statuses, statusColor, fmtDate, fmtDateTime, fmtTimeRange, today, addDays, daysBetween, nameOf, isClosed, FORMATS_SIMPLE } from './model.js';
import { esc, icon, openPopover, toast } from './ui.js';
import { openApplication, openEvent, caOptions, companyOptions } from './forms.js';

const dateCls = (d, { past = '', today: t = 'hl-red', soon = 'hl-orange' } = {}) => {
  if (!d) return '';
  const n = daysBetween(today(), d.slice(0, 10));
  return n < 0 ? past : n === 0 ? t : n === 1 ? soon : '';
};
const deadlineCls = (r) => {
  const d = r.app.acceptDeadline;
  if (!d || !['offer', 'other'].includes(r.stage)) return '';
  const n = daysBetween(today(), d.slice(0, 10));
  return n <= 1 ? 'hl-red' : n <= 3 ? 'hl-orange' : n <= 7 ? 'hl-yellow' : '';
};
const evText = ev => ev ? `${fmtDate(ev.date)} ${fmtTimeRange(ev)}` : '';
const empty = '<span class="add-hint">＋</span>';

// key, label, width, sticky, sort（並び替えの値）, cell（中身）
export const COLUMNS = [
  { key: 'ca', label: '担当CA', w: 92, sticky: true, sort: r => r.caName,
    cell: r => `<td class="edit" data-edit="caId">${r.caName ? `<span class="ca-pill">${esc(r.caName)}</span>` : empty}</td>` },
  { key: 'cand', label: '求職者名', w: 124, sticky: true, sort: r => r.cand?.kana || r.candName,
    cell: r => `<td class="cand-cell"><a class="name-link" href="#/candidate/${esc(r.app.candidateId)}">${esc(r.candName)}</a></td>` },
  { key: 'company', label: '応募企業', w: 150, sticky: true, sort: r => r.companyName,
    cell: r => `<td class="edit" data-edit="companyId"><span class="ell2">${esc(r.companyName)}</span></td>` },
  { key: 'status', label: '選考ステータス', w: 146, sticky: true, sort: r => statuses().findIndex(s => s.id === r.app.statusId),
    cell: r => `<td class="st-cell"><select class="status-sel st-${statusColor(r.st)}" data-status aria-label="選考ステータス">${statusOpts(r.app.statusId)}</select></td>` },
  { key: 'appliedAt', label: '応募日', w: 92, sort: r => r.app.appliedAt || '',
    cell: r => `<td class="edit" data-edit="appliedAt">${r.app.appliedAt ? esc(fmtDate(r.app.appliedAt)) : empty}</td>` },
  { key: 'interview', label: '面接日時', w: 150, sort: r => r.interview?.date ? r.interview.date + (r.interview.start || '') : '',
    cell: r => `<td class="edit ${!r.interview?.result || r.interview.result === '予定' ? dateCls(r.interview?.date) : ''}" data-ev-cell="interview" data-ev="${esc(r.interview?.id || '')}">${r.interview ? `<b>${esc(evText(r.interview))}</b><small>${esc(r.interview.round || '')}${r.interviewCount > 1 ? `（全${r.interviewCount}回）` : ''}${r.interview.result && r.interview.result !== '予定' ? '・' + esc(r.interview.result) : ''}</small>` : empty}</td>` },
  { key: 'interviewFormat', label: '面接形式', w: 84, sort: r => r.interview?.format || '',
    cell: r => `<td class="edit" data-fmt="${esc(r.interview?.id || '')}" data-fmt-type="interview">${r.interview?.format ? fmtTag(r.interview.format) : r.interview ? empty : ''}</td>` },
  { key: 'offer', label: 'オファー面談日時', w: 140, sort: r => r.offer?.date ? r.offer.date + (r.offer.start || '') : '',
    cell: r => `<td class="edit ${r.offer && r.offer.state !== '完了' ? dateCls(r.offer?.date) : ''}" data-ev-cell="offer" data-ev="${esc(r.offer?.id || '')}">${r.offer ? `<b>${esc(evText(r.offer))}</b>${r.offer.state && r.offer.state !== '予定' ? `<small>${esc(r.offer.state)}</small>` : ''}` : empty}</td>` },
  { key: 'offerFormat', label: 'オファー面談形式', w: 92, sort: r => r.offer?.format || '',
    cell: r => `<td class="edit" data-fmt="${esc(r.offer?.id || '')}" data-fmt-type="offer">${r.offer?.format ? fmtTag(r.offer.format) : r.offer ? empty : ''}</td>` },
  { key: 'offerDate', label: '内定日', w: 92, sort: r => r.app.offerDate || '',
    cell: r => `<td class="edit" data-edit="offerDate">${r.app.offerDate ? esc(fmtDate(r.app.offerDate)) : empty}</td>` },
  { key: 'acceptDeadline', label: '内定承諾期限', w: 130, sort: r => r.app.acceptDeadline || '',
    cell: r => `<td class="edit ${deadlineCls(r)}" data-edit="acceptDeadline">${r.app.acceptDeadline ? `<b>${esc(fmtDateTime(r.app.acceptDeadline))}</b>${deadlineCls(r) ? `<small>${deadlineText(r.app.acceptDeadline)}</small>` : ''}` : empty}</td>` },
  { key: 'acceptedDate', label: '内定承諾日', w: 92, sort: r => r.app.acceptedDate || '',
    cell: r => `<td class="edit" data-edit="acceptedDate">${r.app.acceptedDate ? esc(fmtDate(r.app.acceptedDate)) : empty}</td>` },
  { key: 'joinDate', label: '入社予定日', w: 104, sort: r => r.app.joinDate || '',
    cell: r => `<td class="edit" data-edit="joinDate">${r.app.joinDate ? esc(fmtDate(r.app.joinDate, { year: true })) : empty}</td>` },
  { key: 'followup', label: '次回定期面談日時', w: 140, sort: r => r.followup ? r.followup.date + (r.followup.start || '') : '',
    cell: r => `<td class="edit ${dateCls(r.followup?.date)}" data-ev-cell="followup" data-ev="${esc(r.followup?.id || '')}">${r.followup ? `<b>${esc(evText(r.followup))}</b><small>${esc(r.followup.format || '')}</small>` : (['accepted', 'joining'].includes(r.stage) ? empty : '')}</td>` },
  { key: 'remind', label: 'CAリマインド', w: 118, sort: r => r.remindTarget ? (r.remindTarget.reminded ? 2 : 1) : 3,
    cell: r => `<td>${remindCell(r.remindTarget)}</td>` },
  { key: 'nextAction', label: '次回対応予定日', w: 140, sort: r => r.app.nextActionDate || '9999',
    cell: r => `<td class="edit ${r.app.nextActionDate && !isClosed(r.app) ? dateCls(r.app.nextActionDate, { past: 'hl-red', today: 'hl-orange', soon: '' }) : ''}" data-edit="nextActionDate">${r.app.nextActionDate ? `<b>${esc(fmtDate(r.app.nextActionDate))}</b>` : empty}${r.app.nextActionNote ? `<small class="ell">${esc(r.app.nextActionNote)}</small>` : ''}</td>` },
  { key: 'memo', label: '備考', w: 180, sort: r => r.app.memo || '',
    cell: r => `<td class="edit memo" data-edit="memo">${r.app.memo ? `<span class="ell2">${esc(r.app.memo)}</span>` : empty}</td>` },
  { key: 'open', label: '', w: 44,
    cell: () => `<td class="row-open"><button class="icon-btn sm" data-open-app title="応募詳細を開く">${icon('chevR')}</button></td>` },
];
const fmtTag = f => `<span class="tag ${f === '対面' ? 'st-peach' : 'st-blue'}">${f === '対面' ? icon('pin') : icon('video')}${esc(f)}</span>`;
function deadlineText(dt) {
  const n = daysBetween(today(), dt.slice(0, 10));
  return n < 0 ? '期限切れ' : n === 0 ? '今日が期限' : `あと${n}日`;
}
function remindCell(ev) {
  if (!ev) return '<span class="muted small">—</span>';
  const what = ev.type === 'interview' ? '面接' : ev.type === 'offer' ? 'オファー' : '定期面談';
  return `<button class="remind-btn ${ev.reminded ? 'done' : ''}" data-remind="${esc(ev.id)}" title="クリックで切り替え">${icon(ev.reminded ? 'check' : 'bell')}${ev.reminded ? '済' : '未'}<small>${what} ${esc(fmtDate(ev.date))}</small></button>`;
}
function statusOpts(selected) {
  const sts = statuses();
  const known = sts.some(s => s.id === selected);
  return (known ? '' : `<option value="${esc(selected || '')}" selected>${selected ? esc(nameOf(selected) || '（削除済み）') : '未設定'}</option>`)
    + sts.map(s => `<option value="${esc(s.id)}" ${s.id === selected ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
}

// rows: appRow の配列
export function tableHTML(rows, { sort = { key: 'nextAction', dir: 1 }, hide = [], emptyText = '該当する応募はありません' } = {}) {
  const cols = COLUMNS.filter(c => !hide.includes(c.key));
  let left = 0;
  const lefts = {};
  cols.forEach(c => { if (c.sticky) { lefts[c.key] = left; left += c.w; } });
  const lastSticky = cols.filter(c => c.sticky).at(-1)?.key;
  const head = cols.map(c => `<th class="${c.sticky ? 'stk stk-' + c.key : ''} ${c.key === lastSticky ? 'stk-last' : ''} ${c.sort ? 'sortable' : ''} ${sort.key === c.key ? 'sorted' : ''}" style="min-width:${c.w}px;width:${c.w}px;${c.sticky ? `left:${lefts[c.key]}px` : ''}" ${c.sort ? `data-sort="${c.key}"` : ''}>${esc(c.label)}${sort.key === c.key ? `<i class="sort-mark">${sort.dir > 0 ? '▲' : '▼'}</i>` : ''}</th>`).join('');
  const body = rows.map(r => {
    const cells = cols.map(c => {
      let html = c.cell(r);
      if (c.sticky) html = html.replace('<td', `<td style="left:${lefts[c.key]}px"`).replace('class="', `class="stk stk-${c.key} ${c.key === lastSticky ? 'stk-last ' : ''}`);
      return html;
    }).join('');
    return `<tr data-app="${esc(r.app.id)}" class="${isClosed(r.app) ? 'closed' : ''} stage-${r.stage}">${cells}</tr>`;
  }).join('');
  return `<div class="table-wrap"><table class="app-table"><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${cols.length}" class="empty-row">${esc(emptyText)}</td></tr>`}</tbody></table></div>`;
}

export function sortRows(rows, sort) {
  const col = COLUMNS.find(c => c.key === sort.key);
  if (!col?.sort) return rows;
  return [...rows].sort((a, b) => {
    const va = col.sort(a), vb = col.sort(b);
    const ea = va === '' || va == null, eb = vb === '' || vb == null;
    if (ea !== eb) return ea ? 1 : -1;   // 空欄は常に下へ
    return (typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'ja')) * sort.dir;
  });
}

// テーブル操作（イベント委譲）。root にテーブルを描画する要素、onSort(key) で並び替え
export function bindTable(root, { onSort } = {}) {
  root.addEventListener('change', async e => {
    const sel = e.target.closest('[data-status]');
    if (!sel) return;
    const id = sel.closest('tr').dataset.app;
    await store.patch(id, { statusId: sel.value });
    const st = store.get(sel.value);
    // 内定承諾済みになったら承諾日を自動で入れる
    if (st?.stage === 'accepted' && !store.get(id).acceptedDate) await store.patch(id, { acceptedDate: today() });
    if (st?.stage === 'offer' && st.name === '内定' && !store.get(id).offerDate) await store.patch(id, { offerDate: today() });
    toast(`ステータスを「${st?.name || ''}」に変更しました`);
  });
  root.addEventListener('click', async e => {
    const th = e.target.closest('th[data-sort]');
    if (th) return onSort?.(th.dataset.sort);
    const tr = e.target.closest('tr[data-app]');
    if (!tr || e.target.closest('a,select')) return;
    const app = store.get(tr.dataset.app);
    if (!app) return;
    const remind = e.target.closest('[data-remind]');
    if (remind) {
      const ev = store.get(remind.dataset.remind);
      await store.patch(ev.id, { reminded: !ev.reminded, remindedDate: !ev.reminded ? today() : '' });
      return toast(!ev.reminded ? 'リマインド済みにしました' : 'リマインド未対応に戻しました');
    }
    if (e.target.closest('[data-open-app]')) return openApplication(app.id);
    const evCell = e.target.closest('[data-ev-cell]');
    if (evCell) {
      if (evCell.dataset.ev) return openEvent({ id: evCell.dataset.ev });
      return openEvent({ type: evCell.dataset.evCell, applicationId: app.id, candidateId: app.candidateId });
    }
    const fmt = e.target.closest('[data-fmt]');
    if (fmt) {
      if (!fmt.dataset.fmt) return;
      const ev = store.get(fmt.dataset.fmt);
      return openPopover(fmt, { label: '形式', type: 'select', value: ev.format || '', options: [['', '未定'], ...FORMATS_SIMPLE.map(f => [f, f])], onSave: v => store.patch(ev.id, { format: v }).then(() => toast('保存しました')) });
    }
    const cell = e.target.closest('[data-edit]');
    if (!cell) return;
    const f = cell.dataset.edit;
    const cand = store.get(app.candidateId);
    const save = v => store.patch(app.id, { [f]: v }).then(() => toast('保存しました'));
    if (f === 'caId') return openPopover(cell, { label: `担当CA（${cand?.name || ''}さんの全応募に反映）`, type: 'select', value: cand?.caId || '', options: [['', '未設定'], ...caOptions()], onSave: v => cand && store.patch(cand.id, { caId: v }).then(() => toast('担当CAを変更しました')) });
    if (f === 'companyId') return openPopover(cell, { label: '応募企業', type: 'select', value: app.companyId, options: companyOptions(), onSave: save });
    if (f === 'memo') return openPopover(cell, { label: '備考', type: 'textarea', value: app.memo || '', onSave: save });
    if (f === 'acceptDeadline') return openPopover(cell, { label: '内定承諾期限（日時）', type: 'datetime', value: app.acceptDeadline || (addDays(today(), 7) + 'T18:00'), onSave: save });
    if (f === 'nextActionDate') return openNextAction(cell, app);
    const labels = { appliedAt: '応募日', offerDate: '内定日', acceptedDate: '内定承諾日', joinDate: '入社予定日' };
    openPopover(cell, { label: labels[f] || f, type: 'date', value: app[f] || '', onSave: save });
  });
}

function openNextAction(cell, app) {
  // 日付と内容の2項目を1つのポップアップで
  openPopover(cell, { label: '次回対応予定日', type: 'date', value: app.nextActionDate || today(), onSave: async v => {
    await store.patch(app.id, { nextActionDate: v });
    if (v) setTimeout(() => openPopover(cell.isConnected ? cell : document.querySelector(`tr[data-app="${app.id}"] [data-edit=nextActionDate]`) || document.body, { label: '次回対応内容', value: store.get(app.id)?.nextActionNote || '', onSave: n => store.patch(app.id, { nextActionNote: n }).then(() => toast('保存しました')) }), 50);
    else toast('保存しました');
  } });
}
