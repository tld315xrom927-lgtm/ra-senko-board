// 業務ルール（ステータス・日付・ダッシュボード集計・カレンダー予定・要対応リスト）
import { store } from './store.js';

// ---------- ステータス ----------
// stage: ダッシュボードの集計区分。ステータスを追加するときはどれかの区分を選ぶ
export const STAGES = {
  prep:      { label: '推薦準備',     color: 'gray' },
  doc:       { label: '書類選考',     color: 'lilac' },
  interview: { label: '面接予定',     color: 'blue' },
  waiting:   { label: '面接結果待ち', color: 'yellow' },
  offer:     { label: '内定',         color: 'pink' },
  accepted:  { label: '内定承諾済み', color: 'peach' },
  joining:   { label: '入社予定',     color: 'mint' },
  joined:    { label: '入社済み',     color: 'green' },
  closed:    { label: '見送り・辞退', color: 'mute' },
  other:     { label: 'その他',       color: 'gray' },
};
export const CLOSED_STAGES = ['joined', 'closed'];   // 「過去・終了済み」扱い

export const DEFAULT_STATUSES = [
  ['応募前・推薦準備中', 'prep'], ['書類選考中', 'doc'], ['書類通過', 'interview'], ['書類見送り', 'closed'],
  ['面接日程調整中', 'interview'], ['面接予定', 'interview'], ['面接結果待ち', 'waiting'], ['面接通過', 'interview'],
  ['面接見送り', 'closed'], ['内定', 'offer'], ['オファー面談予定', 'offer'], ['内定承諾待ち', 'offer'],
  ['内定承諾済み', 'accepted'], ['内定辞退', 'closed'], ['入社待ち', 'joining'], ['入社済み', 'joined'],
  ['入社辞退', 'closed'], ['選考終了', 'closed'], ['その他', 'other'],
].map(([name, stage], i) => ({ id: 'st_' + String(i + 1).padStart(2, '0'), kind: 'status', name, stage, order: i + 1 }));

export async function ensureStatuses() {
  // 一度も作られていなければ初期ステータスを登録（ゴミ箱に入れたものは復活させない）
  const missing = DEFAULT_STATUSES.filter(s => !store.getAny(s.id));
  if (missing.length === DEFAULT_STATUSES.length) await store.saveMany(missing);
}
export const statuses = () => store.list('status').sort((a, b) => (a.order || 0) - (b.order || 0));
export const statusOf = app => store.getAny(app?.statusId);
export const stageOf = app => statusOf(app)?.stage || 'other';
export const statusColor = st => st?.color || STAGES[st?.stage]?.color || 'gray';
export const isClosed = app => CLOSED_STAGES.includes(stageOf(app));

export const DASH_CARDS = [
  { key: 'all',       label: '応募総数',     icon: 'list',     color: 'peach' },
  { key: 'doc',       label: '書類選考中',   icon: 'file',     color: 'lilac' },
  { key: 'interview', label: '面接予定',     icon: 'calendar', color: 'blue' },
  { key: 'waiting',   label: '面接結果待ち', icon: 'clock',    color: 'yellow' },
  { key: 'offer',     label: '内定',         icon: 'sparkle',  color: 'pink' },
  { key: 'accepted',  label: '内定承諾済み', icon: 'heart',    color: 'peach' },
  { key: 'joining',   label: '入社予定',     icon: 'briefcase', color: 'mint' },
  { key: 'joined',    label: '入社済み',     icon: 'check',    color: 'green' },
  { key: 'closed',    label: '見送り・辞退', icon: 'x',        color: 'mute' },
];

// ---------- 日付 ----------
const pad = n => String(n).padStart(2, '0');
export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => ymd(new Date());
export const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
export function parseYmd(s) { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); }
export const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 86400000);
const WD = ['日', '月', '火', '水', '木', '金', '土'];
export function fmtDate(s, { year = false } = {}) {
  if (!s) return '';
  const d = parseYmd(s);
  return `${year ? d.getFullYear() + '/' : ''}${d.getMonth() + 1}/${d.getDate()}(${WD[d.getDay()]})`;
}
export function fmtDateTime(dt) {   // 'YYYY-MM-DDTHH:MM'
  if (!dt) return '';
  const [d, t] = dt.split('T');
  return fmtDate(d) + (t ? ' ' + t.slice(0, 5) : '');
}
export const fmtTimeRange = ev => ev.start ? `${ev.start}${ev.end ? '–' + ev.end : ''}` : '';
export function relDay(s) {
  const n = daysBetween(today(), s.slice(0, 10));
  return n === 0 ? '今日' : n === 1 ? '明日' : n === -1 ? '昨日' : n > 0 ? `${n}日後` : `${-n}日前`;
}

// ---------- 名前の参照（IDで結びつけているので、名前を変えると全体に反映される） ----------
export const nameOf = id => { const r = store.getAny(id); return r ? (r.name || '') + (r.deleted ? '（削除済み）' : '') : ''; };
export const candidateOf = app => store.getAny(app?.candidateId);
export const caIdOf = app => candidateOf(app)?.caId || '';
export const applications = () => store.list('application');
export const events = () => store.list('event');

// 予定の種類
export const EVENT_TYPES = {
  interview: { label: '面接',         color: 'blue',   icon: 'users' },
  offer:     { label: 'オファー面談', color: 'pink',   icon: 'sparkle' },
  followup:  { label: '定期面談',     color: 'mint',   icon: 'coffee' },
  deadline:  { label: '内定承諾期限', color: 'red',    icon: 'alert' },
  join:      { label: '入社予定日',   color: 'green',  icon: 'briefcase' },
  action:    { label: '対応予定',     color: 'yellow', icon: 'flag' },
  task:      { label: 'その他の予定', color: 'lilac',  icon: 'bookmark' },
};
export const ROUNDS = ['一次', '二次', '三次', '最終', 'カジュアル面談', 'その他'];
export const INTERVIEW_RESULTS = ['予定', '結果待ち', '通過', '見送り', 'キャンセル'];
export const FOLLOWUP_STATES = ['予定', '完了', 'キャンセル'];
export const FORMATS_SIMPLE = ['オンライン', '対面'];
export const FORMATS_FOLLOWUP = ['Zoom', '電話', '対面', 'その他'];

export const isActiveEvent = ev => !['キャンセル', '完了'].includes(ev.state) && ev.result !== 'キャンセル' && !ev.done;
const evKey = ev => (ev.date || '') + 'T' + (ev.start || '99:99');

export function eventsFor({ applicationId, candidateId, type }) {
  return events().filter(e => (!type || e.type === type)
    && (!applicationId || e.applicationId === applicationId)
    && (!candidateId || e.candidateId === candidateId)).sort((a, b) => evKey(a).localeCompare(evKey(b)));
}
// 今日以降の直近の予定。なければ一番最近の過去の予定
export function nextOrLast(list) {
  const t = today();
  const live = list.filter(e => e.date && isActiveEvent(e));
  return live.find(e => e.date >= t) || [...list].filter(e => e.date).reverse().find(e => e.result !== 'キャンセル' && e.state !== 'キャンセル') || null;
}
export const nextUpcoming = list => list.find(e => e.date && e.date >= today() && isActiveEvent(e)) || null;

// 応募1件の一覧表示用データ
export function appRow(app) {
  const cand = candidateOf(app);
  const st = statusOf(app);
  const interviews = eventsFor({ applicationId: app.id, type: 'interview' });
  const offers = eventsFor({ applicationId: app.id, type: 'offer' });
  const followups = cand ? eventsFor({ candidateId: cand.id, type: 'followup' }) : [];
  const interview = nextOrLast(interviews);
  const offer = nextOrLast(offers);
  const followup = isClosed(app) && stageOf(app) !== 'joined' ? null : nextUpcoming(followups);
  // リマインド対象＝この応募に関係する、今日以降で一番近い予定
  const remindTarget = [nextUpcoming(interviews), nextUpcoming(offers), followup].filter(Boolean).sort((a, b) => evKey(a).localeCompare(evKey(b)))[0] || null;
  return {
    app, cand, st,
    caId: cand?.caId || '',
    caName: nameOf(cand?.caId),
    candName: cand?.name || '（求職者未設定）',
    companyName: nameOf(app.companyId) || '（企業未設定）',
    statusName: st ? st.name + (st.deleted ? '（削除済み）' : '') : '未設定',
    stage: st?.stage || 'other',
    interview, interviewCount: interviews.length, offer, followup, remindTarget,
  };
}

// ---------- カレンダーに出す予定（応募の日付項目も予定として扱う） ----------
export function calendarItems({ caId = '', companyId = '', types = null } = {}) {
  const out = [];
  const appOk = app => app && (!caId || caIdOf(app) === caId) && (!companyId || app.companyId === companyId);
  for (const ev of events()) {
    if (!ev.date) continue;
    const app = store.get(ev.applicationId);
    const cand = store.getAny(ev.candidateId || app?.candidateId);
    if (caId && cand?.caId !== caId) continue;
    if (companyId && app?.companyId !== companyId) continue;
    const t = EVENT_TYPES[ev.type] || EVENT_TYPES.task;
    const sub = ev.type === 'interview' ? (ev.round || '面接') : ev.type === 'followup' ? '定期面談' : ev.type === 'task' ? (ev.title || '予定') : t.label;
    out.push({
      key: ev.id, type: ev.type, date: ev.date, start: ev.start || '', end: ev.end || '',
      title: `${cand?.name || ev.title || '予定'}${app ? '／' + nameOf(app.companyId) : ''}`,
      sub, ev, app, cand, cancelled: !isActiveEvent(ev) && (ev.state === 'キャンセル' || ev.result === 'キャンセル'),
      done: ev.state === '完了' || ev.done,
    });
  }
  for (const app of applications()) {
    if (!appOk(app)) continue;
    const cand = candidateOf(app);
    const base = { app, cand, title: `${cand?.name || ''}／${nameOf(app.companyId)}` };
    const closed = isClosed(app);
    if (app.acceptDeadline && !['accepted', 'joining', 'joined'].includes(stageOf(app)) && !closed) {
      const [d, t] = app.acceptDeadline.split('T');
      out.push({ ...base, key: app.id + ':deadline', type: 'deadline', date: d, start: t || '', end: '', sub: '内定承諾期限', field: 'acceptDeadline' });
    }
    if (app.joinDate && ['accepted', 'joining', 'joined'].includes(stageOf(app))) {
      out.push({ ...base, key: app.id + ':join', type: 'join', date: app.joinDate, start: '', end: '', sub: '入社予定日', field: 'joinDate' });
    }
    if (app.nextActionDate && !closed) {
      out.push({ ...base, key: app.id + ':action', type: 'action', date: app.nextActionDate, start: '', end: '', sub: app.nextActionNote || '次回対応', field: 'nextActionDate' });
    }
  }
  return out.filter(i => !types || types.includes(i.type))
    .sort((a, b) => (a.date + (a.start || '00:00')).localeCompare(b.date + (b.start || '00:00')));
}

// ---------- 要対応リスト ----------
// level: red（至急）/ orange（近い）/ yellow（注意）
export function actionItems() {
  const t = today(), tm = addDays(t, 1);
  const groups = {
    interview: { label: '本日・明日の面接', icon: 'users', items: [] },
    meeting:   { label: '本日・明日の面談', icon: 'coffee', items: [] },
    waiting:   { label: '面接結果待ち', icon: 'clock', items: [] },
    deadline:  { label: '内定承諾期限が近い', icon: 'alert', items: [] },
    remind:    { label: 'CAリマインド未対応', icon: 'bell', items: [] },
    overdue:   { label: '次回対応予定日を過ぎている', icon: 'flag', items: [] },
  };
  for (const ev of events()) {
    if (!ev.date || !isActiveEvent(ev)) continue;
    const app = store.get(ev.applicationId);
    if (ev.applicationId && !app) continue;
    const cand = store.getAny(ev.candidateId || app?.candidateId);
    const who = `${cand?.name || ''}${app ? '／' + nameOf(app.companyId) : ''}`;
    const when = `${relDay(ev.date)} ${fmtDate(ev.date)} ${fmtTimeRange(ev)}`;
    const ca = nameOf(cand?.caId);
    if (ev.date === t || ev.date === tm) {
      const g = ev.type === 'interview' ? 'interview' : ['offer', 'followup'].includes(ev.type) ? 'meeting' : null;
      if (g) groups[g].items.push({ level: ev.date === t ? 'red' : 'orange', title: who, sub: `${when}・${ev.type === 'interview' ? (ev.round || '面接') : EVENT_TYPES[ev.type].label}${ev.format ? '・' + ev.format : ''}`, ca, ev, app, cand, sort: evKey(ev) });
    }
    // 面接日を過ぎたのに結果が入っていない
    if (ev.type === 'interview' && ev.date < t && (ev.result || '予定') === '予定') {
      groups.waiting.items.push({ level: 'yellow', title: who, sub: `${fmtDate(ev.date)} ${ev.round || '面接'}の結果が未入力です`, ca, ev, app, cand, sort: ev.date });
    }
    // CA へのリマインド：定期面談は今日以降すべて、面接・オファー面談は3日以内
    const limit = ev.type === 'followup' ? '9999-12-31' : addDays(t, 3);
    if (!ev.reminded && ev.date >= t && ev.date <= limit && ['followup', 'interview', 'offer'].includes(ev.type)) {
      const n = daysBetween(t, ev.date);
      groups.remind.items.push({ level: n <= 1 ? 'red' : n <= 3 ? 'orange' : 'yellow', title: who, sub: `${EVENT_TYPES[ev.type].label} ${when}`, ca, ev, app, cand, remind: true, sort: evKey(ev) });
    }
  }
  for (const app of applications()) {
    if (isClosed(app)) continue;
    const r = appRow(app);
    const who = `${r.candName}／${r.companyName}`;
    if (r.stage === 'waiting' && !groups.waiting.items.some(i => i.app?.id === app.id)) {
      const last = r.interview;
      groups.waiting.items.push({ level: 'yellow', title: who, sub: last ? `${fmtDate(last.date)} ${last.round || '面接'}の結果待ち` : '面接結果待ち', ca: r.caName, app, cand: r.cand, sort: last?.date || '' });
    }
    if (app.acceptDeadline && ['offer', 'other'].includes(r.stage)) {
      const d = app.acceptDeadline.slice(0, 10);
      const n = daysBetween(t, d);
      if (n <= 7) groups.deadline.items.push({ level: n <= 1 ? 'red' : n <= 3 ? 'orange' : 'yellow', title: who, sub: `期限 ${fmtDateTime(app.acceptDeadline)}（${n < 0 ? '期限切れ' : relDay(d)}）`, ca: r.caName, app, cand: r.cand, sort: app.acceptDeadline });
    }
    if (app.nextActionDate && app.nextActionDate <= t) {
      const n = daysBetween(app.nextActionDate, t);
      groups.overdue.items.push({ level: n >= 1 ? 'red' : 'orange', title: who, sub: `${n >= 1 ? n + '日超過' : '今日が対応日'}：${app.nextActionNote || '次回対応'}`, ca: r.caName, app, cand: r.cand, sort: app.nextActionDate });
    }
  }
  Object.values(groups).forEach(g => g.items.sort((a, b) => (a.sort || '').localeCompare(b.sort || '')));
  return groups;
}

// ---------- 集計 ----------
export function stageCounts(apps = applications()) {
  const c = { all: apps.length };
  Object.keys(STAGES).forEach(k => { c[k] = 0; });
  apps.forEach(a => { c[stageOf(a)] = (c[stageOf(a)] || 0) + 1; });
  return c;
}
export function caStats(caId) {
  const cands = store.list('candidate').filter(c => c.caId === caId);
  const ids = new Set(cands.map(c => c.id));
  const apps = applications().filter(a => ids.has(a.candidateId));
  return {
    candidates: cands.length,
    active: apps.filter(a => !isClosed(a)).length,
    joined: apps.filter(a => ['accepted', 'joining', 'joined'].includes(stageOf(a))).length,
    apps,
  };
}
// 求職者が「対応中」か（対応中の応募が1件でもあれば対応中）
export const candidateActive = cand => applications().some(a => a.candidateId === cand.id && !isClosed(a)) || !applications().some(a => a.candidateId === cand.id);

// 関連レコード（削除時に一緒にゴミ箱へ）
export function childrenOf(rec) {
  if (rec.kind === 'application') return events().filter(e => e.applicationId === rec.id).map(e => e.id);
  if (rec.kind === 'candidate') {
    const apps = applications().filter(a => a.candidateId === rec.id).map(a => a.id);
    return [...apps, ...events().filter(e => e.candidateId === rec.id || apps.includes(e.applicationId)).map(e => e.id)];
  }
  if (rec.kind === 'company') {
    const apps = applications().filter(a => a.companyId === rec.id).map(a => a.id);
    return [...apps, ...events().filter(e => apps.includes(e.applicationId)).map(e => e.id)];
  }
  return [];
}
