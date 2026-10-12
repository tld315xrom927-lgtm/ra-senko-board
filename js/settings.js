// 設定（クラウド同期・ステータス管理・バックアップ/CSV・テストデータ・ゴミ箱）
import { store } from './store.js';
import { statuses, STAGES, appRow, applications, fmtDate, fmtDateTime, fmtTimeRange, nameOf, eventsFor, nextUpcoming, ensureStatuses } from './model.js';
import { esc, $, icon, toast, confirmDialog, opts, downloadFile, openPopover } from './ui.js';
import { recordLabel, removeRecord, stageOptions } from './forms.js';
import { cloud, getConfig, saveConfig, clearConfig, testConnection, signOut, syncNow, listMembers, addMember, removeMember, setMemberRole } from './cloud.js';
import { insertDemo, removeDemo, demoCount } from './demo.js';

const KIND_LABEL = { ca: 'CA', candidate: '求職者', company: '企業', application: '応募', event: '予定', status: 'ステータス' };
const COLORS = ['gray', 'lilac', 'blue', 'yellow', 'pink', 'peach', 'mint', 'green', 'mute', 'red'];

export function renderSettings(main) {
  main.innerHTML = `<header class="page-head"><div><p class="eyebrow">${icon('settings')}SETTINGS</p><h1>設定・データ管理</h1></div></header>
    <div class="settings-grid">
      <section class="panel" id="s-cloud"></section>
      <section class="panel" id="s-data"></section>
      ${getConfig() ? '<section class="panel span2" id="s-members"></section>' : ''}
      <section class="panel span2" id="s-status"></section>
      <section class="panel" id="s-demo"></section>
      <section class="panel" id="s-trash"></section>
    </div>`;
  main.addEventListener('click', onClick);
  main.addEventListener('change', onChange);
  const draw = () => { drawCloud(); drawData(); drawStatus(); drawDemo(); drawTrash(); drawMembers(); };
  draw();
  return { refresh: () => { drawStatus(); drawDemo(); drawTrash(); drawCloud(); } };
}

function drawCloud() {
  const cfg = getConfig();
  const box = $('#s-cloud');
  if (!box || box.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
  box.innerHTML = `<div class="panel-head"><div>${icon('cloud')}<h3>保存先・同期</h3></div></div><div class="pad">
    ${cfg ? `<p class="state-line ok">${icon('check')}クラウド（Supabase）に保存中：PC・スマホで同じデータを見られます</p>
      <dl class="detail-list"><dt>ログイン中</dt><dd>${esc(cloud.user || '—')}</dd><dt>状態</dt><dd>${esc({ ok: '同期済み', syncing: '同期中…', offline: 'オフライン', error: 'エラー', login: '要ログイン' }[cloud.status] || cloud.status)}${cloud.lastSync ? '（' + cloud.lastSync.toLocaleTimeString('ja-JP') + '）' : ''}</dd>
      ${cloud.message ? `<dt>メッセージ</dt><dd>${esc(cloud.message)}</dd>` : ''}<dt>接続先</dt><dd class="small">${esc(cfg.url)}</dd></dl>
      <div class="btn-row"><button class="btn" data-sync>${icon('refresh')}今すぐ同期</button><button class="btn" data-logout>${icon('logout')}ログアウト</button>${cfg.fromFile ? '' : `<button class="btn ghost" data-unlink>接続設定を外す</button>`}</div>`
    : `<p class="state-line warn">${icon('alert')}現在は<b>この端末（このブラウザ）だけ</b>に保存しています。スマホ等と共有するにはクラウド接続が必要です</p>
      <details class="howto"><summary>クラウド接続の設定（Supabase・無料枠）</summary>
        <ol><li>Supabase で無料プロジェクトを作成</li><li>SQL Editor で <code>supabase/setup.sql</code> を実行（許可するメールアドレスを書き換えてから）</li><li>Authentication → Users で利用者を作成</li><li>Project Settings → API の「Project URL」と「Publishable（anon）key」を下に貼り付け</li></ol>
        <p class="small muted">※ secret / service_role キーは絶対に貼らないでください</p>
        <label class="field"><span>Project URL</span><input id="cf-url" placeholder="https://xxxx.supabase.co"></label>
        <label class="field"><span>Publishable（anon）key</span><input id="cf-key" placeholder="sb_publishable_... または eyJ..."></label>
        <button class="btn primary" data-connect>${icon('cloud')}接続する</button>
        <p class="small muted">接続すると、この端末のデータはログイン後にクラウドへ送られます</p>
      </details>`}</div>`;
}

async function drawMembers() {
  const box = $('#s-members');
  if (!box || cloud.status === 'login') return;
  let list = [];
  let err = '';
  const admin = cloud.role === 'admin';
  try { list = await listMembers(); } catch (e) { err = e.message; }
  box.innerHTML = `<div class="panel-head"><div>${icon('lock')}<h3>許可メンバー（閲覧・編集できる人）</h3><span class="count">${list.length}名</span></div></div><div class="pad">
    <p class="small muted">ここに登録したメールアドレスの人だけがログイン後にデータを見られます。Googleログインの場合はGoogleアカウントのメールアドレスを登録してください。<br>「管理者」はメンバーの追加・変更・削除ができます。「メンバー」はデータの閲覧・編集のみです</p>
    ${err ? `<p class="state-line warn">${icon('alert')}${esc(err)}</p>` : ''}
    <ul class="member-list">${list.map(m => { const me = m.email === (cloud.user || '').toLowerCase(); return `<li data-member="${esc(m.email)}"><span class="avatar sm">${esc((m.name || m.email).slice(0, 1))}</span><b>${esc(m.name || '')}</b><span>${esc(m.email)}</span>
      ${admin && !me ? `<select data-member-role>${opts([['member', 'メンバー'], ['admin', '管理者']], m.role)}</select>` : `<span class="tag ${m.role === 'admin' ? 'st-peach' : 'st-blue'}">${m.role === 'admin' ? '管理者' : 'メンバー'}</span>`}
      ${me ? '<span class="tag st-green">あなた</span>' : admin ? `<span class="grow"></span><button class="btn xs danger ghost" data-member-del>${icon('trash')}外す</button>` : ''}</li>`; }).join('')}</ul>
    ${admin ? `<div class="member-add"><input id="m-name" placeholder="名前（例：代表 山田）"><input id="m-email" type="email" placeholder="メールアドレス（Gmail など）"><select id="m-role">${opts([['member', 'メンバー'], ['admin', '管理者']], 'member')}</select><button class="btn primary" data-member-add>${icon('plus')}追加</button></div>` : '<p class="small muted">メンバーの追加・削除は管理者に依頼してください</p>'}</div>`;
}

function drawData() {
  $('#s-data').innerHTML = `<div class="panel-head"><div>${icon('download')}<h3>バックアップ・CSV出力</h3></div></div><div class="pad">
    <p class="small muted">バックアップ(JSON)は全データを1ファイルに保存します。CSVはExcelで開けます</p>
    <div class="btn-col">
      <button class="btn" data-export-json>${icon('download')}バックアップを保存（JSON）</button>
      <label class="btn">${icon('upload')}バックアップから復元<input type="file" accept=".json,application/json" data-import hidden></label>
      <button class="btn" data-csv="apps">${icon('download')}応募一覧をCSV出力</button>
      <button class="btn" data-csv="events">${icon('download')}予定（面接・面談）をCSV出力</button>
    </div><p class="small muted">全レコード数：${store.count()}件</p></div>`;
}

function drawStatus() {
  const box = $('#s-status');
  if (!box) return;
  const list = statuses();
  const used = id => applications().filter(a => a.statusId === id).length;
  box.innerHTML = `<div class="panel-head"><div>${icon('list')}<h3>選考ステータスの管理</h3><span class="count">${list.length}件</span></div><button class="btn sm" data-st-add>${icon('plus')}ステータスを追加</button></div>
    <p class="pad small muted">名前をクリックで変更できます（変更は全応募に反映）。「集計区分」はトップページのどのカードで数えるかを決めます</p>
    <div class="table-wrap"><table class="simple-table st-table"><thead><tr><th>順番</th><th>ステータス名</th><th>集計区分</th><th>色</th><th>使用中</th><th></th></tr></thead><tbody>
    ${list.map((s, i) => `<tr data-st="${esc(s.id)}"><td class="nowrap"><button class="icon-btn sm" data-up ${i === 0 ? 'disabled' : ''}>▲</button><button class="icon-btn sm" data-down ${i === list.length - 1 ? 'disabled' : ''}>▼</button></td>
      <td class="edit" data-st-name><b>${esc(s.name)}</b></td>
      <td><select data-st-stage>${opts(stageOptions(), s.stage)}</select></td>
      <td><select data-st-color class="status-sel st-${s.color || STAGES[s.stage]?.color}">${opts([['', '自動'], ...COLORS.map(c => [c, c])], s.color || '')}</select></td>
      <td>${used(s.id)}件</td><td><button class="icon-btn sm" data-st-del title="削除">${icon('trash')}</button></td></tr>`).join('')}</tbody></table></div>`;
}

function drawDemo() {
  const n = demoCount();
  $('#s-demo').innerHTML = `<div class="panel-head"><div>${icon('sparkle')}<h3>テスト用ダミーデータ</h3></div></div><div class="pad">
    <p class="small">${n ? `ダミーデータが <b>${n}件</b> 入っています。本番利用の前に削除してください（自分で入力したデータは消えません）` : 'ダミーデータは入っていません'}</p>
    <div class="btn-row">${n ? `<button class="btn danger" data-demo-del>${icon('trash')}ダミーデータを削除</button>` : `<button class="btn" data-demo-add>${icon('plus')}ダミーデータを入れる</button>`}</div></div>`;
}

function drawTrash() {
  const list = store.trash().sort((a, b) => (b.deletedAt || '').localeCompare(a.deletedAt || ''));
  $('#s-trash').innerHTML = `<div class="panel-head"><div>${icon('trash')}<h3>ゴミ箱（削除したデータの復元）</h3><span class="count">${list.length}件</span></div></div>
    ${list.length ? `<ul class="trash-list">${list.map(r => `<li data-tr="${esc(r.id)}"><span class="tag">${esc(KIND_LABEL[r.kind] || r.kind)}</span><b>${esc(recordLabel(r))}</b><small class="muted">${esc(new Date(r.deletedAt).toLocaleString('ja-JP'))}</small><span class="grow"></span>
      <button class="btn xs" data-restore>${icon('restore')}復元</button><button class="btn xs danger ghost" data-purge>完全に削除</button></li>`).join('')}</ul>` : '<p class="pad muted small">ゴミ箱は空です</p>'}`;
}

async function onClick(e) {
  const t = e.target;
  if (t.closest('[data-connect]')) {
    const url = $('#cf-url').value, key = $('#cf-key').value;
    if (/service_role|sb_secret_/.test(key)) return toast('それは秘密鍵です。Publishable（anon）key を貼ってください', 'err');
    try { await testConnection(url, key); } catch (err) { return toast(err.message, 'err'); }
    saveConfig(url, key);
    toast('接続しました。ログインしてください');
    setTimeout(() => location.reload(), 600);
  }
  if (t.closest('[data-sync]')) { await syncNow(); toast(cloud.status === 'ok' ? '同期しました' : cloud.message || '同期できませんでした', cloud.status === 'ok' ? 'ok' : 'err'); drawCloud(); }
  if (t.closest('[data-logout]')) {
    if (store.pendingIds().length && !await confirmDialog('まだ送信されていない変更があります。ログアウトしますか？', { ok: 'ログアウト', detail: 'この端末に変更は残ります' })) return;
    await signOut(); location.reload();
  }
  if (t.closest('[data-unlink]')) { if (await confirmDialog('クラウド接続の設定を外しますか？', { ok: '外す', detail: 'クラウドのデータは消えません' })) { await signOut(); clearConfig(); location.reload(); } }
  if (t.closest('[data-export-json]')) {
    const all = [...['ca', 'candidate', 'company', 'application', 'event', 'status'].flatMap(k => store.list(k)), ...store.trash()];
    downloadFile(`選考進捗_バックアップ_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ app: 'ra-senko-kanri', version: 1, exportedAt: new Date().toISOString(), records: all }, null, 1), 'application/json');
    toast('バックアップを保存しました');
  }
  const csv = t.closest('[data-csv]');
  if (csv) csv.dataset.csv === 'apps' ? exportAppsCsv() : exportEventsCsv();
  if (t.closest('[data-demo-add]')) { await insertDemo(); toast('ダミーデータを入れました'); }
  if (t.closest('[data-demo-del]')) {
    if (await confirmDialog('ダミーデータをすべて削除しますか？', { detail: '自分で登録したデータは残ります。ダミーデータはゴミ箱を経由せず完全に削除されます' })) { await removeDemo(); toast('ダミーデータを削除しました'); }
  }
  const tr = t.closest('[data-tr]');
  if (tr && t.closest('[data-restore]')) { await store.restore(tr.dataset.tr); toast('復元しました'); }
  if (tr && t.closest('[data-purge]')) {
    if (await confirmDialog('完全に削除しますか？', { detail: 'この操作は元に戻せません' })) { await store.purge(tr.dataset.tr); toast('完全に削除しました'); }
  }
  if (t.closest('[data-member-add]')) {
    const email = $('#m-email').value.trim(), name = $('#m-name').value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast('メールアドレスを正しく入力してください', 'err');
    try { await addMember(email, name, $('#m-role').value); toast(`${email} を追加しました。この人はログインすると利用できます`); drawMembers(); } catch (err) { toast(err.message, 'err'); }
  }
  const mem = t.closest('[data-member]');
  if (mem && t.closest('[data-member-del]')) {
    if (!await confirmDialog(`${mem.dataset.member} をメンバーから外しますか？`, { ok: '外す', detail: 'この人はデータを見られなくなります（データ自体は消えません）' })) return;
    try { await removeMember(mem.dataset.member); toast('メンバーから外しました'); drawMembers(); } catch (err) { toast(err.message, 'err'); }
  }
  const st = t.closest('[data-st]');
  if (st) {
    const list = statuses();
    const i = list.findIndex(s => s.id === st.dataset.st);
    if (t.closest('[data-up]') || t.closest('[data-down]')) {
      const j = t.closest('[data-up]') ? i - 1 : i + 1;
      const a = list[i], b = list[j];
      await store.patch(a.id, { order: b.order });
      await store.patch(b.id, { order: a.order === b.order ? b.order + 1 : a.order });
    }
    if (t.closest('[data-st-name]')) openPopover(t.closest('[data-st-name]'), { label: 'ステータス名', value: list[i].name, allowClear: false, onSave: v => v && store.patch(list[i].id, { name: v }).then(() => toast('名前を変更しました（全応募に反映）')) });
    if (t.closest('[data-st-del]')) removeRecord(list[i]);
  }
  if (t.closest('[data-st-add]')) {
    const max = Math.max(0, ...statuses().map(s => s.order || 0));
    openPopover(t.closest('[data-st-add]'), { label: '新しいステータス名', allowClear: false, onSave: v => v && store.save('status', { name: v, stage: 'other', order: max + 1 }).then(() => toast('追加しました。集計区分を選んでください')) });
  }
}

async function onChange(e) {
  const t = e.target;
  const st = t.closest('[data-st]');
  const mem = t.closest('[data-member]');
  if (mem && t.matches('[data-member-role]')) {
    try { await setMemberRole(mem.dataset.member, t.value); toast('権限を変更しました'); } catch (err) { toast(err.message, 'err'); }
    drawMembers();
  }
  if (st && t.matches('[data-st-stage]')) { await store.patch(st.dataset.st, { stage: t.value }); toast('集計区分を変更しました'); }
  if (st && t.matches('[data-st-color]')) { await store.patch(st.dataset.st, { color: t.value }); toast('色を変更しました'); }
  if (t.matches('[data-import]') && t.files[0]) {
    try {
      const json = JSON.parse(await t.files[0].text());
      if (json.app !== 'ra-senko-kanri' || !Array.isArray(json.records)) throw new Error('このアプリのバックアップファイルではありません');
      if (!await confirmDialog(`${json.records.length}件のデータを復元しますか？`, { ok: '復元する', danger: false, detail: '同じデータがある場合はバックアップの内容で上書きされます。バックアップにないデータは消えません' })) return;
      await store.saveMany(json.records.filter(r => r.id && r.kind));
      await ensureStatuses();
      toast('復元しました');
    } catch (err) { toast('復元できませんでした：' + err.message, 'err'); }
    t.value = '';
  }
}

const csvCell = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const toCsv = rows => '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n');
function exportAppsCsv() {
  const head = ['担当CA', '求職者名', '応募企業名', '応募日', '選考ステータス', '面接日時', '面接回次', '面接形式', 'オファー面談日時', 'オファー面談形式', '内定日', '内定承諾期限', '内定承諾日', '入社予定日', '次回定期面談日時', 'CAリマインド', '次回対応予定日', '次回対応内容', '備考', '更新日時'];
  const ev = e => e ? `${e.date} ${fmtTimeRange(e)}`.trim() : '';
  const rows = applications().map(appRow).map(r => [r.caName, r.candName, r.companyName, r.app.appliedAt, r.statusName, ev(r.interview), r.interview?.round, r.interview?.format, ev(r.offer), r.offer?.format,
    r.app.offerDate, (r.app.acceptDeadline || '').replace('T', ' '), r.app.acceptedDate, r.app.joinDate, ev(r.followup), r.remindTarget ? (r.remindTarget.reminded ? '済' : '未') : '',
    r.app.nextActionDate, r.app.nextActionNote, r.app.memo, new Date(r.app.updatedAt).toLocaleString('ja-JP')]);
  downloadFile(`応募一覧_${new Date().toISOString().slice(0, 10)}.csv`, toCsv([head, ...rows]), 'text/csv');
  toast('CSVを出力しました');
}
function exportEventsCsv() {
  const head = ['種類', '日付', '開始', '終了', '求職者名', '担当CA', '企業名', '回次/タイトル', '形式', '結果/状況', 'CAリマインド', 'リマインド実施日', 'メモ', '次回面談予定日'];
  const label = { interview: '面接', offer: 'オファー面談', followup: '定期面談', task: 'その他' };
  const rows = store.list('event').sort((a, b) => (a.date || '').localeCompare(b.date || '')).map(e => {
    const c = store.getAny(e.candidateId);
    return [label[e.type], e.date, e.start, e.end, c?.name, nameOf(c?.caId), nameOf(store.getAny(e.applicationId)?.companyId), e.round || e.title, e.format, e.result || e.state || (e.done ? '完了' : ''), e.reminded ? '済' : '未', e.remindedDate, e.memo, e.nextDate];
  });
  downloadFile(`予定一覧_${new Date().toISOString().slice(0, 10)}.csv`, toCsv([head, ...rows]), 'text/csv');
  toast('CSVを出力しました');
}
