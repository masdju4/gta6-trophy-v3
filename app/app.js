// app.js — orchestrates the GTA VI trophy guide & tracker: loads the official data,
// renders the checklist and detail panel, wires filters, the spoiler guard, progress
// persistence, export/import, the roadmap view, and deep-linkable URL hash state.
// Everything runs offline from relative paths; only source links point outward.

import { loadEarned, saveEarned, exportProgress, importProgress } from './storage.js';
import { renderRoadmap } from './roadmap.js';

const GRADE_LABEL = { platinum: 'Platinum', gold: 'Gold', silver: 'Silver', bronze: 'Bronze' };
const KIND_LABEL = { story: 'Story', collectible: 'Collectible', activity: 'Activity', online: 'Online' };
const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'story', label: 'Story' },
  { id: 'collectible', label: 'Collectibles' },
  { id: 'activity', label: 'Activities' },
  { id: 'online', label: 'Online' },
  { id: 'missable', label: 'Missable' },
  { id: 'unearned', label: 'Unearned' },
];

const state = { view: 'checklist', filter: 'all', spoilers: 'on', selected: null, search: '' };
let trophies = [];
let gameName = 'Grand Theft Auto VI';
let earned = loadEarned();
const bySlug = new Map();

// --- naming & spoiler helpers -------------------------------------------------

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// The spoiler guard masks unearned STORY trophies (name + description) to ???.
function isMasked(t) {
  return state.spoilers === 'on' && t.kind === 'story' && !earned.has(t.name);
}
function displayName(t) {
  return isMasked(t) ? '???' : t.name;
}
function displayDescription(t) {
  return isMasked(t) ? '???' : t.description;
}

// --- URL hash state (deep-linkable for screenshots) ---------------------------

function readHash() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  const view = params.get('view');
  if (view === 'checklist' || view === 'roadmap') state.view = view;
  const filter = params.get('filter');
  if (FILTERS.some((f) => f.id === filter)) state.filter = filter;
  const spoilers = params.get('spoilers');
  if (spoilers === 'on' || spoilers === 'off') state.spoilers = spoilers;
  const slug = params.get('trophy');
  if (slug && bySlug.has(slug)) state.selected = bySlug.get(slug);
}

function writeHash() {
  const params = new URLSearchParams();
  params.set('view', state.view);
  params.set('filter', state.filter);
  params.set('spoilers', state.spoilers);
  if (state.selected) params.set('trophy', slugify(state.selected.name));
  history.replaceState(null, '', '#' + params.toString());
}

// --- filtering ----------------------------------------------------------------

function matchesFilter(t) {
  switch (state.filter) {
    case 'story': return t.kind === 'story';
    case 'collectible': return t.kind === 'collectible';
    case 'activity': return t.kind === 'activity';
    case 'online': return t.kind === 'online';
    case 'missable': return t.missable;
    case 'unearned': return !earned.has(t.name);
    default: return true;
  }
}

function visibleTrophies() {
  const q = state.search.trim().toLowerCase();
  return trophies.filter((t) => {
    if (!matchesFilter(t)) return false;
    if (!q) return true;
    return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
  });
}

// --- small DOM builders -------------------------------------------------------

function gradeBadge(grade) {
  const badge = document.createElement('span');
  badge.className = `grade-badge grade-${grade}`;
  const dot = document.createElement('span');
  dot.className = 'grade-dot';
  const text = document.createElement('span');
  text.textContent = GRADE_LABEL[grade];
  badge.append(dot, text);
  return badge;
}

function chip(text, className) {
  const el = document.createElement('span');
  el.className = `meta-chip ${className || ''}`;
  el.textContent = text;
  return el;
}

// --- progress header ----------------------------------------------------------

function renderProgress() {
  const total = trophies.length;
  const count = earned.size;
  const pct = total ? Math.round((count / total) * 100) : 0;
  document.getElementById('progress-text').textContent = `${count} of ${total} earned`;
  document.getElementById('progress-pct').textContent = `${pct}%`;
  document.getElementById('progress-fill').style.width = `${pct}%`;
  const plat = trophies.find((t) => t.grade === 'platinum');
  const platDone = plat && earned.has(plat.name);
  const status = document.getElementById('platinum-status');
  status.textContent = platDone ? '★ Platinum unlocked — Leonida Legend!' : '☆ Platinum locked';
  status.classList.toggle('unlocked', Boolean(platDone));

  const breakdown = document.getElementById('grade-breakdown');
  breakdown.replaceChildren();
  for (const grade of ['platinum', 'gold', 'silver', 'bronze']) {
    const group = trophies.filter((t) => t.grade === grade);
    const done = group.filter((t) => earned.has(t.name)).length;
    const item = document.createElement('span');
    item.className = `breakdown-item grade-text-${grade}`;
    item.textContent = `${GRADE_LABEL[grade]} ${done}/${group.length}`;
    breakdown.append(item);
  }
}

// --- filter bar ---------------------------------------------------------------

function buildFilterBar() {
  const bar = document.getElementById('filter-bar');
  bar.replaceChildren();
  for (const f of FILTERS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'filter-btn';
    btn.dataset.filter = f.id;
    btn.textContent = f.label;
    btn.addEventListener('click', () => {
      state.filter = f.id;
      render();
    });
    bar.append(btn);
  }
}

function updateFilterBar() {
  for (const btn of document.querySelectorAll('.filter-btn')) {
    const active = btn.dataset.filter === state.filter;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  }
}

// --- checklist ----------------------------------------------------------------

function renderChecklist() {
  const list = document.getElementById('trophy-list');
  list.replaceChildren();
  const shown = visibleTrophies();

  if (state.filter === 'online' && shown.length === 0) {
    const note = document.createElement('div');
    note.className = 'empty-note';
    note.textContent = 'No online trophies in the official PS5 list — all 55 are earnable offline.';
    list.append(note);
  } else if (shown.length === 0) {
    const note = document.createElement('div');
    note.className = 'empty-note';
    note.textContent = 'No trophies match this filter.';
    list.append(note);
  }

  for (const t of shown) {
    const card = document.createElement('article');
    card.className = 'trophy-card';
    card.classList.toggle('is-earned', earned.has(t.name));
    card.classList.toggle('is-selected', state.selected === t);
    card.tabIndex = 0;

    const box = document.createElement('input');
    box.type = 'checkbox';
    box.className = 'earned-box';
    box.checked = earned.has(t.name);
    box.setAttribute('aria-label', `Mark ${t.name} earned`);
    box.addEventListener('click', (e) => e.stopPropagation());
    box.addEventListener('change', () => {
      if (box.checked) earned.add(t.name);
      else earned.delete(t.name);
      saveEarned(earned);
      render();
    });

    const body = document.createElement('div');
    body.className = 'trophy-body';
    const top = document.createElement('div');
    top.className = 'trophy-top';
    const name = document.createElement('h3');
    name.className = 'trophy-name';
    name.textContent = displayName(t);
    top.append(name, gradeBadge(t.grade));
    const desc = document.createElement('p');
    desc.className = 'trophy-desc';
    desc.textContent = displayDescription(t);
    const meta = document.createElement('div');
    meta.className = 'trophy-meta';
    meta.append(chip(KIND_LABEL[t.kind], `kind-${t.kind}`));
    meta.append(chip(`Stage ${t.stage}`, 'kind-stage'));
    if (t.missable) meta.append(chip('⚠ Missable', 'kind-missable'));
    if (t.hidden) meta.append(chip('Hidden', 'kind-hidden'));
    body.append(top, desc, meta);

    card.append(box, body);
    card.addEventListener('click', () => selectTrophy(t));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectTrophy(t);
      }
    });
    list.append(card);
  }
  document.getElementById('result-count').textContent = `${shown.length} shown`;
}

// --- detail panel -------------------------------------------------------------

function renderDetail() {
  const panel = document.getElementById('detail-panel');
  panel.replaceChildren();
  const t = state.selected;

  if (!t) {
    const hint = document.createElement('div');
    hint.className = 'detail-empty';
    hint.innerHTML = '';
    const h = document.createElement('h3');
    h.textContent = 'Trophy guide';
    const p = document.createElement('p');
    p.textContent = 'Select any trophy to read its guide, missable warning and cited sources.';
    hint.append(h, p);
    panel.append(hint);
    return;
  }

  const head = document.createElement('div');
  head.className = 'detail-head';
  const name = document.createElement('h2');
  name.textContent = displayName(t);
  head.append(name, gradeBadge(t.grade));
  panel.append(head);

  const meta = document.createElement('div');
  meta.className = 'trophy-meta';
  meta.append(chip(KIND_LABEL[t.kind], `kind-${t.kind}`));
  meta.append(chip(`Stage ${t.stage}`, 'kind-stage'));
  if (t.missable) meta.append(chip('⚠ Missable', 'kind-missable'));
  if (t.hidden) meta.append(chip('Hidden on PSN', 'kind-hidden'));
  panel.append(meta);

  const desc = document.createElement('p');
  desc.className = 'detail-desc';
  desc.textContent = displayDescription(t);
  panel.append(desc);

  if (isMasked(t)) {
    const lock = document.createElement('p');
    lock.className = 'detail-locked';
    lock.textContent = '🔒 Story spoiler guarded. Earn this trophy (or switch the spoiler guard off) to reveal its guide and sources.';
    panel.append(lock);
  } else {
    if (t.missable) {
      const warn = document.createElement('p');
      warn.className = 'detail-missable';
      warn.textContent = '⚠ Missable — ' + t.roadmapNote;
      panel.append(warn);
    }
    const guideTitle = document.createElement('h4');
    guideTitle.textContent = 'How to earn it';
    const guide = document.createElement('p');
    guide.className = 'detail-guide';
    guide.textContent = t.guide;
    panel.append(guideTitle, guide);

    const note = document.createElement('p');
    note.className = 'detail-roadmap-note';
    note.textContent = 'Roadmap: ' + t.roadmapNote;
    panel.append(note);

    const srcTitle = document.createElement('h4');
    srcTitle.textContent = 'Sources';
    const srcList = document.createElement('ul');
    srcList.className = 'source-list';
    for (const s of t.sources) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = s.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = s.label;
      li.append(a);
      srcList.append(li);
    }
    panel.append(srcTitle, srcList);
  }

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'detail-toggle';
  toggle.classList.toggle('is-earned', earned.has(t.name));
  toggle.textContent = earned.has(t.name) ? '✓ Earned — click to unmark' : 'Mark as earned';
  toggle.addEventListener('click', () => {
    if (earned.has(t.name)) earned.delete(t.name);
    else earned.add(t.name);
    saveEarned(earned);
    render();
  });
  panel.append(toggle);
}

function selectTrophy(t) {
  state.selected = t;
  state.view = 'checklist';
  render();
  document.getElementById('detail-panel').scrollIntoView({ block: 'nearest' });
}

// --- roadmap view -------------------------------------------------------------

function renderRoadmapView() {
  renderRoadmap(document.getElementById('roadmap-container'), trophies, {
    earned,
    spoilersOn: state.spoilers === 'on',
    onSelect: selectTrophy,
  });
}

// --- top-level render ---------------------------------------------------------

function render() {
  renderProgress();
  updateFilterBar();
  const checklistView = document.getElementById('checklist-view');
  const roadmapView = document.getElementById('roadmap-view');
  const isChecklist = state.view === 'checklist';
  checklistView.hidden = !isChecklist;
  roadmapView.hidden = isChecklist;
  document.getElementById('filter-bar').hidden = !isChecklist;
  document.getElementById('search-wrap').hidden = !isChecklist;
  document.getElementById('result-count').hidden = !isChecklist;
  for (const tab of document.querySelectorAll('.view-tab')) {
    tab.classList.toggle('active', tab.dataset.view === state.view);
  }
  document.getElementById('spoiler-toggle').checked = state.spoilers === 'on';
  if (isChecklist) {
    renderChecklist();
    renderDetail();
  } else {
    renderRoadmapView();
  }
  writeHash();
}

// --- events & init ------------------------------------------------------------

function wireEvents() {
  for (const tab of document.querySelectorAll('.view-tab')) {
    tab.addEventListener('click', () => {
      state.view = tab.dataset.view;
      render();
    });
  }
  document.getElementById('spoiler-toggle').addEventListener('change', (e) => {
    state.spoilers = e.target.checked ? 'on' : 'off';
    render();
  });
  document.getElementById('search-input').addEventListener('input', (e) => {
    state.search = e.target.value;
    renderChecklist();
    writeHash();
  });
  document.getElementById('export-btn').addEventListener('click', () => {
    exportProgress(earned, gameName);
  });
  const importInput = document.getElementById('import-input');
  document.getElementById('import-btn').addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      earned = await importProgress(file, trophies.map((t) => t.name));
      saveEarned(earned);
      render();
      flashStatus(`Imported ${earned.size} earned trophies.`);
    } catch (err) {
      flashStatus('Import failed: ' + err.message, true);
    }
    importInput.value = '';
  });
  document.getElementById('reset-btn').addEventListener('click', () => {
    if (!confirm('Clear all earned progress?')) return;
    earned = new Set();
    saveEarned(earned);
    render();
    flashStatus('Progress cleared.');
  });
  window.addEventListener('hashchange', () => {
    readHash();
    render();
  });
}

let statusTimer = null;
function flashStatus(msg, isError) {
  const el = document.getElementById('status-line');
  el.textContent = msg;
  el.classList.toggle('error', Boolean(isError));
  el.hidden = false;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    el.hidden = true;
  }, 4000);
}

async function init() {
  const res = await fetch('data/trophies.json');
  const data = await res.json();
  trophies = data.trophies;
  gameName = data.game || gameName;
  for (const t of trophies) bySlug.set(slugify(t.name), t);
  buildFilterBar();
  wireEvents();
  readHash();
  render();
}

init();