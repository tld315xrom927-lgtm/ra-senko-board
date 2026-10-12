// データ保存の土台
// - すべてのデータは「レコード」（{id, kind, ...}）として保存する
//   kind: ca / candidate / company / application / event / status
// - この端末の IndexedDB に即保存 → クラウド（Supabase）が設定されていれば cloud.js が同期する
// - 削除は「ゴミ箱へ移動」（deleted: true）。ゴミ箱から復元・完全削除ができる

const DB_NAME = 'ra-senko-kanri';
const DB_VER = 1;

let db = null;
const recs = new Map();
const listeners = new Set();
let pending = new Set();   // クラウドへ未送信のID
let emitQueued = false;

function req(r) {
  return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('records')) d.createObjectStore('records', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta');
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
function idbPut(rec) {
  const t = db.transaction('records', 'readwrite');
  t.objectStore('records').put(rec);
  return new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
}
function idbDel(id) {
  const t = db.transaction('records', 'readwrite');
  t.objectStore('records').delete(id);
  return new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
}
export async function getMeta(key) {
  return req(db.transaction('meta').objectStore('meta').get(key));
}
export async function setMeta(key, value) {
  const t = db.transaction('meta', 'readwrite');
  t.objectStore('meta').put(value, key);
  return new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
}

export function uid(prefix = 'r') {
  const rnd = crypto.getRandomValues(new Uint32Array(2));
  return prefix + '_' + Date.now().toString(36) + rnd[0].toString(36) + rnd[1].toString(36).slice(0, 4);
}
const nowIso = () => new Date().toISOString();

function emit() {
  if (emitQueued) return;
  emitQueued = true;
  queueMicrotask(() => { emitQueued = false; listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); });
}

let onLocalChange = () => {};   // cloud.js が差し込む（変更をクラウドへ送る）

async function markPending(id) {
  pending.add(id);
  await setMeta('pending', [...pending]);
  onLocalChange();
}

export const store = {
  async init() {
    db = await openDB();
    const all = await req(db.transaction('records').objectStore('records').getAll());
    all.forEach(r => recs.set(r.id, r));
    pending = new Set((await getMeta('pending')) || []);
  },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  setSyncHook(fn) { onLocalChange = fn; },

  get(id) { const r = recs.get(id); return r && !r.deleted ? r : null; },
  getAny(id) { return recs.get(id) || null; },
  list(kind) { const out = []; for (const r of recs.values()) if (r.kind === kind && !r.deleted) out.push(r); return out; },
  trash() { return [...recs.values()].filter(r => r.deleted && !r.deletedWith); },
  count() { return recs.size; },

  // 追加・更新（data.id があれば更新）
  async save(kind, data) {
    const old = data.id ? recs.get(data.id) : null;
    const t = nowIso();
    const rec = { ...(old || {}), ...data, kind, id: data.id || uid(kind.slice(0, 3)), createdAt: old?.createdAt || t, updatedAt: t };
    recs.set(rec.id, rec);
    emit();
    await idbPut(rec);
    await markPending(rec.id);
    return rec;
  },
  async patch(id, changes) {
    const old = recs.get(id);
    if (!old) return null;
    return store.save(old.kind, { ...old, ...changes, id });
  },
  // まとめて保存（ダミーデータ投入など）
  async saveMany(list) {
    const t = nowIso();
    for (const d of list) {
      const old = recs.get(d.id);
      const rec = { ...(old || {}), ...d, createdAt: old?.createdAt || t, updatedAt: t };
      recs.set(rec.id, rec);
      await idbPut(rec);
      pending.add(rec.id);
    }
    await setMeta('pending', [...pending]);
    emit();
    onLocalChange();
  },

  // ゴミ箱へ移動。children: 一緒にゴミ箱へ入れる関連レコードのID
  async remove(id, children = []) {
    const t = nowIso();
    const r = recs.get(id);
    if (!r) return;
    await store.saveMany([
      { ...r, deleted: true, deletedAt: t, deletedWith: null },
      ...children.map(cid => recs.get(cid)).filter(c => c && !c.deleted).map(c => ({ ...c, deleted: true, deletedAt: t, deletedWith: id })),
    ]);
  },
  async restore(id) {
    const list = [...recs.values()].filter(r => r.id === id || r.deletedWith === id);
    await store.saveMany(list.map(r => ({ ...r, deleted: false, deletedAt: null, deletedWith: null })));
  },
  // 完全削除（中身を消し、他の端末にも消したことが伝わるよう印だけ残す）
  async purge(id) {
    const list = [...recs.values()].filter(r => r.id === id || r.deletedWith === id);
    for (const r of list) {
      const tomb = { id: r.id, kind: r.kind, purged: true, deleted: true, updatedAt: nowIso() };
      recs.delete(r.id);
      await idbDel(r.id);
      purgedQueue.set(r.id, tomb);
      pending.add(r.id);
    }
    await setMeta('pending', [...pending]);
    await setMeta('purged', [...purgedQueue.values()]);
    emit();
    onLocalChange();
  },

  // ---- 以下は cloud.js 用 ----
  pendingIds() { return [...pending]; },
  pendingRecord(id) { return recs.get(id) || purgedQueue.get(id) || null; },
  async clearPending(ids, sentUpdatedAt) {
    for (const id of ids) {
      const r = recs.get(id) || purgedQueue.get(id);
      // 送信中に再編集されたものは残す
      if (!r || r.updatedAt === sentUpdatedAt[id]) { pending.delete(id); purgedQueue.delete(id); }
    }
    await setMeta('pending', [...pending]);
    await setMeta('purged', [...purgedQueue.values()]);
  },
  // クラウドから届いたレコードを反映。新しい方を採用
  async applyRemote(list) {
    let changed = false;
    for (const r of list) {
      const local = recs.get(r.id);
      if (pending.has(r.id) && local && local.updatedAt > (r.updatedAt || '')) continue;
      if (r.purged) {
        if (local) { recs.delete(r.id); await idbDel(r.id); changed = true; }
        continue;
      }
      if (local && local.updatedAt === r.updatedAt) continue;
      if (local && (local.updatedAt || '') > (r.updatedAt || '')) continue;
      recs.set(r.id, r);
      await idbPut(r);
      changed = true;
    }
    if (changed) emit();
    return changed;
  },
  async loadPurgedQueue() {
    ((await getMeta('purged')) || []).forEach(t => purgedQueue.set(t.id, t));
  },
  // ログアウト時：この端末のコピーを消す（クラウドのデータはそのまま）
  async wipeLocal() {
    recs.clear();
    pending.clear();
    purgedQueue.clear();
    const t = db.transaction(['records', 'meta'], 'readwrite');
    t.objectStore('records').clear();
    t.objectStore('meta').clear();
    await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); });
    emit();
  },
  emit,
};
const purgedQueue = new Map();
