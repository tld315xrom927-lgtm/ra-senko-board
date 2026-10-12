// 画面部品（アイコン・モーダル・確認ダイアログ・トースト・セル編集ポップアップ・下書き）

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ---------- アイコン（線画SVG） ----------
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.8a3.3 3.3 0 0 1 0 6.4M18 14.8c1.9.7 3.1 2.4 3.5 5.2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4.2 3.8-6.5 8-6.5s7.2 2.3 8 6.5"/>',
  building: '<rect x="4" y="3" width="11" height="18" rx="1.5"/><path d="M15 9h4a1 1 0 0 1 1 1v11H15M8 7h3M8 11h3M8 15h3"/>',
  coffee: '<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3c-.8 1 .8 2 0 3M12 3c-.8 1 .8 2 0 3"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  sparkle: '<path d="M12 3c.6 4.4 2.6 6.4 7 7-4.4.6-6.4 2.6-7 7-.6-4.4-2.6-6.4-7-7 4.4-.6 6.4-2.6 7-7z"/><path d="M19 15c.2 1.6 1 2.4 2.5 2.5-1.6.2-2.3 1-2.5 2.5-.2-1.6-1-2.3-2.5-2.5 1.6-.2 2.3-1 2.5-2.5z"/>',
  heart: '<path d="M12 20s-7.5-4.6-8.8-9.2C2.3 7.6 4.4 4.8 7.4 4.8c2 0 3.6 1.2 4.6 2.8 1-1.6 2.6-2.8 4.6-2.8 3 0 5.1 2.8 4.2 6C19.5 15.4 12 20 12 20z"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 12.5h18"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  chevL: '<path d="m15 18-6-6 6-6"/>', chevR: '<path d="m9 18 6-6-6-6"/>', chevD: '<path d="m6 9 6 6 6-6"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M4 20h16"/>',
  upload: '<path d="M12 16V5M7 9.5l5-5 5 5M4 20h16"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5L20 16M20 20v-4h-4"/>',
  cloud: '<path d="M7 18a4.5 4.5 0 0 1-.5-9 6 6 0 0 1 11.4 1.5A4 4 0 0 1 17.5 18z"/>',
  restore: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="m16 10 5-3v10l-5-3"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  filter: '<path d="M3 5h18l-7 8.5V20l-4-2v-4.5z"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  sort: '<path d="M8 4v16M4 8l4-4 4 4M16 20V4M12 16l4 4 4-4"/>',
};
export const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name] || P.sparkle}</svg>`;

// ---------- トースト ----------
export function toast(msg, type = 'ok') {
  let box = $('#toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.append(box); }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${icon(type === 'ok' ? 'check' : type === 'err' ? 'alert' : 'sparkle')}<span>${esc(msg)}</span>`;
  box.append(el);
  setTimeout(() => el.classList.add('out'), 2600);
  setTimeout(() => el.remove(), 3000);
}

// ---------- モーダル ----------
// openModal({title, sub, icon, body, foot, wide, onClose}) → {el, close}
export function openModal({ title, sub = '', icon: ic = 'sparkle', body = '', foot = '', wide = false, onClose } = {}) {
  const back = document.createElement('div');
  back.className = 'backdrop';
  back.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
    <div class="modal-head"><div><span class="mh-icon">${icon(ic)}</span><div><h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div></div>
    <button class="icon-btn" data-close aria-label="閉じる">${icon('x')}</button></div>
    <div class="modal-body">${body}</div>${foot ? `<footer class="modal-foot">${foot}</footer>` : ''}</div>`;
  document.body.append(back);
  document.body.classList.add('modal-open');
  let closed = false;
  const close = (reason) => {
    if (closed) return;
    closed = true;
    back.remove();
    if (!$('.backdrop')) document.body.classList.remove('modal-open');
    document.removeEventListener('keydown', onKey);
    onClose?.(reason);
  };
  const onKey = e => { if (e.key === 'Escape' && back === $$('.backdrop').at(-1) && !$('.popover')) close('esc'); };
  document.addEventListener('keydown', onKey);
  back.addEventListener('mousedown', e => { if (e.target === back) back.dataset.down = '1'; });
  back.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) close('x');
    else if (e.target === back && back.dataset.down === '1') close('backdrop');
    back.dataset.down = '';
  });
  setTimeout(() => $('input:not([type=hidden]):not([type=checkbox]),select,textarea', back)?.focus({ preventScroll: true }), 30);
  return { el: back, close };
}

// 確認ダイアログ（Promise<boolean>）
export function confirmDialog(message, { title = '確認', ok = '削除する', danger = true, detail = '' } = {}) {
  return new Promise(resolve => {
    let answered = false;
    const m = openModal({
      title, icon: danger ? 'alert' : 'sparkle',
      body: `<p class="confirm-msg">${esc(message)}</p>${detail ? `<p class="confirm-detail">${esc(detail)}</p>` : ''}`,
      foot: `<button class="btn" data-close>キャンセル</button><button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(ok)}</button>`,
      onClose: () => { if (!answered) resolve(false); },
    });
    m.el.classList.add('confirm');
    $('[data-ok]', m.el).addEventListener('click', () => { answered = true; m.close(); resolve(true); });
    setTimeout(() => $('[data-ok]', m.el).focus(), 40);
  });
}

// ---------- セル編集ポップアップ ----------
// field: {type: text/textarea/date/datetime/time/select/number, options:[[value,label]], value}
export function openPopover(anchor, { label, type = 'text', value = '', options = [], onSave, allowClear = true }) {
  closePopover();
  const pop = document.createElement('div');
  pop.className = 'popover';
  const v = esc(value ?? '');
  let input;
  if (type === 'select') input = `<select>${options.map(([val, lab]) => `<option value="${esc(val)}" ${String(val) === String(value ?? '') ? 'selected' : ''}>${esc(lab)}</option>`).join('')}</select>`;
  else if (type === 'textarea') input = `<textarea rows="4">${v}</textarea>`;
  else if (type === 'datetime') input = `<input type="datetime-local" value="${v}">`;
  else input = `<input type="${type}" value="${v}">`;
  pop.innerHTML = `<label>${esc(label)}</label>${input}<div class="pop-actions">${allowClear && type !== 'select' ? '<button class="btn sm ghost" data-clear>クリア</button>' : '<span></span>'}<div><button class="btn sm" data-cancel>取消</button><button class="btn sm primary" data-save>保存</button></div></div>`;
  document.body.append(pop);
  const r = anchor.getBoundingClientRect();
  const w = Math.max(240, Math.min(320, window.innerWidth - 16));
  pop.style.width = w + 'px';
  pop.style.left = Math.max(8, Math.min(r.left + window.scrollX, window.scrollX + window.innerWidth - w - 8)) + 'px';
  const below = r.bottom + 6 + 170 < window.innerHeight;
  pop.style.top = (below ? r.bottom + 6 : Math.max(8, r.top - 6 - 170)) + window.scrollY + 'px';
  const el = $('input,select,textarea', pop);
  el.focus();
  if (el.select && type === 'text') el.select();
  const save = async (val) => { closePopover(); await onSave(val); };
  $('[data-save]', pop).onclick = () => save(el.value);
  $('[data-cancel]', pop).onclick = closePopover;
  $('[data-clear]', pop)?.addEventListener('click', () => save(''));
  if (type === 'select') el.addEventListener('change', () => save(el.value));
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter' && type !== 'textarea' && !e.isComposing) { e.preventDefault(); save(el.value); }
    if (e.key === 'Escape') { e.stopPropagation(); closePopover(); }
  });
  setTimeout(() => document.addEventListener('mousedown', outside), 0);
}
function outside(e) { if (!e.target.closest('.popover')) closePopover(); }
export function closePopover() {
  $('.popover')?.remove();
  document.removeEventListener('mousedown', outside);
}

// ---------- フォーム ----------
export function formData(root) {
  const out = {};
  $$('[name]', root).forEach(el => {
    if (el.type === 'checkbox') out[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
    else out[el.name] = el.value.trim();
  });
  return out;
}
export const opts = (list, selected, { empty = null } = {}) =>
  (empty !== null ? `<option value="">${esc(empty)}</option>` : '') +
  list.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(selected ?? '') ? 'selected' : ''}>${esc(l)}</option>`).join('');

// 入力途中の下書き（localStorage）。保存・キャンセル確定で消す
export const draft = {
  key: k => 'ra-draft:' + k,
  load(k) { try { return JSON.parse(localStorage.getItem(this.key(k)) || 'null'); } catch { return null; } },
  save(k, data) { localStorage.setItem(this.key(k), JSON.stringify({ ...data, _at: Date.now() })); },
  clear(k) { localStorage.removeItem(this.key(k)); },
  // フォームの入力を自動で下書き保存する
  bind(k, root) {
    const handler = () => this.save(k, formData(root));
    root.addEventListener('input', handler);
    root.addEventListener('change', handler);
  },
  fill(root, data) {
    if (!data) return;
    $$('[name]', root).forEach(el => {
      if (!(el.name in data)) return;
      if (el.type === 'checkbox') el.checked = !!data[el.name];
      else if (el.type === 'radio') el.checked = el.value === data[el.name];
      else el.value = data[el.name];
    });
  },
};

export function downloadFile(name, text, type = 'text/plain') {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
