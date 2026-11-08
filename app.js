'use strict';
/* Bütçem – tek dosyalık mantık. Veri sadece telefondaki localStorage'da durur. */

const KEY = 'butce_v1';
const $ = s => document.querySelector(s);

/* ---------- kategoriler ---------- */
const CATS = [
  { id: 'yemek', n: 'Yemek', e: '🍔', c: '#f59e0b' },
  { id: 'market', n: 'Market', e: '🛒', c: '#10b981' },
  { id: 'ulasim', n: 'Ulaşım', e: '🚌', c: '#3b82f6' },
  { id: 'eglence', n: 'Eğlence', e: '🎬', c: '#a855f7' },
  { id: 'fatura', n: 'Fatura', e: '💡', c: '#eab308' },
  { id: 'giyim', n: 'Giyim', e: '👕', c: '#ec4899' },
  { id: 'saglik', n: 'Sağlık', e: '💊', c: '#ef4444' },
  { id: 'alisveris', n: 'Alışveriş', e: '🛍️', c: '#14b8a6' },
  { id: 'diger', n: 'Diğer', e: '📦', c: '#94a3b8' },
];
const catOf = id =>
  id === 'maas' ? { n: 'Maaş', e: '💰', c: '#22c55e' } :
  id === 'gelir' ? { n: 'Gelir', e: '💵', c: '#22c55e' } :
  id === 'odeme' ? { n: 'Ekstre ödemesi', e: '🧾', c: '#64748b' } :
  id === 'transfer' ? { n: 'Transfer', e: '🔁', c: '#64748b' } :
  id === 'acilis' ? { n: 'Açılış (kategorisiz)', e: '📌', c: '#64748b' } :
  (CATS.find(c => c.id === id) || CATS[CATS.length - 1]);

/* ---------- tarih / para yardımcıları ---------- */
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const pd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addM = (k, n) => {
  let [y, m] = k.split('-').map(Number);
  m = m - 1 + n; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
  return `${y}-${pad(m + 1)}`;
};
const MON = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const trDate = d => `${d.getDate()} ${MON[d.getMonth()]}`;
const trDateY = d => `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`;
const fmt = n => {
  n = Math.round(n * 100) / 100;
  return (n < 0 ? '−' : '') + Math.abs(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
};
const num = s => {
  s = String(s ?? '').trim();
  // Türkçe yazım: "15.000" = onbeş bin, "1.234,50" = 1234,5, "12.5" = 12,5
  if (s.includes(',') || /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  const v = parseFloat(s);
  return isNaN(v) ? 0 : v;
};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const inp = n => (Math.round(n * 100) / 100).toFixed(2).replace('.', ',');

/* ---------- dönem mantığı (kesim günü = maaş günü) ---------- */
let S; // state
const cutDay = () => S?.settings?.cutDay ?? 25;
// Bir tarihin ait olduğu dönemin başlangıç ayı. Kesim gününün kendisi YENİ döneme sayılır.
const periodKey = ds => {
  const d = pd(ds), k = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  return d.getDate() >= cutDay() ? k : addM(k, -1);
};
// Kartla yapılan harcamanın girdiği ekstrenin kesim ayı
const stmtKey = ds => addM(periodKey(ds), 1);
const cutDate = k => { const [y, m] = k.split('-').map(Number); return new Date(y, m - 1, cutDay()); };
const periodRange = pk => {
  const a = cutDate(pk), b = cutDate(addM(pk, 1)); b.setDate(b.getDate() - 1);
  return [a, b];
};

/* ---------- veri ---------- */
function defaults() {
  const today = ymd(new Date());
  const pk = periodKey(today);
  return {
    v: 1,
    settings: { cutDay: 25, salary: 0, salaryAcc: 'ziraat', lastRollover: pk },
    openingPeriodKey: pk,           // açılış borçlarının harcandığı dönem
    openingCutKey: addM(pk, 1),     // açılış borçlarının ekstreye girdiği kesim
    setupDone: false, // gerçek rakamlar ilk açılışta kurulum ekranından girilir, kodda kişisel veri yok
    accounts: [
      { id: 'ziraat', name: 'Ziraat', opening: 0 },
      { id: 'halk', name: 'Halkbank', opening: 0 },
    ],
    cards: [
      { id: 'ziraat-kk', name: 'Ziraat', bank: 'ziraat', limit: 0, openingDebt: 0 },
      { id: 'halk-kk', name: 'Halkbank', bank: 'halk', limit: 0, openingDebt: 0 },
    ],
    tx: [],
  };
}
function load() {
  try {
    const s = localStorage.getItem(KEY);
    if (s) { const d = JSON.parse(s); if (d.setupDone === undefined) d.setupDone = true; return d; }
  } catch (e) {}
  return defaults();
}
function persist() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Kaydedilemedi!'); } }

/* tx: {id,type:'exp'|'inc'|'pay',date,amount,cat,src:'acc:x'|'card:x',note,inst,cutKey} */
const srcParse = s => { const [k, id] = s.split(':'); return { kind: k, id }; };
const acc = id => S.accounts.find(a => a.id === id);
const card = id => S.cards.find(c => c.id === id);
const srcLabel = s => {
  const { kind, id } = srcParse(s);
  return kind === 'acc' ? `${acc(id)?.name ?? '?'} · Banka` : `${card(id)?.name ?? '?'} · Kredi`;
};

const xferLabel = t => `${acc(t.src.slice(4))?.name ?? '?'} → ${acc(t.to.slice(4))?.name ?? '?'}`;

function accBalance(id) {
  let b = acc(id).opening;
  for (const t of S.tx) {
    if (t.type === 'xfer') { // hesaplar arası transfer: bir hesaptan düşer, diğerine eklenir
      if (t.src === 'acc:' + id) b -= t.amount;
      if (t.to === 'acc:' + id) b += t.amount;
      continue;
    }
    const sp = srcParse(t.src);
    if (sp.kind !== 'acc' || sp.id !== id) continue;
    b += t.type === 'inc' ? t.amount : -t.amount; // exp ve pay hesaptan düşer
  }
  return b;
}
// Kartın o kesimde ekstreye girecek tutarı (taksit parçaları dahil)
function stmtDue(cardId, key) {
  let t = S.openingCutKey === key ? card(cardId).openingDebt : 0;
  for (const x of S.tx) {
    if (x.type !== 'exp' || x.src !== 'card:' + cardId) continue;
    const n = x.inst || 1, base = stmtKey(x.date);
    for (let k = 0; k < n; k++) if (addM(base, k) === key) t += x.amount / n;
  }
  return t;
}
const paidFor = (cardId, key) =>
  S.tx.filter(x => x.type === 'pay' && x.cardId === cardId && x.cutKey === key)
    .reduce((a, x) => a + x.amount, 0);
// Limitten kullanılan: tüm kalan taksitler dahil toplam borç
function cardUsed(cardId) {
  let u = card(cardId).openingDebt;
  for (const x of S.tx) {
    if (x.type === 'exp' && x.src === 'card:' + cardId) u += x.amount;
    if (x.type === 'pay' && x.cardId === cardId) u -= x.amount;
  }
  return u;
}

function totals() {
  const today = ymd(new Date());
  const pk = periodKey(today), nk = addM(pk, 1);
  const accSum = S.accounts.reduce((a, x) => a + accBalance(x.id), 0);
  const stmts = S.cards.map(c => ({ c, due: stmtDue(c.id, nk) - paidFor(c.id, nk) }));
  const dueSum = stmts.reduce((a, x) => a + x.due, 0);
  const free = accSum - dueSum;
  const daysLeft = Math.max(1, Math.round((cutDate(nk) - pd(today)) / 864e5));
  return { today, pk, nk, accSum, stmts, dueSum, free, daysLeft, daily: free / daysLeft, needRoll: pk > S.settings.lastRollover };
}
function periodSpend(pk) {
  const [a, b] = periodRange(pk), sa = ymd(a), sb = ymd(b);
  const by = {};
  let total = 0;
  for (const t of S.tx) {
    if (t.type !== 'exp' || t.date < sa || t.date > sb) continue;
    by[t.cat] = (by[t.cat] || 0) + t.amount; total += t.amount;
  }
  // Açılış borçları (uygulamadan önceki kart harcamaları) ekstre hesabında sayılır ama harcama istatistiğine girmez.
  return { by, total };
}

/* ---------- maaş günü: maaşı yatır + ekstreleri öde ---------- */
function rollover() {
  const T = totals();
  let key = addM(S.settings.lastRollover, 1);
  while (key <= T.pk) {
    const date = ymd(cutDate(key));
    S.tx.push({ id: uid(), type: 'inc', date, amount: S.settings.salary, cat: 'maas', src: 'acc:' + S.settings.salaryAcc, note: 'Maaş' });
    for (const c of S.cards) {
      const due = stmtDue(c.id, key) - paidFor(c.id, key);
      if (due > 0.004) S.tx.push({ id: uid(), type: 'pay', date, amount: Math.round(due * 100) / 100, cat: 'odeme', src: 'acc:' + c.bank, cardId: c.id, cutKey: key, note: `${c.name} ekstre` });
    }
    S.settings.lastRollover = key;
    key = addM(key, 1);
  }
  persist(); render(); toast('Maaş yattı, ekstreler ödendi');
}

/* ---------- arayüz durumu ---------- */
const ui = { view: 'home', listPk: null, form: null, detail: null };

function toast(m) {
  const t = $('#toast'); t.textContent = m; t.classList.add('show');
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------- görünümler ---------- */
function home() {
  const T = totals();
  let h = '<h1>Bütçem</h1>';
  if (T.needRoll) {
    const key = addM(S.settings.lastRollover, 1);
    const pays = S.cards.map(c => `${esc(c.name)} ${fmt(stmtDue(c.id, key) - paidFor(c.id, key))}`).join(' · ');
    h += `<div class="banner"><b>${trDate(cutDate(key))} geldi</b>
      <p>Maaş +${fmt(S.settings.salary)} (${esc(acc(S.settings.salaryAcc).name)}) eklenecek, ekstreler ödenecek: ${pays}</p>
      <button class="btn" data-act="rollover">Maaşı yatır ve ekstreleri öde</button></div>`;
  }
  h += `<div class="hero"><div class="lbl">Gerçek serbest paran</div>
    <div class="big ${T.free < 0 ? 'neg' : ''}">${fmt(T.free)}</div>
    <div class="sub">Hesaplarda ${fmt(T.accSum)} − gelecek ekstreler ${fmt(T.dueSum)}</div></div>`;
  h += `<div class="grid2">
    <div class="card"><div class="lbl">Günlük harcayabileceğin</div><div class="v">${fmt(T.daily)}</div><div class="s">${T.daysLeft} gün kaldı</div></div>
    <div class="card"><div class="lbl">Sonraki maaş</div><div class="v">${trDate(cutDate(T.nk))}</div><div class="s">${fmt(S.settings.salary)}</div></div></div>`;

  h += '<h2>Hesaplar</h2>';
  for (const a of S.accounts)
    h += `<div class="row"><div class="emo" style="background:#0c4a6e">🏦</div><div class="grow"><div class="t">${esc(a.name)}</div><div class="m">Banka kartı bakiyesi</div></div><div class="amt">${fmt(accBalance(a.id))}</div></div>`;

  h += `<h2>${trDate(cutDate(T.nk))} ekstresi</h2>`;
  for (const s of T.stmts)
    h += `<div class="row"><div class="emo" style="background:#4c1d95">💳</div><div class="grow"><div class="t">${esc(s.c.name)} Kredi</div><div class="m">Kalan limit ${fmt(s.c.limit - cardUsed(s.c.id))}</div></div><div class="amt">${fmt(s.due)}</div></div>`;

  const P = periodSpend(T.pk), [a, b] = periodRange(T.pk);
  h += `<h2>Bu dönem · ${trDate(a)} – ${trDate(b)}</h2>
    <div class="card"><div class="lbl">Toplam harcama</div><div class="v">${fmt(P.total)}</div></div>`;
  const rows = Object.entries(P.by).sort((x, y) => y[1] - x[1]);
  if (!rows.length) h += '<div class="empty">Henüz harcama yok. + ile ekle.</div>';
  for (const [id, v] of rows) {
    const c = catOf(id);
    h += `<div class="row" style="margin-top:8px"><div class="emo" style="background:${c.c}33">${c.e}</div>
      <div class="grow"><div class="t">${c.n}</div><div class="bar"><i style="width:${(v / P.total * 100).toFixed(1)}%;background:${c.c}"></i></div></div>
      <div class="amt">${fmt(v)}</div></div>`;
  }
  return h;
}

function list() {
  const T = totals();
  const pk = ui.listPk || T.pk;
  const [a, b] = periodRange(pk), sa = ymd(a), sb = ymd(b);
  const items = S.tx.filter(t => t.date >= sa && t.date <= sb)
    .sort((x, y) => y.date.localeCompare(x.date) || y.id.localeCompare(x.id));
  const P = periodSpend(pk);
  let h = `<h1>İşlemler</h1><div class="pn"><button data-act="pk" data-d="-1">‹</button>
    <div style="text-align:center"><b>${trDate(a)} – ${trDateY(b)}</b><div class="lbl">Harcama ${fmt(P.total)}</div></div>
    <button data-act="pk" data-d="1">›</button></div>`;
  if (!items.length) h += '<div class="empty">Bu dönemde işlem yok.</div>';
  let last = '';
  for (const t of items) {
    if (t.date !== last) { last = t.date; h += `<div class="day">${trDateY(pd(t.date))}</div>`; }
    const c = catOf(t.cat), inc = t.type === 'inc';
    h += `<div class="row" data-act="detail" data-id="${t.id}"><div class="emo" style="background:${c.c}33">${c.e}</div>
      <div class="grow"><div class="t">${esc(t.note) || c.n}${t.inst > 1 ? `<span class="pill">${t.inst} taksit</span>` : ''}</div>
      <div class="m">${t.type === 'xfer' ? xferLabel(t) : `${c.n} · ${srcLabel(t.src)}`}</div></div>
      <div class="amt ${inc ? 'in' : ''}">${inc ? '+' : (t.type === 'pay' || t.type === 'xfer') ? '' : '−'}${fmt(t.amount)}</div></div>`;
  }
  return h;
}

function cards() {
  const T = totals();
  let h = '<h1>Kartlar</h1>';
  for (const c of S.cards) {
    const used = cardUsed(c.id), pct = Math.min(100, used / c.limit * 100);
    h += `<div class="card" style="margin-bottom:10px"><div class="pn" style="margin:0"><b>${esc(c.name)} Kredi Kartı</b><span class="lbl">Limit ${fmt(c.limit)}</span></div>
      <div class="bar"><i style="width:${pct.toFixed(1)}%;background:${pct > 85 ? 'var(--bad)' : 'var(--acc)'}"></i></div>
      <div class="pn" style="margin:8px 0 0"><span class="lbl">Kullanılan ${fmt(used)}</span><span class="lbl">Kalan ${fmt(c.limit - used)}</span></div>`;
    // gelecek ekstreler
    let up = '';
    for (let i = 1; i <= 8; i++) {
      const k = addM(T.pk, i), due = stmtDue(c.id, k) - paidFor(c.id, k);
      if (due > 0.004) up += `<div class="pn" style="margin:6px 0 0"><span>${trDateY(cutDate(k))}${i === 1 ? ' <span class="pill">sıradaki</span>' : ''}</span><b>${fmt(due)}</b></div>`;
    }
    h += `<h2 style="margin-top:14px">Ekstreler</h2>${up || '<div class="lbl">Bekleyen ekstre yok</div>'}`;
    // aktif taksitler
    const inst = S.tx.filter(x => x.type === 'exp' && x.src === 'card:' + c.id && x.inst > 1).map(x => {
      const base = stmtKey(x.date);
      let left = 0; for (let k = 0; k < x.inst; k++) if (addM(base, k) > T.pk) left++;
      return { x, left };
    }).filter(z => z.left > 0);
    if (inst.length) {
      h += '<h2>Taksitler</h2>';
      for (const { x, left } of inst)
        h += `<div class="pn" style="margin:6px 0 0"><span>${esc(x.note) || catOf(x.cat).n} <span class="pill">${left} ay kaldı</span></span><b>${fmt(x.amount / x.inst)}/ay</b></div>`;
    }
    h += '</div>';
  }
  const pays = S.tx.filter(x => x.type === 'pay').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  if (pays.length) {
    h += '<h2>Son ekstre ödemeleri</h2>';
    for (const p of pays) h += `<div class="row"><div class="emo" style="background:#33415599">🧾</div><div class="grow"><div class="t">${esc(p.note)}</div><div class="m">${trDateY(pd(p.date))} · ${srcLabel(p.src)}</div></div><div class="amt">${fmt(p.amount)}</div></div>`;
  }
  return h;
}

/* ---------- raporlar ---------- */
const DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
function barRow(label, v, max, color, extra = '') {
  return `<div style="margin:8px 0"><div class="pn" style="margin:0"><span>${label}</span><b>${fmt(v)}${extra}</b></div>
    <div class="bar"><i style="width:${max ? (v / max * 100).toFixed(1) : 0}%;background:${color}"></i></div></div>`;
}
function reports() {
  const T = totals();
  const pk = ui.repPk || T.pk;
  const [a, b] = periodRange(pk), sa = ymd(a), sb = ymd(b);
  const ex = S.tx.filter(t => t.type === 'exp' && t.date >= sa && t.date <= sb);
  const P = periodSpend(pk);
  const nDays = Math.round((b - a) / 864e5) + 1;
  const elapsed = pk === T.pk ? Math.max(1, Math.round((pd(T.today) - a) / 864e5) + 1) : nDays;

  let h = `<h1>Raporlar</h1><div class="pn"><button data-act="rpk" data-d="-1">‹</button>
    <div style="text-align:center"><b>${trDate(a)} – ${trDateY(b)}</b></div>
    <button data-act="rpk" data-d="1">›</button></div>
    <div class="grid2">
      <div class="card"><div class="lbl">Toplam harcama</div><div class="v">${fmt(P.total)}</div><div class="s">${ex.length} işlem</div></div>
      <div class="card"><div class="lbl">Günlük ortalama</div><div class="v">${fmt(P.total / elapsed)}</div><div class="s">${elapsed} gün üzerinden</div></div></div>`;
  if (!P.total) return h + '<div class="empty">Bu dönemde harcama yok.</div>';

  // Kategori dağılımı (halka grafik)
  const cats = Object.entries(P.by).sort((x, y) => y[1] - x[1]);
  const R = 40, C = 2 * Math.PI * R;
  let off = 0, arcs = '';
  for (const [id, v] of cats) {
    const len = v / P.total * C;
    arcs += `<circle r="${R}" cx="60" cy="60" fill="none" stroke="${catOf(id).c}" stroke-width="22" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 60 60)"/>`;
    off += len;
  }
  h += `<h2>Kategoriler</h2><div class="card"><div style="display:flex;align-items:center;gap:14px">
    <svg width="120" height="120" viewBox="0 0 120 120" style="flex:none">${arcs}</svg>
    <div style="flex:1;min-width:0">${cats.slice(0, 5).map(([id, v]) => `<div class="pn" style="margin:3px 0;font-size:13px"><span>${catOf(id).e} ${catOf(id).n}</span><b>%${Math.round(v / P.total * 100)}</b></div>`).join('')}</div></div>
    ${cats.map(([id, v]) => barRow(`${catOf(id).e} ${catOf(id).n}`, v, cats[0][1], catOf(id).c)).join('')}</div>`;

  // Kaynak bazında
  const bySrc = {};
  for (const t of ex) bySrc[t.src] = (bySrc[t.src] || 0) + t.amount;
  const srcs = Object.entries(bySrc).sort((x, y) => y[1] - x[1]);
  h += `<h2>Nereden ödendi</h2><div class="card">${srcs.map(([s, v]) => barRow(srcLabel(s), v, srcs[0][1], s.startsWith('card') ? '#a78bfa' : '#38bdf8', ` <span class="lbl">%${Math.round(v / P.total * 100)}</span>`)).join('')}</div>`;

  // Günlük harcama grafiği
  const daily = Array(nDays).fill(0);
  for (const t of ex) daily[Math.round((pd(t.date) - a) / 864e5)] += t.amount;
  const dmax = Math.max(...daily, 1), bw = 300 / nDays;
  const todayIdx = pk === T.pk ? Math.round((pd(T.today) - a) / 864e5) : -1;
  h += `<h2>Günlük harcama</h2><div class="card"><svg viewBox="0 0 300 90" width="100%" style="display:block">
    ${daily.map((v, i) => `<rect x="${(i * bw + 1).toFixed(1)}" y="${(80 - v / dmax * 78).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${(v / dmax * 78).toFixed(1)}" rx="2" fill="${i === todayIdx ? '#fbbf24' : '#38bdf8'}"/>`).join('')}
    <line x1="0" y1="80.5" x2="300" y2="80.5" stroke="#334155"/></svg>
    <div class="pn" style="margin:4px 0 0"><span class="lbl">${trDate(a)}</span><span class="lbl">En yüksek gün: ${fmt(dmax)}</span><span class="lbl">${trDate(b)}</span></div>
</div>`;

  // Dönem karşılaştırma (son 6 dönem)
  const hist = [];
  for (let i = 5; i >= 0; i--) { const k = addM(pk, -i); hist.push({ k, v: periodSpend(k).total }); }
  const hmax = Math.max(...hist.map(x => x.v), 1);
  h += `<h2>Önceki dönemlerle</h2><div class="card">${hist.map((x, i) => {
    const prev = i ? hist[i - 1].v : 0;
    const ch = prev > 0 ? ` <span class="lbl" style="color:${x.v > prev ? 'var(--bad)' : 'var(--ok)'}">${x.v > prev ? '↑' : '↓'}%${Math.abs(Math.round((x.v - prev) / prev * 100))}</span>` : '';
    return barRow(`${trDate(cutDate(x.k))}${x.k === pk ? ' <span class="pill">seçili</span>' : ''}`, x.v, hmax, x.k === pk ? '#fbbf24' : '#64748b', ch);
  }).join('')}</div>`;

  // Haftanın günleri
  const wd = Array(7).fill(0);
  for (const t of ex) wd[(pd(t.date).getDay() + 6) % 7] += t.amount;
  const wmax = Math.max(...wd, 1);
  h += `<h2>Haftanın günleri</h2><div class="card">${wd.map((v, i) => barRow(DAYS[i], v, wmax, '#34d399')).join('')}</div>`;

  // En büyük harcamalar
  const top = [...ex].sort((x, y) => y.amount - x.amount).slice(0, 5);
  h += '<h2>En büyük harcamalar</h2>';
  for (const t of top) {
    const c = catOf(t.cat);
    h += `<div class="row" data-act="detail" data-id="${t.id}"><div class="emo" style="background:${c.c}33">${c.e}</div><div class="grow"><div class="t">${esc(t.note) || c.n}</div><div class="m">${trDateY(pd(t.date))} · ${srcLabel(t.src)}</div></div><div class="amt">${fmt(t.amount)}</div></div>`;
  }
  return h;
}

function settings() {
  let h = `<h1>Ayarlar</h1>
  <div class="field"><label>Aylık maaş</label><input id="s-salary" inputmode="decimal" value="${inp(S.settings.salary)}" data-act-change="salary"></div>
  <div class="field"><label>Maaşın yattığı hesap</label><select id="s-salacc" data-act-change="salacc">
    ${S.accounts.map(a => `<option value="${a.id}" ${a.id === S.settings.salaryAcc ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></div>
  <h2>Hesap bakiyeleri (düzeltmek için değiştir)</h2>`;
  for (const a of S.accounts)
    h += `<div class="field"><label>${esc(a.name)} bakiyesi</label><input inputmode="decimal" value="${inp(accBalance(a.id))}" data-act-change="bal" data-id="${a.id}"></div>`;
  h += '<h2>Kart limitleri</h2>';
  for (const c of S.cards)
    h += `<div class="field"><label>${esc(c.name)} kredi kartı limiti</label><input inputmode="decimal" value="${inp(c.limit)}" data-act-change="limit" data-id="${c.id}"></div>`;
  h += `<h2>Yedek</h2>
  <button class="btn sec" data-act="export">Yedeği indir (JSON)</button>
  <button class="btn sec" data-act="copy">Yedeği panoya kopyala</button>
  <button class="btn sec" data-act="importPick">Yedekten geri yükle</button>
  <input type="file" id="file" accept="application/json,.json" hidden>
  <h2>Tehlikeli bölge</h2>
  <button class="btn del" data-act="reset">Tüm veriyi sil ve baştan başla</button>
  <p class="lbl" style="margin-top:18px">Veriler yalnızca bu cihazdaki tarayıcıda saklanır. Düzenli yedek al.</p>
  <p class="lbl">iPhone'da Safari ile ana ekrandaki uygulamanın verisi ayrıdır. Sadece ana ekrandaki uygulamayı kullan.</p>`;
  return h;
}

const views = { home, list, reports, cards, settings };
function render() {
  $('#app').innerHTML = views[ui.view]();
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.v === ui.view));
}

/* ---------- ekleme formu ---------- */
function newForm() {
  const lastSrc = [...S.tx].reverse().find(t => t.type === 'exp')?.src;
  return { type: 'exp', amount: '', cat: 'yemek', src: lastSrc || 'card:' + S.cards[0].id, acc: S.settings.salaryAcc, date: ymd(new Date()), note: '', inst: 1,
    from: S.accounts[0].id, to: (S.accounts[1] || S.accounts[0]).id };
}
function addModal() {
  const f = ui.form;
  const srcs = [...S.accounts.map(a => ({ v: 'acc:' + a.id, l: `${a.name} Banka` })), ...S.cards.map(c => ({ v: 'card:' + c.id, l: `${c.name} Kredi` }))];
  let h = `<div class="sheet"><h3>${f.edit ? 'İşlemi düzenle' : 'Yeni işlem'}</h3>
  <div class="seg"><button class="${f.type === 'exp' ? 'on' : ''}" data-act="ftype" data-v="exp">Harcama</button><button class="${f.type === 'inc' ? 'on' : ''}" data-act="ftype" data-v="inc">Gelir</button><button class="${f.type === 'xfer' ? 'on' : ''}" data-act="ftype" data-v="xfer">Transfer</button></div>
  <input class="amount" id="f-amount" data-f="amount" inputmode="decimal" placeholder="0,00" value="${esc(f.amount)}">`;
  if (f.type === 'exp') {
    h += `<div class="field" style="margin-top:12px"><label>Nereden ödendi</label><div class="chips">${srcs.map(s => `<button class="chip ${f.src === s.v ? 'on' : ''}" data-act="fset" data-k="src" data-v="${s.v}">${s.l}</button>`).join('')}</div></div>
    <div class="field"><label>Kategori</label><div class="chips">${CATS.map(c => `<button class="chip ${f.cat === c.id ? 'on' : ''}" data-act="fset" data-k="cat" data-v="${c.id}">${c.e} ${c.n}</button>`).join('')}</div></div>`;
    if (f.src.startsWith('card:'))
      h += `<div class="field"><label>Taksit sayısı (1 = tek çekim)</label><div class="chips">${[1, 2, 3, 4, 6, 9, 12].map(n => `<button class="chip ${+f.inst === n ? 'on' : ''}" data-act="fset" data-k="inst" data-v="${n}">${n}</button>`).join('')}</div></div>`;
  } else if (f.type === 'xfer') {
    h += `<div class="field" style="margin-top:12px"><label>Hangi hesaptan</label><div class="chips">${S.accounts.map(a => `<button class="chip ${f.from === a.id ? 'on' : ''}" data-act="fset" data-k="from" data-v="${a.id}">${a.name}</button>`).join('')}</div></div>
    <div class="field"><label>Hangi hesaba</label><div class="chips">${S.accounts.map(a => `<button class="chip ${f.to === a.id ? 'on' : ''}" data-act="fset" data-k="to" data-v="${a.id}">${a.name}</button>`).join('')}</div></div>`;
  } else {
    h += `<div class="field" style="margin-top:12px"><label>Hangi hesaba</label><div class="chips">${S.accounts.map(a => `<button class="chip ${f.acc === a.id ? 'on' : ''}" data-act="fset" data-k="acc" data-v="${a.id}">${a.name}</button>`).join('')}</div></div>`;
  }
  h += `<div class="field"><label>Tarih</label><input type="date" data-f="date" value="${f.date}"></div>
  <div class="field"><label>Not (isteğe bağlı)</label><input data-f="note" placeholder="örn. öğle yemeği" value="${esc(f.note)}"></div>
  <button class="btn" data-act="save">Kaydet</button><button class="btn sec" data-act="close">Vazgeç</button></div>`;
  return h;
}
function openModal(html) { const m = $('#modal'); m.innerHTML = html; m.classList.add('open'); }
function closeModal() { $('#modal').classList.remove('open'); ui.form = null; }

/* ---------- eylemler ---------- */
const A = {
  nav: d => { ui.view = d.v; ui.listPk = null; ui.repPk = null; render(); window.scrollTo(0, 0); },
  rpk: d => { const T = totals(); ui.repPk = addM(ui.repPk || T.pk, +d.d); render(); },
  pk: d => { const T = totals(); ui.listPk = addM(ui.listPk || T.pk, +d.d); render(); },
  openAdd: () => { ui.form = newForm(); openModal(addModal()); setTimeout(() => $('#f-amount')?.focus(), 50); },
  ftype: d => { ui.form.type = d.v; openModal(addModal()); },
  fset: d => {
    ui.form[d.k] = d.k === 'inst' ? +d.v : d.v;
    if (d.k === 'src' && !d.v.startsWith('card:')) ui.form.inst = 1;
    // Transferde kaynak ve hedef aynı hesap olamaz: diğerini otomatik değiştir
    if ((d.k === 'from' || d.k === 'to') && ui.form.from === ui.form.to) {
      const other = S.accounts.find(a => a.id !== d.v)?.id;
      if (other) ui.form[d.k === 'from' ? 'to' : 'from'] = other;
    }
    openModal(addModal());
  },
  close: closeModal,
  save: () => {
    const f = ui.form, amount = num(f.amount);
    if (amount <= 0) return toast('Tutarı gir');
    if (!f.date) return toast('Tarih seç');
    const t = { id: f.edit || uid(), type: f.type, date: f.date, amount: Math.round(amount * 100) / 100, note: (f.note || '').trim() };
    if (f.type === 'exp') {
      t.cat = f.cat; t.src = f.src;
      if (f.src.startsWith('card:')) {
        t.inst = Math.max(1, +f.inst || 1);
        const c = card(f.src.slice(5)), left = c.limit - cardUsed(c.id);
        if (amount > left) toast(`Dikkat: ${c.name} kalan limit ${fmt(left)}`);
      }
    } else if (f.type === 'xfer') {
      if (f.from === f.to) return toast('Farklı iki hesap seç');
      t.cat = 'transfer'; t.src = 'acc:' + f.from; t.to = 'acc:' + f.to;
    } else { t.cat = 'gelir'; t.src = 'acc:' + f.acc; }
    S.tx.push(t); persist(); closeModal(); render();
    if (!$('#toast').classList.contains('show')) toast('Kaydedildi');
  },
  detail: d => {
    const t = S.tx.find(x => x.id === d.id); if (!t) return;
    const c = catOf(t.cat);
    openModal(`<div class="sheet"><h3>${c.e} ${esc(t.note) || c.n}</h3>
      <div class="row"><div class="grow"><div class="m">Tutar</div><div class="t">${fmt(t.amount)}${t.inst > 1 ? ` · ${t.inst} taksit (${fmt(t.amount / t.inst)}/ay)` : ''}</div></div></div>
      <div class="row"><div class="grow"><div class="m">${t.type === 'xfer' ? 'Transfer' : 'Kaynak'}</div><div class="t">${t.type === 'xfer' ? xferLabel(t) : srcLabel(t.src)}</div></div></div>
      <div class="row"><div class="grow"><div class="m">Tarih</div><div class="t">${trDateY(pd(t.date))}</div></div></div>
      ${t.type === 'exp' ? `<button class="btn sec" data-act="edit" data-id="${t.id}">Düzenle</button>` : ''}
      <button class="btn del" data-act="del" data-id="${t.id}">Sil</button><button class="btn sec" data-act="close">Kapat</button></div>`);
  },
  edit: d => {
    const t = S.tx.find(x => x.id === d.id);
    S.tx = S.tx.filter(x => x.id !== d.id); // kaydedilince yeniden eklenir
    ui.form = { type: t.type, amount: inp(t.amount), cat: t.cat, src: t.src, acc: t.src.slice(4), date: t.date, note: t.note, inst: t.inst || 1, edit: t.id, orig: t };
    openModal(addModal());
  },
  del: d => { if (!confirm('Bu işlem silinsin mi?')) return; S.tx = S.tx.filter(x => x.id !== d.id); persist(); closeModal(); render(); toast('Silindi'); },
  rollover,
  export: () => {
    const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `butce-yedek-${ymd(new Date())}.json`; a.click();
  },
  copy: async () => { try { await navigator.clipboard.writeText(JSON.stringify(S)); toast('Panoya kopyalandı'); } catch (e) { toast('Kopyalanamadı'); } },
  importPick: () => $('#file').click(),
  reset: () => { if (confirm('TÜM veri silinecek. Emin misin?') && confirm('Bu işlem geri alınamaz. Devam?')) { localStorage.removeItem(KEY); S = defaults(); persist(); render(); openModal(setupModal()); } },
};

document.addEventListener('click', e => {
  if (e.target.id === 'modal') { if (!S.setupDone) return; if (ui.form?.edit) restoreEdit(); return closeModal(); }
  const t = e.target.closest('[data-act]'); if (!t) return;
  if (t.dataset.act === 'close' && ui.form?.edit) restoreEdit();
  A[t.dataset.act]?.(t.dataset, t);
});
// Düzenlemeden vazgeçilirse silinen işlemi geri koy
function restoreEdit() { if (ui.form?.orig) { S.tx.push(ui.form.orig); persist(); render(); } }

document.addEventListener('input', e => { const k = e.target.dataset.f; if (k && ui.form) ui.form[k] = e.target.value; });
document.addEventListener('change', e => {
  const t = e.target, a = t.dataset.actChange;
  if (t.id === 'file') {
    const r = new FileReader();
    r.onload = () => { try { const d = JSON.parse(r.result); if (!d.tx || !d.accounts) throw 0; if (d.setupDone === undefined) d.setupDone = true; S = d; persist(); render(); toast('Yedek yüklendi'); } catch (x) { toast('Geçersiz yedek dosyası'); } };
    r.readAsText(t.files[0]); return;
  }
  if (!a) return;
  if (a === 'salary') S.settings.salary = num(t.value);
  if (a === 'salacc') S.settings.salaryAcc = t.value;
  if (a === 'limit') card(t.dataset.id).limit = num(t.value);
  if (a === 'bal') { const x = acc(t.dataset.id); x.opening += num(t.value) - accBalance(x.id); }
  persist(); render(); toast('Güncellendi');
});

/* ---------- ilk açılış kurulumu ---------- */
function setupModal() {
  const f = (id, label, v = '', hint = '') =>
    `<div class="field"><label>${label}</label><input id="${id}" inputmode="decimal" placeholder="0,00" value="${v}">${hint ? `<div class="lbl" style="margin-top:4px">${hint}</div>` : ''}</div>`;
  return `<div class="sheet"><h3>Hoş geldin, başlayalım</h3>
    <p class="lbl" style="margin:0 0 14px">Şu anki durumunu bir kere gir. Veriler sadece bu telefonda saklanır.</p>
    ${f('su-salary', 'Aylık maaş', S.settings.salary ? inp(S.settings.salary) : '')}
    <div class="field"><label>Maaşın yattığı hesap</label><select id="su-salacc">${S.accounts.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select></div>
    <h2>Banka hesapları (şu anki bakiye)</h2>
    ${S.accounts.map(a => f('su-acc-' + a.id, `${esc(a.name)} hesap bakiyesi`)).join('')}
    <h2>Kredi kartları</h2>
    ${S.cards.map(c => f('su-lim-' + c.id, `${esc(c.name)} kart limiti`) +
      f('su-debt-' + c.id, `${esc(c.name)} kartta şu an kullanılan`, '', 'Limit − kullanılabilir limit. Bu dönemin harcamalarıdır, 25\'inde ödenecek.')).join('')}
    <button class="btn" data-act="finishSetup">Başla</button></div>`;
}
A.finishSetup = () => {
  const v = id => num(document.getElementById(id)?.value);
  if (v('su-salary') <= 0) return toast('Maaşı gir');
  const today = ymd(new Date()), pk = periodKey(today);
  S.settings.salary = v('su-salary');
  S.settings.salaryAcc = document.getElementById('su-salacc').value;
  S.settings.lastRollover = pk;
  S.openingPeriodKey = pk; S.openingCutKey = addM(pk, 1);
  for (const a of S.accounts) a.opening = v('su-acc-' + a.id);
  for (const c of S.cards) { c.limit = v('su-lim-' + c.id); c.openingDebt = v('su-debt-' + c.id); }
  S.setupDone = true; persist(); closeModal(); render(); toast('Hazır!');
};

/* ---------- başlat ---------- */
S = load();
render();
if (!S.setupDone) openModal(setupModal());
// Tarayıcıdan "veriyi silme" iste (destekleyen cihazlarda kalıcı depolama)
try { navigator.storage?.persist?.(); } catch (e) {}
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
