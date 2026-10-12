// テスト用ダミーデータ（すべて架空。demo: true の印付きで、設定画面からまとめて削除できる）
import { store } from './store.js';
import { today, addDays } from './model.js';

export const demoCount = () => ['ca', 'candidate', 'company', 'application', 'event'].flatMap(k => store.list(k)).filter(r => r.demo).length
  + store.trash().filter(r => r.demo).length;

export async function removeDemo() {
  for (const r of [...['ca', 'candidate', 'company', 'application', 'event'].flatMap(k => store.list(k)), ...store.trash()].filter(r => r.demo)) {
    if (store.getAny(r.id)) await store.purge(r.id);
  }
}

export async function insertDemo() {
  const t = today();
  const d = n => addDays(t, n);
  const recs = [];
  const add = (kind, id, data) => recs.push({ kind, id: 'demo_' + id, demo: true, ...data });
  const cas = [['ca1', '佐藤 美咲'], ['ca2', '鈴木 健太'], ['ca3', '高橋 あかり'], ['ca4', '田中 翔']];
  cas.forEach(([id, name], i) => add('ca', id, { name, contact: `${['misaki', 'kenta', 'akari', 'sho'][i]}@example.com` }));
  const cos = [['co1', '株式会社ひだまりテック', '人事 木村'], ['co2', 'ミライ物流株式会社', '採用 松本'], ['co3', '株式会社ルミナ化粧品', '人事部 森'], ['co4', 'あおぞら不動産株式会社', '採用担当 林'],
    ['co5', '株式会社スマイルケア', '総務 池田'], ['co6', 'グリーンフード株式会社', '人事 山口'], ['co7', '株式会社ネクストデザイン', '代表 石井']];
  cos.forEach(([id, name, contactName]) => add('company', id, { name, contactName, contact: '03-0000-0000' }));
  const cands = [['c1', '山田 花子', 'やまだ はなこ', 'ca1'], ['c2', '伊藤 大輔', 'いとう だいすけ', 'ca1'], ['c3', '渡辺 さくら', 'わたなべ さくら', 'ca2'], ['c4', '中村 悠真', 'なかむら ゆうま', 'ca2'],
    ['c5', '小林 結衣', 'こばやし ゆい', 'ca3'], ['c6', '加藤 陽菜', 'かとう ひな', 'ca3'], ['c7', '吉田 蓮', 'よしだ れん', 'ca4'], ['c8', '山本 美月', 'やまもと みづき', 'ca4'],
    ['c9', '佐々木 湊', 'ささき みなと', 'ca1'], ['c10', '松田 杏', 'まつだ あん', 'ca2'], ['c11', '井上 拓海', 'いのうえ たくみ', 'ca3'], ['c12', '木下 葵', 'きのした あおい', 'ca4']];
  cands.forEach(([id, name, kana, ca]) => add('candidate', id, { name, kana, caId: 'demo_' + ca }));
  // [id, 求職者, 企業, ステータスID, 追加項目]
  const apps = [
    ['a1', 'c1', 'co1', 'st_06', { appliedAt: d(-14), nextActionDate: d(1), nextActionNote: '面接前の最終確認' }],
    ['a2', 'c1', 'co3', 'st_02', { appliedAt: d(-5), nextActionDate: d(-2), nextActionNote: '書類結果の催促' }],
    ['a3', 'c1', 'co5', 'st_09', { appliedAt: d(-30) }],
    ['a4', 'c2', 'co2', 'st_07', { appliedAt: d(-20), nextActionDate: d(0), nextActionNote: '面接結果の確認' }],
    ['a5', 'c3', 'co4', 'st_12', { appliedAt: d(-40), offerDate: d(-4), acceptDeadline: d(1) + 'T18:00', nextActionDate: d(0), nextActionNote: '承諾意思の確認' }],
    ['a6', 'c3', 'co6', 'st_14', { appliedAt: d(-38) }],
    ['a7', 'c4', 'co1', 'st_11', { appliedAt: d(-35), offerDate: d(-2), acceptDeadline: d(5) + 'T12:00' }],
    ['a8', 'c5', 'co3', 'st_13', { appliedAt: d(-60), offerDate: d(-20), acceptedDate: d(-15), joinDate: d(35), nextActionDate: d(7), nextActionNote: '入社書類の案内' }],
    ['a9', 'c6', 'co7', 'st_15', { appliedAt: d(-75), offerDate: d(-40), acceptedDate: d(-35), joinDate: d(12) }],
    ['a10', 'c7', 'co2', 'st_16', { appliedAt: d(-120), offerDate: d(-80), acceptedDate: d(-75), joinDate: d(-30) }],
    ['a11', 'c7', 'co4', 'st_14', { appliedAt: d(-118) }],
    ['a12', 'c8', 'co6', 'st_05', { appliedAt: d(-10), nextActionDate: d(2), nextActionNote: '面接候補日の回答' }],
    ['a13', 'c8', 'co1', 'st_02', { appliedAt: d(-3) }],
    ['a14', 'c9', 'co5', 'st_01', { nextActionDate: d(1), nextActionNote: '推薦文の作成' }],
    ['a15', 'c10', 'co7', 'st_08', { appliedAt: d(-18), nextActionDate: d(3), nextActionNote: '最終面接の日程調整' }],
    ['a16', 'c10', 'co3', 'st_04', { appliedAt: d(-15) }],
    ['a17', 'c11', 'co2', 'st_06', { appliedAt: d(-12) }],
    ['a18', 'c12', 'co4', 'st_03', { appliedAt: d(-9), nextActionDate: d(-1), nextActionNote: '面接日程の打診' }],
    ['a19', 'c12', 'co5', 'st_10', { appliedAt: d(-25), offerDate: d(-1), acceptDeadline: d(3) + 'T17:00' }],
    ['a20', 'c4', 'co7', 'st_17', { appliedAt: d(-50) }],
  ];
  apps.forEach(([id, c, co, st, x]) => add('application', id, { candidateId: 'demo_' + c, companyId: 'demo_' + co, statusId: st, ...x }));
  // 予定
  const iv = (id, app, cand, date, start, end, round, format, result, reminded) => add('event', id, { type: 'interview', applicationId: 'demo_' + app, candidateId: 'demo_' + cand, date, start, end, round, format, result, reminded, remindedDate: reminded ? d(-1) : '' });
  iv('e1', 'a1', 'c1', d(-6), '10:00', '11:00', '一次', 'オンライン', '通過', true);
  iv('e2', 'a1', 'c1', d(0), '14:00', '15:00', '二次', '対面', '予定', false);
  iv('e3', 'a4', 'c2', d(-2), '13:00', '14:00', '最終', '対面', '結果待ち', true);
  iv('e4', 'a5', 'c3', d(-12), '11:00', '12:00', '最終', '対面', '通過', true);
  iv('e5', 'a7', 'c4', d(-9), '16:00', '17:00', '最終', 'オンライン', '通過', true);
  iv('e6', 'a15', 'c10', d(-4), '10:30', '11:30', '二次', 'オンライン', '通過', true);
  iv('e7', 'a17', 'c11', d(1), '11:00', '12:00', '一次', 'オンライン', '予定', true);
  iv('e8', 'a17', 'c11', d(-3), '15:00', '15:30', 'カジュアル面談', 'オンライン', '予定', true);
  iv('e9', 'a3', 'c1', d(-20), '10:00', '11:00', '一次', 'オンライン', '見送り', true);
  iv('e10', 'a19', 'c12', d(-8), '13:00', '14:00', '最終', '対面', '通過', true);
  iv('e11', 'a12', 'c8', d(6), '10:00', '11:00', '一次', '対面', '予定', false);
  add('event', 'e12', { type: 'offer', applicationId: 'demo_a7', candidateId: 'demo_c4', date: d(1), start: '18:00', end: '19:00', format: 'オンライン', state: '予定', reminded: false });
  add('event', 'e13', { type: 'offer', applicationId: 'demo_a5', candidateId: 'demo_c3', date: d(-3), start: '17:00', end: '18:00', format: '対面', state: '完了', reminded: true, remindedDate: d(-4) });
  add('event', 'e14', { type: 'offer', applicationId: 'demo_a19', candidateId: 'demo_c12', date: d(0), start: '19:00', end: '20:00', format: 'オンライン', state: '予定', reminded: true, remindedDate: d(-1) });
  const fu = (id, cand, app, date, start, end, format, state, reminded, memo, nextDate) => add('event', id, { type: 'followup', candidateId: 'demo_' + cand, applicationId: 'demo_' + app, date, start, end, format, state, reminded, remindedDate: reminded ? d(-1) : '', memo, nextDate });
  fu('e15', 'c5', 'a8', d(-14), '19:00', '19:30', 'Zoom', '完了', true, '入社準備は順調。現職の引き継ぎ中', d(0));
  fu('e16', 'c5', 'a8', d(0), '19:00', '19:30', 'Zoom', '予定', false, '', '');
  fu('e17', 'c6', 'a9', d(2), '12:00', '12:30', '電話', '予定', false, '', '');
  fu('e18', 'c6', 'a9', d(-10), '12:00', '12:30', '電話', '完了', true, '入社前の不安を解消。研修日程を共有', d(2));
  fu('e19', 'c5', 'a8', d(14), '19:00', '19:30', 'Zoom', '予定', false, '', '');
  add('event', 'e20', { type: 'task', title: '推薦文の提出', applicationId: 'demo_a14', candidateId: 'demo_c9', date: d(1), start: '10:00', end: '', done: false });
  await store.saveMany(recs.map(r => ({ ...r, updatedAt: new Date().toISOString() })));
}
