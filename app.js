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

  h += `<div class="grid2" style="margin-top:10px"><button class="btn sec" data-act="openSim">🤔 Alsam ne olur?</button><button class="btn sec" data-act="copyAll">📋 Claude için özet</button></div>`;

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

const views = { home, list, reports, cards, settings, sim };
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

/* =====================================================================
   "Alsam ne olur?" simülatörü + Claude için özet
   Alım geçici bir kayıt gibi eklenir, mevcut hesap mantığı yeniden çalışır,
   sonra kayıt geri alınır. Böylece rakamlar ana ekranla birebir tutar.
   ===================================================================== */
const fmt0 = n => (n < 0 ? '−' : '') + Math.abs(Math.round(n)).toLocaleString('tr-TR') + ' ₺';
const pct = x => '%' + Math.round(x * 100);

function withTx(vt, fn) { S.tx.push(vt); try { return fn(); } finally { S.tx.pop(); } }

// Verilen kesimdeki taksit parçalarının toplamı (açılış borcu hariç)
function instDue(key) {
  let t = 0;
  for (const x of S.tx) {
    if (x.type !== 'exp' || !x.src.startsWith('card:') || !(x.inst > 1)) continue;
    const base = stmtKey(x.date);
    for (let k = 0; k < x.inst; k++) if (addM(base, k) === key) t += x.amount / x.inst;
  }
  return t;
}
// Bir andaki tüm önemli rakamlar
function metrics() {
  const T = totals(), months = [];
  for (let i = 1; i <= 12; i++) {
    const k = addM(T.pk, i);
    const per = S.cards.map(c => stmtDue(c.id, k) - paidFor(c.id, k));
    months.push({ k, per, total: per.reduce((a, b) => a + b, 0), inst: instDue(k) });
  }
  const used = {}, bal = {};
  S.cards.forEach(c => used[c.id] = cardUsed(c.id));
  S.accounts.forEach(a => bal[a.id] = accBalance(a.id));
  const debt = Object.values(used).reduce((a, b) => a + b, 0);
  return { T, months, used, bal, debt, free: T.free, daily: T.daily, accSum: T.accSum, due: T.dueSum };
}
// Taksitli toplamdan aylık efektif faiz (taksitler aylık, sonda ödenir varsayımıyla)
function effRate(price, total, n) {
  if (!(total > price) || n < 2) return null;
  const pay = total / n; let lo = 0, hi = 1;
  for (let i = 0; i < 60; i++) {
    const r = (lo + hi) / 2; let pv = 0;
    for (let k = 1; k <= n; k++) pv += pay / Math.pow(1 + r, k);
    if (pv > price) lo = r; else hi = r;
  }
  return (lo + hi) / 2;
}
function scen(src, inst, amount, cat) {
  const vt = { id: '__sim', type: 'exp', date: ymd(new Date()), amount, cat: cat || 'diger', src, note: 'sim', inst };
  return withTx(vt, metrics);
}
function simulate(p) {
  const price = num(p.price), total = num(p.total);
  const isCard = p.src.startsWith('card:');
  const inst = isCard ? Math.max(1, +p.inst || 1) : 1;
  const amount = (isCard && inst > 1 && total > price) ? total : price;
  const before = metrics();
  const after = scen(p.src, inst, amount, p.cat);
  return { price, total, amount, inst, isCard, src: p.src, cat: p.cat, name: (p.name || '').trim(), before, after };
}
const newSim = () => ({ name: '', price: '', total: '', src: 'card:' + S.cards[0].id, inst: 1, cat: 'diger' });

function simFlags(s) {
  const f = [], b = s.before, a = s.after, sal = S.settings.salary || 0;
  const add = (l, t) => f.push({ l, t });
  if (a.free < 0) add('bad', `Serbest paran <b>${fmt0(a.free)}</b> olur. 25'inde ekstreleri ödemeye para yetmez, açığı maaştan kapatman gerekir.`);
  else if (b.free > 0 && (b.free - a.free) / b.free > 0.5) add('warn', `Bu dönemki serbest paranın <b>${pct((b.free - a.free) / b.free)}</b>'ini tüketir (${fmt0(b.free)} → ${fmt0(a.free)}).`);
  if (s.isCard) {
    const c = card(s.src.slice(5)), left = c.limit - b.used[c.id];
    if (s.amount > left) add('bad', `${esc(c.name)} kartında yeterli limit yok. Kalan limit ${fmt0(left)}, alım ${fmt0(s.amount)}.`);
    else if (c.limit > 0 && a.used[c.id] / c.limit > 0.85) add('warn', `${esc(c.name)} kart limitinin <b>${pct(a.used[c.id] / c.limit)}</b>'i dolu olur.`);
  } else {
    const ac = acc(s.src.slice(4));
    if (s.price > b.bal[ac.id]) add('bad', `${esc(ac.name)} hesabında yeterli para yok (bakiye ${fmt0(b.bal[ac.id])}).`);
  }
  if (sal > 0) {
    let w = null, wi = null;
    a.months.forEach(m => { const r = m.total / sal; if (!w || r > w.r) w = { r, k: m.k }; const ri = m.inst / sal; if (!wi || ri > wi.r) wi = { r: ri, k: m.k }; });
    if (w.r > 0.7) add('bad', `${trDate(cutDate(w.k))} ekstren maaşının <b>${pct(w.r)}</b>'ine çıkar. Bu çok yüksek.`);
    else if (w.r > 0.5) add('warn', `${trDate(cutDate(w.k))} ekstren maaşının <b>${pct(w.r)}</b>'ine çıkar.`);
    if (wi.r > 0.3) add('warn', `Aylık taksit yükün maaşının <b>${pct(wi.r)}</b>'ine kadar çıkar (${fmt0(wi.r * sal)}).`);
  }
  if (s.isCard && s.inst > 1 && s.total > s.price)
    add('warn', `Vade farkı <b>${fmt0(s.total - s.price)}</b> (%${((s.total / s.price - 1) * 100).toFixed(1)}). Taksit seçmeden peşin ödeyebilirsen bu fark yok olur.`);
  if (!f.length) add('ok', 'Mevcut rakamlara göre belirgin bir sorun görünmüyor.');
  return f;
}

function simResults() {
  const f = ui.sim, price = num(f.price);
  if (price <= 0) return '<div class="empty">Fiyatı yazınca detaylı sonuç burada görünür.</div>';
  const s = simulate(f), b = s.before, a = s.after, sal = S.settings.salary || 0, today = ymd(new Date());
  const row = (label, bv, av, goodUp, fm = fmt0) => {
    const d = av - bv, none = Math.abs(d) < (fm === fmt0 ? 0.5 : 0.005), cls = none ? '' : ((d > 0) === goodUp ? 'ok' : 'bad');
    return `<tr><td>${label}</td><td>${fm(bv)}</td><td>${fm(av)}</td><td class="${cls}">${none ? '—' : (d > 0 ? '+' : '−') + fm(Math.abs(d))}</td></tr>`;
  };
  let h = '<h2>Değerlendirme</h2>' + simFlags(s).map(x => `<div class="flag ${x.l}"><i></i><span>${x.t}</span></div>`).join('')
    + '<div class="lbl" style="margin:-2px 2px 4px">İşaretler basit kurallara göre çıkar, tavsiye değildir.</div>';

  // Önce / sonra
  h += '<h2>Önce → Sonra</h2><div class="card"><table class="t"><tr><th></th><th>Önce</th><th>Sonra</th><th>Fark</th></tr>'
    + row('Gerçek serbest para', b.free, a.free, true)
    + row('Günlük harcayabileceğin', b.daily, a.daily, true)
    + row('Sıradaki ekstre (toplam)', b.months[0].total, a.months[0].total, false)
    + row('Hesaplardaki para', b.accSum, a.accSum, true)
    + row('Toplam kart borcu', b.debt, a.debt, false)
    + row('Sıradaki ekstredeki taksit', b.months[0].inst, a.months[0].inst, false);
  if (s.isCard) {
    const c = card(s.src.slice(5));
    h += row(`${esc(c.name)} kalan limit`, c.limit - b.used[c.id], c.limit - a.used[c.id], true);
    if (c.limit > 0) h += row(`${esc(c.name)} limit doluluğu`, b.used[c.id] / c.limit, a.used[c.id] / c.limit, false, x => pct(x));
  } else {
    const ac = acc(s.src.slice(4));
    h += row(`${esc(ac.name)} hesap bakiyesi`, b.bal[ac.id], a.bal[ac.id], true);
  }
  h += '</table></div>';

  // Ay ay ekstre etkisi
  const rows = [];
  a.months.forEach((m, i) => { if (i === 0 || m.total > 0.5 || b.months[i].total > 0.5) rows.push(i); });
  h += '<h2>Ay ay ekstre etkisi</h2><div class="card"><table class="t"><tr><th>Ekstre</th><th>Önce</th><th>Sonra</th><th>Maaşa oranı</th></tr>'
    + rows.map(i => {
      const m = a.months[i], r = sal > 0 ? m.total / sal : 0;
      return `<tr><td>${trDate(cutDate(m.k))}</td><td>${fmt0(b.months[i].total)}</td><td><b>${fmt0(m.total)}</b></td><td class="${r > 0.7 ? 'bad' : r > 0.5 ? 'warn' : ''}">${sal > 0 ? pct(r) : '—'}</td></tr>`;
    }).join('') + '</table><div class="lbl" style="margin-top:6px">Sadece bildiğim kayıtlar sayılır (taksitler ve girdiğin harcamalar). İleride yapacağın harcamalar dahil değil.</div></div>';

  // Neye denk
  const hist = [1, 2, 3].map(i => periodSpend(addM(totals().pk, -i))).filter(p => p.total > 0);
  const avg = hist.length ? hist.reduce((x, p) => x + p.total, 0) / hist.length : 0;
  const eq = [];
  if (b.daily > 0) eq.push(`<b>${(s.price / b.daily).toFixed(1)} günlük</b> harcama hakkına denk (günlük ${fmt0(b.daily)})`);
  if (sal > 0) eq.push(`Maaşının <b>${pct(s.price / sal)}</b>'i`);
  if (avg > 0) eq.push(`Önceki dönemlerdeki ortalama aylık harcamanın (${fmt0(avg)}) <b>${pct(s.price / avg)}</b>'i`);
  if (b.free > 0) eq.push(`Şu anki serbest paranın <b>${pct(s.price / b.free)}</b>'i`);
  h += '<h2>Bu alım neye denk?</h2><div class="card">' + eq.map(t => `<div style="margin:5px 0">• ${t}</div>`).join('') + '</div>';

  // Kategori bağlamı
  const cat = catOf(f.cat), pk0 = totals().pk;
  const ch = [0, 1, 2, 3].map(i => ({ k: addM(pk0, -i), v: periodSpend(addM(pk0, -i)).by[f.cat] || 0 }));
  if (f.cat !== 'diger' || ch.some(x => x.v > 0)) {
    h += `<h2>${cat.e} ${cat.n} harcaman</h2><div class="card">${ch.map((x, i) => `<div class="pn" style="margin:5px 0"><span>${i === 0 ? 'Bu dönem (şu ana kadar)' : trDate(cutDate(x.k)) + ' dönemi'}</span><b>${fmt0(x.v)}</b></div>`).join('')}
      <div class="lbl">Bu alım ${cat.n} kategorisine eklenirse bu dönem: <b>${fmt0(ch[0].v + s.price)}</b></div></div>`;
  }

  // Vade farkı
  if (s.isCard && s.inst > 1 && s.total > s.price) {
    const r = effRate(s.price, s.total, s.inst);
    h += `<h2>Vade farkı</h2><div class="card"><div class="pn" style="margin:4px 0"><span>Peşin fiyat</span><b>${fmt(s.price)}</b></div>
      <div class="pn" style="margin:4px 0"><span>Taksitli toplam</span><b>${fmt(s.total)}</b></div>
      <div class="pn" style="margin:4px 0"><span>Fark</span><b class="bad">${fmt(s.total - s.price)} (%${((s.total / s.price - 1) * 100).toFixed(1)})</b></div>
      <div class="pn" style="margin:4px 0"><span>Aylık efektif faiz</span><b>≈ %${(r * 100).toFixed(2)}</b></div>
      <div class="pn" style="margin:4px 0"><span>Yıllık bileşik karşılığı</span><b>≈ %${((Math.pow(1 + r, 12) - 1) * 100).toFixed(0)}</b></div></div>`;
  }

  // Taksit sayısı karşılaştırması
  if (s.isCard) {
    const last = n => trDate(cutDate(addM(stmtKey(today), n - 1)));
    h += '<h2>Taksit sayısı karşılaştırması</h2><div class="card"><table class="t"><tr><th>Taksit</th><th>Aylık</th><th>Serbest para</th><th>Son</th></tr>'
      + [1, 2, 3, 4, 6, 9, 12].map(n => {
        const amt = n === s.inst ? s.amount : s.price, m = scen(s.src, n, amt, f.cat);
        return `<tr class="${n === s.inst ? 'sel' : ''}"><td>${n === 1 ? 'Tek' : n}</td><td>${fmt0(amt / n)}</td><td>${fmt0(m.free)}</td><td>${last(n)}</td></tr>`;
      }).join('') + '</table><div class="lbl" style="margin-top:6px">Seçtiğin taksit hariç satırlar vade farksız (peşin fiyat) hesaplanır.</div></div>';
  }

  // Kaynak karşılaştırması
  h += '<h2>Hangi kartla / hesapla?</h2><div class="card"><table class="t"><tr><th>Kaynak</th><th>Yeter mi?</th><th>Serbest para</th></tr>'
    + [...S.accounts.map(x => 'acc:' + x.id), ...S.cards.map(x => 'card:' + x.id)].map(src => {
      const isC = src.startsWith('card:'), inst = isC ? s.inst : 1, amt = isC ? s.amount : s.price, m = scen(src, inst, amt, f.cat);
      let ok, info;
      if (isC) { const c = card(src.slice(5)), left = c.limit - b.used[c.id]; ok = amt <= left; info = `limit ${fmt0(left)}`; }
      else { const bl = b.bal[src.slice(4)]; ok = amt <= bl; info = `bakiye ${fmt0(bl)}`; }
      return `<tr class="${src === s.src ? 'sel' : ''}"><td>${srcLabel(src)}</td><td class="${ok ? 'ok' : 'bad'}">${ok ? '✓' : '✗'} <span class="lbl">${info}</span></td><td>${fmt0(m.free)}</td></tr>`;
    }).join('') + '</table></div>';

  h += `<h2>Claude'a sor</h2>
    <button class="btn" data-act="copySim">📋 Bu alım için özeti kopyala</button>
    <button class="btn sec" data-act="shareSim">📤 Paylaş menüsüyle gönder</button>
    <div class="lbl" style="margin-top:8px">Metin; durumun, önce/sonra rakamları ve "almalı mıyım?" sorusunu içerir. Claude uygulamasına yapıştır.</div>`;
  return h;
}

function sim() {
  if (!ui.sim) ui.sim = newSim();
  const f = ui.sim, isCard = f.src.startsWith('card:');
  const srcs = [...S.accounts.map(a => ({ v: 'acc:' + a.id, l: `${a.name} Banka` })), ...S.cards.map(c => ({ v: 'card:' + c.id, l: `${c.name} Kredi` }))];
  const chip = (k, v, label, on) => `<button class="chip ${on ? 'on' : ''}" data-act="sset" data-k="${k}" data-v="${v}">${label}</button>`;
  return `<div class="pn"><button data-act="nav" data-v="home">‹</button><b style="font-size:18px">Alsam ne olur?</b><span style="width:40px"></span></div>
    <div class="field"><label>Ne alıyorsun? (isteğe bağlı)</label><input data-s="name" value="${esc(f.name)}" placeholder="örn. Lego seti"></div>
    <div class="field"><label>Fiyat (peşin)</label><input class="amount" data-s="price" inputmode="decimal" placeholder="0,00" value="${esc(f.price)}"></div>
    <div class="field"><label>Nereden ödersin?</label><div class="chips">${srcs.map(s => chip('src', s.v, s.l, f.src === s.v)).join('')}</div></div>
    ${isCard ? `<div class="field"><label>Taksit sayısı</label><div class="chips">${[1, 2, 3, 4, 6, 9, 12].map(n => chip('inst', n, n === 1 ? 'Tek çekim' : n, +f.inst === n)).join('')}</div></div>
    ${+f.inst > 1 ? `<div class="field"><label>Taksitli toplam fiyat (vade farkı varsa, boşsa peşin fiyat)</label><input data-s="total" inputmode="decimal" placeholder="örn. 1.320,00" value="${esc(f.total)}"></div>` : ''}` : ''}
    <div class="field"><label>Kategori</label><div class="chips">${CATS.map(c => chip('cat', c.id, `${c.e} ${c.n}`, f.cat === c.id)).join('')}</div></div>
    <div id="sim-out">${simResults()}</div>`;
}

/* ---------- Claude için özet metni ---------- */
function claudeText(s) {
  const m = metrics(), T = m.T, L = [], pk = T.pk;
  const [pa, pb] = periodRange(pk);
  L.push(`Kişisel bütçem (${trDateY(new Date())}). Tutarlar TL. Rakamlar "Bütçem" uygulamasından, hesaplar uygulama tarafından yapıldı.`, '', 'DURUM');
  L.push(`- Maaş: ${fmt(S.settings.salary)}, her ayın ${cutDay()}'inde yatıyor. Kredi kartı ekstre kesimi de ${cutDay()}'i; ekstreyi maaş gelince tam ödüyorum.`);
  L.push(`- Şu anki dönem: ${trDateY(pa)} – ${trDateY(pb)}; ${T.daysLeft} gün kaldı, sonraki maaş ${trDateY(cutDate(T.nk))}.`);
  L.push(`- Hesaplar: ${S.accounts.map(x => `${x.name} ${fmt(m.bal[x.id])}`).join(', ')} (toplam ${fmt(T.accSum)})`);
  L.push(`- Kredi kartları: ${S.cards.map(c => `${c.name}: kullanılan ${fmt(m.used[c.id])} / limit ${fmt(c.limit)}`).join('; ')}`);
  L.push(`- Sıradaki ekstreler (${trDate(cutDate(T.nk))}): ${T.stmts.map(x => `${x.c.name} ${fmt(x.due)}`).join(', ')} (toplam ${fmt(T.dueSum)})`);
  L.push(`- Gerçek serbest para (hesaplar − sıradaki ekstreler): ${fmt(T.free)}; kalan günlere bölünce günlük ≈ ${fmt(T.daily)}`);
  const fut = m.months.filter(x => x.total > 0.5);
  if (fut.length) L.push('', 'GELECEK EKSTRELER (bilinen kayıtlar, taksitler dahil)', ...fut.map(x => `- ${trDate(cutDate(x.k))}: ${fmt(x.total)}${x.inst > 0.5 ? ` (bunun ${fmt(x.inst)}'i taksit)` : ''}`));
  const insts = S.tx.filter(x => x.type === 'exp' && x.src.startsWith('card:') && x.inst > 1).map(x => {
    let left = 0; for (let k = 0; k < x.inst; k++) if (addM(stmtKey(x.date), k) > pk) left++;
    return left > 0 ? `- ${x.note || catOf(x.cat).n} (${card(x.src.slice(5)).name}): aylık ${fmt(x.amount / x.inst)}, ${left} ay kaldı` : null;
  }).filter(Boolean);
  if (insts.length) L.push('', 'AKTİF TAKSİTLER', ...insts);
  L.push('', 'DÖNEM DÖNEM HARCAMA (kategori toplamları)');
  for (let i = 0; i < 4; i++) {
    const k = addM(pk, -i), P = periodSpend(k), [ra, rb] = periodRange(k);
    if (P.total > 0) L.push(`- ${trDate(ra)} – ${trDate(rb)}${i === 0 ? ' (bu dönem, şu ana kadar)' : ''}: toplam ${fmt(P.total)} — ${Object.entries(P.by).sort((x, y) => y[1] - x[1]).map(([id, v]) => `${catOf(id).n} ${fmt(v)}`).join(', ')}`);
  }
  const since = ymd(cutDate(addM(pk, -2)));
  const txs = S.tx.filter(t => t.date >= since).sort((x, y) => y.date.localeCompare(x.date)).slice(0, 150);
  if (txs.length) {
    L.push('', `SON İŞLEMLER (son ~${txs.length}, yeniden eskiye)`);
    for (const t of txs) {
      const kind = t.type === 'inc' ? 'GELİR' : t.type === 'pay' ? 'EKSTRE ÖDEMESİ' : t.type === 'xfer' ? 'TRANSFER' : catOf(t.cat).n;
      L.push(`- ${t.date} | ${fmt(t.amount)} | ${kind} | ${t.type === 'xfer' ? xferLabel(t) : srcLabel(t.src)}${t.inst > 1 ? ` | ${t.inst} taksit` : ''}${t.note ? ' | ' + t.note : ''}`);
    }
  }
  if (s) {
    const b = s.before, a = s.after;
    L.push('', 'DÜŞÜNDÜĞÜM ALIM');
    L.push(`- ${s.name || 'Alım'}: peşin fiyat ${fmt(s.price)}; ödeme: ${srcLabel(s.src)}${s.isCard ? `, ${s.inst === 1 ? 'tek çekim' : s.inst + ' taksit'}` : ''}${s.isCard && s.inst > 1 && s.total > s.price ? `; taksitli toplam ${fmt(s.total)} (vade farkı ${fmt(s.total - s.price)}, aylık efektif faiz ≈ %${(effRate(s.price, s.total, s.inst) * 100).toFixed(2)})` : ''}; kategori: ${catOf(s.cat).n}`);
    L.push(`- Gerçek serbest para: ${fmt(b.free)} → ${fmt(a.free)}`);
    L.push(`- Günlük harcayabileceğim: ${fmt(b.daily)} → ${fmt(a.daily)}`);
    L.push(`- Sıradaki ekstre: ${fmt(b.months[0].total)} → ${fmt(a.months[0].total)}`);
    L.push(`- Toplam kart borcu: ${fmt(b.debt)} → ${fmt(a.debt)}`);
    L.push(`- Ay ay ekstre toplamı (önce → sonra): ${a.months.map((x, i) => (x.total > 0.5 || b.months[i].total > 0.5) ? `${trDate(cutDate(x.k))}: ${fmt0(b.months[i].total)} → ${fmt0(x.total)}` : null).filter(Boolean).join('; ')}`);
    L.push(`- Uygulamanın basit işaretleri: ${simFlags(s).map(x => x.t.replace(/<[^>]+>/g, '')).join(' | ')}`);
    L.push('', 'SORUM: Bu alımı yapmalı mıyım? Yukarıdaki rakamlara dayanarak dürüst ve gerekçeli bir görüş ver: riskli mi, hangi taksit sayısı ya da hangi kartla daha mantıklı, beklemek ya da vazgeçmek daha iyi mi? Gereksiz vaaz verme, kısa ve net ol. Rakamlarda eksik ya da şüpheli bir şey görürsen belirt.');
  } else {
    L.push('', 'Yukarıdaki verilere dayanarak aşağıdaki sorumu cevapla. Hesap gerekiyorsa rakamları yukarıdakilerden al, uydurma.', '', 'SORUM: ');
  }
  return L.join('\n');
}
async function copyOut(text, share) {
  if (share && navigator.share) { try { await navigator.share({ text }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(text); toast("Kopyalandı. Claude'a yapıştır"); }
  catch (e) {
    openModal(`<div class="sheet"><h3>Metni kopyala</h3><p class="lbl">Otomatik kopyalanamadı. Metne dokunup tümünü seç ve kopyala.</p>
      <textarea id="cp" readonly rows="12" style="font-size:13px">${esc(text)}</textarea><button class="btn" data-act="close" style="margin-top:10px">Kapat</button></div>`);
    setTimeout(() => $('#cp')?.select(), 50);
  }
}
A.openSim = () => { if (!ui.sim) ui.sim = newSim(); ui.view = 'sim'; render(); window.scrollTo(0, 0); };
A.sset = d => { ui.sim[d.k] = d.k === 'inst' ? +d.v : d.v; if (d.k === 'src' && !d.v.startsWith('card:')) ui.sim.inst = 1; render(); };
A.copyAll = () => copyOut(claudeText(null));
A.copySim = () => { if (num(ui.sim.price) <= 0) return toast('Önce fiyatı yaz'); copyOut(claudeText(simulate(ui.sim))); };
A.shareSim = () => { if (num(ui.sim.price) <= 0) return toast('Önce fiyatı yaz'); copyOut(claudeText(simulate(ui.sim)), true); };
document.addEventListener('input', e => {
  const k = e.target.dataset.s; if (!k || !ui.sim) return;
  ui.sim[k] = e.target.value;
  const o = $('#sim-out'); if (o) o.innerHTML = simResults();
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
