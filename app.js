'use strict';

const STORAGE_KEY = 'choosepisode.series';

// ---------- אחסון ----------

function loadSeries() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveSeries() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(series));
  } catch {
    alert('לא ניתן לשמור את הרשימה במכשיר הזה.');
  }
}

let series = loadSeries();

// המרה מהגרסה הקודמת, ששמרה רק את ההגרלה האחרונה
for (const s of series) {
  if (s.last && !s.history) s.history = [s.last];
  delete s.last;
}

// ---------- הגרלה ----------

function randomInt(max) {
  // מספר שלם אקראי בטווח [0, max) ללא הטיה
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf); while (buf[0] >= limit);
  return buf[0] % max;
}

const HISTORY_SIZE = 5;

// מיקום הפרק ברצף כל הפרקים של הסדרה (מתחיל ב-0)
function toIndex(seasons, { season, episode }) {
  if (season > seasons.length || episode > seasons[season - 1]) return -1;
  return seasons.slice(0, season - 1).reduce((a, b) => a + b, 0) + episode - 1;
}

// כל פרק בסדרה מקבל סיכוי שווה (לא כל עונה), למעט הפרקים שב-exclude
function pickEpisode(seasons, exclude = []) {
  const total = seasons.reduce((a, b) => a + b, 0);
  // תמיד משאירים לפחות פרק אחד אפשרי, גם בסדרה קצרה מאוד
  const skip = [...new Set(exclude.map((e) => toIndex(seasons, e)).filter((i) => i >= 0))]
    .slice(0, total - 1)
    .sort((a, b) => a - b);
  let n = randomInt(total - skip.length);
  for (const i of skip) if (i <= n) n++;
  for (let i = 0; i < seasons.length; i++) {
    if (n < seasons[i]) return { season: i + 1, episode: n + 1 };
    n -= seasons[i];
  }
}

const pad = (n) => String(n).padStart(2, '0');
const totalEpisodes = (s) => s.seasons.reduce((a, b) => a + b, 0);

// ---------- רשימה ----------

const listEl = document.getElementById('list');
const emptyEl = document.getElementById('empty');

function render() {
  emptyEl.hidden = series.length > 0;
  listEl.replaceChildren(...series.map(renderCard));
}

function renderCard(s) {
  const li = document.createElement('li');
  li.className = 'card';

  const head = document.createElement('div');
  head.className = 'card-head';
  const title = document.createElement('h3');
  title.className = 'card-title';
  title.textContent = s.name;
  head.append(title);

  const meta = document.createElement('p');
  meta.className = 'card-meta';
  const seasonsWord = s.seasons.length === 1 ? 'עונה אחת' : `${s.seasons.length} עונות`;
  meta.textContent = `${seasonsWord} · ${totalEpisodes(s)} פרקים`;

  li.append(head, meta);

  if (s.history?.length) {
    const hist = document.createElement('div');
    hist.className = 'history';
    const label = document.createElement('span');
    label.className = 'card-last';
    label.textContent = 'הגרלות אחרונות (לא יוגרלו שוב בינתיים):';
    const chips = document.createElement('ol');
    chips.className = 'chips';
    for (const h of s.history) {
      const chip = document.createElement('li');
      chip.className = 'chip';
      chip.textContent = `S${pad(h.season)}E${pad(h.episode)}`;
      chip.title = `עונה ${h.season}, פרק ${h.episode}`;
      chips.append(chip);
    }
    hist.append(label, chips);
    li.append(hist);
  }

  const actions = document.createElement('div');
  actions.className = 'card-actions';
  actions.append(
    button('עריכה', 'btn ghost', () => openForm(s.id)),
    button('מחיקה', 'btn ghost danger', () => removeSeries(s.id)),
    button('הגרל פרק', 'btn primary draw', () => draw(s.id)),
  );
  li.append(actions);
  return li;
}

function button(text, className, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
}

function removeSeries(id) {
  const s = series.find((x) => x.id === id);
  if (!s || !confirm(`למחוק את "${s.name}" מהרשימה?`)) return;
  series = series.filter((x) => x.id !== id);
  saveSeries();
  render();
}

// ---------- טופס ----------

const formDialog = document.getElementById('formDialog');
const form = document.getElementById('seriesForm');
const formTitle = document.getElementById('formTitle');
const nameInput = document.getElementById('nameInput');
const seasonCountInput = document.getElementById('seasonCountInput');
const sameEpisodesInput = document.getElementById('sameEpisodesInput');
const seasonsGrid = document.getElementById('seasonsGrid');
const formError = document.getElementById('formError');

let editingId = null;

function buildSeasonInputs(count, values = []) {
  // שומר ערכים שכבר הוקלדו כשמשנים את מספר העונות
  const current = [...seasonsGrid.querySelectorAll('input')].map((i) => i.value);
  const fields = [];
  for (let i = 0; i < count; i++) {
    const label = document.createElement('label');
    label.className = 'field';
    const span = document.createElement('span');
    span.textContent = `עונה ${i + 1}`;
    const input = document.createElement('input');
    input.type = 'number';
    input.inputMode = 'numeric';
    input.min = '1';
    input.max = '999';
    input.required = true;
    input.placeholder = 'פרקים';
    input.value = values[i] ?? current[i] ?? '';
    label.append(span, input);
    fields.push(label);
  }
  seasonsGrid.replaceChildren(...fields);
}

function clampSeasonCount() {
  const n = parseInt(seasonCountInput.value, 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), 60) : 1;
}

seasonCountInput.addEventListener('input', () => {
  if (seasonCountInput.value === '') return;
  buildSeasonInputs(clampSeasonCount());
});

document.getElementById('applySameBtn').addEventListener('click', () => {
  const v = parseInt(sameEpisodesInput.value, 10);
  if (!(v >= 1)) { sameEpisodesInput.focus(); return; }
  seasonsGrid.querySelectorAll('input').forEach((i) => { i.value = v; });
});

function openForm(id = null) {
  editingId = id;
  const s = series.find((x) => x.id === id);
  formTitle.textContent = s ? 'עריכת סדרה' : 'סדרה חדשה';
  nameInput.value = s ? s.name : '';
  seasonCountInput.value = s ? s.seasons.length : 1;
  sameEpisodesInput.value = '';
  formError.hidden = true;
  seasonsGrid.replaceChildren();
  buildSeasonInputs(s ? s.seasons.length : 1, s ? s.seasons : []);
  formDialog.showModal();
  if (!s) nameInput.focus();
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  const seasons = [...seasonsGrid.querySelectorAll('input')].map((i) => parseInt(i.value, 10));

  if (!name) return showError('נא להזין שם סדרה.');
  if (seasons.some((n) => !(n >= 1))) return showError('בכל עונה צריך להיות לפחות פרק אחד.');

  const duplicate = series.find((x) => x.id !== editingId && x.name.toLowerCase() === name.toLowerCase());
  if (duplicate) return showError('סדרה בשם הזה כבר קיימת ברשימה.');

  if (editingId) {
    const s = series.find((x) => x.id === editingId);
    const changed = s.seasons.join() !== seasons.join();
    s.name = name;
    s.seasons = seasons;
    if (changed) s.history = [];
  } else {
    series.unshift({ id: crypto.randomUUID?.() ?? String(Date.now()), name, seasons });
  }
  saveSeries();
  render();
  formDialog.close();
});

function showError(msg) {
  formError.textContent = msg;
  formError.hidden = false;
}

document.getElementById('cancelBtn').addEventListener('click', () => formDialog.close());
document.getElementById('addBtn').addEventListener('click', () => openForm());

// ---------- תוצאה ----------

const resultDialog = document.getElementById('resultDialog');
const resultBox = resultDialog.querySelector('.result');
const resultSeries = document.getElementById('resultSeries');
const resultSeason = document.getElementById('resultSeason');
const resultEpisode = document.getElementById('resultEpisode');
const resultCode = document.getElementById('resultCode');
const rerollBtn = document.getElementById('rerollBtn');

let currentId = null;
let rollTimer = null;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function draw(id) {
  const s = series.find((x) => x.id === id);
  if (!s) return;
  currentId = id;
  const pick = pickEpisode(s.seasons, s.history ?? []);

  resultSeries.textContent = s.name;
  if (!resultDialog.open) resultDialog.showModal();

  const finish = () => {
    clearInterval(rollTimer);
    rollTimer = null;
    resultBox.classList.remove('rolling');
    resultSeason.textContent = pick.season;
    resultEpisode.textContent = pick.episode;
    resultCode.textContent = `S${pad(pick.season)}E${pad(pick.episode)}`;
    resultBox.classList.remove('landed');
    void resultBox.offsetWidth; // מאפשר להפעיל שוב את האנימציה
    resultBox.classList.add('landed');
    rerollBtn.disabled = false;
    navigator.vibrate?.(30);

    s.history = [pick, ...(s.history ?? [])].slice(0, HISTORY_SIZE);
    saveSeries();
    render();
  };

  clearInterval(rollTimer);
  if (reducedMotion) return finish();

  // אנימציית "גלגול" קצרה לפני חשיפת התוצאה
  rerollBtn.disabled = true;
  resultCode.textContent = ' ';
  resultBox.classList.add('rolling');
  const started = Date.now();
  rollTimer = setInterval(() => {
    const fake = pickEpisode(s.seasons);
    resultSeason.textContent = fake.season;
    resultEpisode.textContent = fake.episode;
    if (Date.now() - started > 700) finish();
  }, 60);
}

rerollBtn.addEventListener('click', () => draw(currentId));
document.getElementById('closeResultBtn').addEventListener('click', () => resultDialog.close());
resultDialog.addEventListener('close', () => {
  if (rollTimer) { clearInterval(rollTimer); rollTimer = null; }
  rerollBtn.disabled = false;
  resultBox.classList.remove('rolling');
});

// ---------- שיתוף ----------
// הרשימה נארזת כולה בתוך הקישור (אחרי #), כך שלא צריך שרת ושום מידע לא נשלח אליו

const SHARE_KEY = 'share=';

function toBase64Url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str) {
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function pipeBytes(bytes, stream) {
  const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

// 'z' = דחוס (קישור קצר יותר), 'j' = JSON רגיל לדפדפנים ישנים
async function encodeList(items) {
  const bytes = new TextEncoder().encode(JSON.stringify(items.map((s) => [s.name, s.seasons])));
  if ('CompressionStream' in window) {
    return 'z' + toBase64Url(await pipeBytes(bytes, new CompressionStream('deflate-raw')));
  }
  return 'j' + toBase64Url(bytes);
}

async function decodeList(code) {
  let bytes = fromBase64Url(code.slice(1));
  if (code[0] === 'z') bytes = await pipeBytes(bytes, new DecompressionStream('deflate-raw'));
  else if (code[0] !== 'j') throw new Error('unknown format');
  const data = JSON.parse(new TextDecoder().decode(bytes));
  if (!Array.isArray(data)) throw new Error('bad data');

  // לא סומכים על תוכן הקישור — מקבלים רק סדרות תקינות
  return data.slice(0, 200).flatMap((item) => {
    if (!Array.isArray(item)) return [];
    const [name, seasons] = item;
    if (typeof name !== 'string' || !name.trim() || !Array.isArray(seasons)) return [];
    if (!seasons.length || seasons.length > 60) return [];
    if (!seasons.every((n) => Number.isInteger(n) && n >= 1 && n <= 999)) return [];
    return [{ name: name.trim().slice(0, 80), seasons }];
  });
}

// מוציא את הקוד מקישור מלא או מהקוד עצמו
function extractCode(text) {
  const i = text.indexOf(SHARE_KEY);
  return (i >= 0 ? text.slice(i + SHARE_KEY.length) : text).trim().split(/[&\s]/)[0];
}

const shareDialog = document.getElementById('shareDialog');
const shareOut = document.getElementById('shareOut');
const shareEmpty = document.getElementById('shareEmpty');
const shareLink = document.getElementById('shareLink');
const shareStatus = document.getElementById('shareStatus');
const nativeShareBtn = document.getElementById('nativeShareBtn');
const pasteInput = document.getElementById('pasteInput');
const pasteError = document.getElementById('pasteError');

async function openShare() {
  const empty = series.length === 0;
  shareOut.hidden = empty;
  shareEmpty.hidden = !empty;
  shareStatus.textContent = '';
  pasteInput.value = '';
  pasteError.hidden = true;
  nativeShareBtn.hidden = !navigator.share;
  if (!empty) {
    const url = new URL(location.href);
    url.search = '';
    url.hash = SHARE_KEY + await encodeList(series);
    shareLink.value = url.href;
  }
  shareDialog.showModal();
}

document.getElementById('shareBtn').addEventListener('click', openShare);
document.getElementById('closeShareBtn').addEventListener('click', () => shareDialog.close());

document.getElementById('copyLinkBtn').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(shareLink.value);
    shareStatus.textContent = 'הקישור הועתק ✓';
  } catch {
    shareLink.select();
    shareStatus.textContent = 'סמנו את הקישור והעתיקו אותו.';
  }
});

nativeShareBtn.addEventListener('click', async () => {
  try {
    await navigator.share({
      title: 'איזה פרק?',
      text: `הסדרות שלי (${series.length}) — הוסיפו אותן לרשימה שלכם:`,
      url: shareLink.value,
    });
  } catch {
    // המשתמש ביטל את השיתוף
  }
});

document.getElementById('pasteImportBtn').addEventListener('click', async () => {
  const code = extractCode(pasteInput.value);
  if (!code) { pasteInput.focus(); return; }
  if (await openImport(code)) shareDialog.close();
  else {
    pasteError.textContent = 'הקישור לא תקין. בדקו שהעתקתם אותו במלואו.';
    pasteError.hidden = false;
  }
});

// ---------- ייבוא ----------

const importDialog = document.getElementById('importDialog');
const importList = document.getElementById('importList');
const confirmImportBtn = document.getElementById('confirmImportBtn');
let incoming = [];

const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

async function openImport(code) {
  try {
    incoming = await decodeList(code);
  } catch {
    incoming = [];
  }
  if (!incoming.length) return false;

  importList.replaceChildren(...incoming.map((s, i) => {
    const exists = series.some((x) => sameName(x.name, s.name));
    const li = document.createElement('li');
    const label = document.createElement('label');
    label.className = 'import-row' + (exists ? ' exists' : '');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.value = i;
    box.checked = !exists;
    box.disabled = exists;
    const text = document.createElement('span');
    text.className = 'import-text';
    const name = document.createElement('strong');
    name.textContent = s.name;
    const meta = document.createElement('small');
    const seasonsWord = s.seasons.length === 1 ? 'עונה אחת' : `${s.seasons.length} עונות`;
    meta.textContent = exists ? 'כבר ברשימה שלך' : `${seasonsWord} · ${s.seasons.reduce((a, b) => a + b, 0)} פרקים`;
    text.append(name, meta);
    label.append(box, text);
    li.append(label);
    return li;
  }));
  updateImportButton();
  importDialog.showModal();
  return true;
}

function updateImportButton() {
  const n = importList.querySelectorAll('input:checked').length;
  confirmImportBtn.textContent = n ? `הוספה (${n})` : 'הוספה';
  confirmImportBtn.disabled = n === 0;
}

importList.addEventListener('change', updateImportButton);
document.getElementById('cancelImportBtn').addEventListener('click', () => importDialog.close());

confirmImportBtn.addEventListener('click', () => {
  const picked = [...importList.querySelectorAll('input:checked')].map((b) => incoming[b.value]);
  const added = picked
    .filter((s) => !series.some((x) => sameName(x.name, s.name)))
    .map((s) => ({ id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, name: s.name, seasons: s.seasons, history: [] }));
  series = [...added, ...series];
  saveSeries();
  render();
  importDialog.close();
});

// קישור שיתוף שנפתח באפליקציה
async function checkSharedLink() {
  const hash = decodeURIComponent(location.hash.slice(1));
  if (!hash.startsWith(SHARE_KEY)) return;
  history.replaceState(null, '', location.pathname + location.search);
  if (!(await openImport(hash.slice(SHARE_KEY.length)))) alert('קישור השיתוף לא תקין.');
}
window.addEventListener('hashchange', checkSharedLink);

// סגירת דיאלוג בלחיצה על הרקע
for (const d of [formDialog, resultDialog, shareDialog, importDialog]) {
  d.addEventListener('click', (e) => {
    if (e.target !== d) return;
    const r = d.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside) d.close();
  });
}

render();
checkSharedLink();

// ---------- PWA ----------

if ('serviceWorker' in navigator) {
  // כשגרסה חדשה נכנסת לפעולה — טוענים מחדש פעם אחת כדי להציג אותה
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => reg.update());
  });
}
