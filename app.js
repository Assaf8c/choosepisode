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

// סגירת דיאלוג בלחיצה על הרקע
for (const d of [formDialog, resultDialog]) {
  d.addEventListener('click', (e) => {
    if (e.target !== d) return;
    const r = d.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside) d.close();
  });
}

render();

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
