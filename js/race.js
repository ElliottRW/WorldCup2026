'use strict';

// ── LEADERBOARD RACE (position bump chart) ────────────────────────────────────
// A line graph of POSITIONS: one line per participant, y = league rank (1 at the
// top), x = each match day of the tournament. Lines cross whenever people swap
// places, so you can trace exactly how the eventual leader climbed to first.
//
// Each day's rank comes from the exact tournament scoring (teamStats — match
// points + progression bonuses) applied only to matches played up to that day.
// Press play (or drag the slider) to draw the lines in day by day.

const RACE_FRAME_MS = 700;   // default ms between days

// Layout (SVG user units == px; chart scrolls if wider/taller than its card)
const RACE_LANE_H = 20;      // vertical gap between rank lanes
const RACE_M      = { t: 18, r: 124, b: 36, l: 34 };

// Persistent state so the 60s auto-refresh doesn't restart an animation
let _raceSig    = null;
let _raceDays   = null;   // [{ label }]
let _racePlayers= null;   // [{ name, emailUser, color, top, pts:[], rank:[], xy:[{x,y}] }]
let _raceIdx    = 0;
let _raceTimer  = null;
let _raceSpeed  = RACE_FRAME_MS;
let _raceFocus  = null;   // locked participant name (click to pin)

/** Stable, evenly-spread colour for a participant (golden-angle HSL). */
function raceColor(i) {
  const hue = (i * 137.508) % 360;
  return `hsl(${hue.toFixed(0)} 58% 48%)`;
}

const RACE_MEDAL_COLORS = ['#c8a028', '#7d8794', '#b45309']; // gold / silver / bronze lines

/**
 * Build per-day ranks for every participant.
 * Returns { days:[{label}], players:[{name, rank:[], pts:[]}], N } or null.
 */
function buildRaceData() {
  const parts = viewParticipants();
  if (!parts?.length || !_matches?.length) return null;

  // Frame days = any date with a finished match, plus upcoming knockout fixtures
  // (their +10 "reach" bonus is locked in as soon as the fixture appears), so the
  // final frame stays in step with the live Leaderboard.
  const relevant = _matches.filter(m =>
    m.status === 'FINISHED' ||
    (m.stage !== 'GROUP_STAGE' && ['TIMED', 'SCHEDULED', 'IN_PLAY', 'PAUSED'].includes(m.status))
  );
  const dayMap = new Map();
  for (const m of relevant) {
    const d = new Date(m.utcDate);
    const key = toDateKey(d);
    if (!dayMap.has(key)) dayMap.set(key, { dateKey: key, label: toDateLabel(d), utcDate: m.utcDate });
  }
  const days = [...dayMap.values()].sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
  if (!days.length) return null;

  // Colour is keyed to a stable (alphabetical) index so it never shifts between refreshes.
  const colorOf = new Map(parts.map(p => p.name).sort().map((n, i) => [n, raceColor(i)]));

  const players = parts.map(p => ({
    name: p.name, emailUser: p.emailUser, color: colorOf.get(p.name),
    rank: [], pts: [],
  }));
  const byName = new Map(players.map(pl => [pl.name, pl]));

  const seen = new Set();
  days.forEach(({ dateKey }) => {
    seen.add(dateKey);
    const upto = _matches.filter(m => seen.has(toDateKey(new Date(m.utcDate))));
    // Total for each participant on this day
    const totals = parts.map(p => ({
      name: p.name,
      total: p.teams.reduce((s, t) => s + teamStats(t, upto).total, 0),
    }));
    // Unique competition rank (ties broken by name so every line keeps its own lane)
    totals.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
    totals.forEach((r, i) => {
      const pl = byName.get(r.name);
      pl.rank.push(i + 1);
      pl.pts.push(r.total);
    });
  });

  // Mark the final top-3 for medal styling
  const finalOrder = players.slice().sort((a, b) => a.rank.at(-1) - b.rank.at(-1));
  finalOrder.forEach((pl, i) => { pl.top = i < 3 ? i : null; });

  return { days, players, N: parts.length };
}

// ── RENDER ────────────────────────────────────────────────────────────────────

// Coordinate helpers rebuilt on each draw and captured by showRaceFrame
let _raceGeom = null;

function renderRace() {
  const wrap = document.getElementById('tab-race');
  if (!wrap) return;
  const host = document.getElementById('race-chart');
  if (!host) return;

  if (!viewParticipants()?.length || !_matches?.length) {
    stopRace();
    host.innerHTML = `<div class="empty-state"><span class="icon">📈</span>The position graph will appear once entries and match results are available.</div>`;
    _raceSig = null;
    return;
  }

  const data = buildRaceData();
  if (!data) return;

  // Only rebuild when the underlying data actually changed (keeps animations alive)
  const sig = `${data.days.length}:${data.N}:${data.players.map(p => p.name + p.rank.join('.')).join('|')}`;
  if (sig === _raceSig && _racePlayers) return;
  _raceSig     = sig;
  _raceDays    = data.days;
  _racePlayers = data.players;
  _raceFocus   = null;
  stopRace();

  drawRaceSvg(host, data);

  const slider = document.getElementById('race-slider');
  slider.max   = String(data.days.length - 1);
  slider.value = String(data.days.length - 1);
  slider.oninput = () => { stopRace(); showRaceFrame(Number(slider.value)); };
  document.getElementById('race-play').onclick = toggleRace;
  const speedSel = document.getElementById('race-speed');
  speedSel.onchange = () => { _raceSpeed = Number(speedSel.value); if (_raceTimer) startRace(); };

  // Land on the final standings; Play rewinds and draws the lines in.
  showRaceFrame(data.days.length - 1);
}

function drawRaceSvg(host, { days, players, N }) {
  const SVGNS = 'http://www.w3.org/2000/svg';
  const nDays = days.length;
  const plotW = Math.max(520, (nDays - 1) * 26);
  const plotH = Math.max(RACE_LANE_H, (N - 1) * RACE_LANE_H);
  const W = RACE_M.l + plotW + RACE_M.r;
  const H = RACE_M.t + plotH + RACE_M.b;

  const x = i    => RACE_M.l + (nDays <= 1 ? 0 : (i / (nDays - 1)) * plotW);
  const y = rank => RACE_M.t + (rank - 1) * RACE_LANE_H;
  _raceGeom = { x, y, plotW, plotH, W, H, nDays, N };

  // Precompute every player's full point list of {x,y}
  players.forEach(pl => { pl.xy = pl.rank.map((r, i) => ({ x: x(i), y: y(r) })); });

  const el = (name, attrs = {}, text) => {
    const n = document.createElementNS(SVGNS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  };

  const svg = el('svg', {
    class: 'race-svg', width: W, height: H, viewBox: `0 0 ${W} ${H}`,
    role: 'img', 'aria-label': 'Participant position over each match day',
  });

  // Rank gridlines + y-axis numbers (1, 5, 10, …, N)
  const gAxis = el('g', { class: 'race-axis' });
  for (let r = 1; r <= N; r++) {
    if (r === 1 || r === N || r % 5 === 0) {
      gAxis.appendChild(el('line', { class: 'race-grid', x1: RACE_M.l, x2: RACE_M.l + plotW, y1: y(r), y2: y(r) }));
      gAxis.appendChild(el('text', { class: 'race-yn', x: RACE_M.l - 6, y: y(r) + 3, 'text-anchor': 'end' }, r));
    }
  }
  svg.appendChild(gAxis);

  // X-axis date labels (about 8, evenly spaced, always incl. first & last)
  const gX = el('g', { class: 'race-axis' });
  const step = Math.max(1, Math.ceil(nDays / 8));
  for (let i = 0; i < nDays; i += step) {
    gX.appendChild(el('text', { class: 'race-xn', x: x(i), y: H - RACE_M.b + 16, 'text-anchor': 'middle' }, days[i].label));
  }
  if ((nDays - 1) % step !== 0) {
    gX.appendChild(el('text', { class: 'race-xn', x: x(nDays - 1), y: H - RACE_M.b + 16, 'text-anchor': 'middle' }, days[nDays - 1].label));
  }
  svg.appendChild(gX);

  // Moving day cursor
  const cursor = el('line', { class: 'race-cursor', x1: x(0), x2: x(0), y1: RACE_M.t - 4, y2: RACE_M.t + plotH + 4 });
  svg.appendChild(cursor);

  // One path + one right-edge label per participant
  const gLines  = el('g', { class: 'race-lines' });
  const gLabels = el('g', { class: 'race-labels' });
  const labelX  = RACE_M.l + plotW + 8;
  players.forEach(pl => {
    const medal = pl.top != null;
    pl.color = medal ? RACE_MEDAL_COLORS[pl.top] : pl.color;
    const path = el('path', {
      class: `race-line${medal ? ' top' : ''}`, 'data-name': pl.name,
      stroke: pl.color, d: '',
    });
    gLines.appendChild(path);
    pl.pathEl = path;

    const label = el('text', {
      class: `race-lbl${medal ? ' top' : ''}`, 'data-name': pl.name,
      x: labelX, y: 0, fill: pl.color,
    }, pl.name);
    gLabels.appendChild(label);
    pl.labelEl = label;
  });
  svg.appendChild(gLines);
  svg.appendChild(gLabels);
  svg.appendChild(el('line', { class: 'race-baseline', x1: RACE_M.l, x2: RACE_M.l, y1: RACE_M.t - 4, y2: RACE_M.t + plotH + 4 }));

  // Hover / click to isolate a line
  svg.addEventListener('mouseover', e => {
    const name = e.target.getAttribute?.('data-name');
    if (name && !_raceFocus) applyRaceHighlight(name);
  });
  svg.addEventListener('mouseout', e => {
    const name = e.target.getAttribute?.('data-name');
    if (name && !_raceFocus) applyRaceHighlight(null);
  });
  svg.addEventListener('click', e => {
    const name = e.target.getAttribute?.('data-name');
    if (!name) { _raceFocus = null; applyRaceHighlight(null); return; }
    _raceFocus = (_raceFocus === name) ? null : name;
    applyRaceHighlight(_raceFocus);
  });

  host.innerHTML = '';
  host.appendChild(svg);
  _raceGeom.svg = svg;
  _raceGeom.cursor = cursor;
}

function applyRaceHighlight(name) {
  const svg = _raceGeom?.svg;
  if (!svg) return;
  svg.classList.toggle('focusing', !!name);
  _racePlayers.forEach(pl => {
    const on = pl.name === name;
    pl.pathEl.classList.toggle('active', on);
    pl.labelEl.classList.toggle('active', on);
  });
}

/** Draw every line up to day i and slot the right-edge labels into current order. */
function showRaceFrame(i) {
  if (!_racePlayers || !_raceGeom) return;
  const { nDays } = _raceGeom;
  _raceIdx = Math.max(0, Math.min(i, nDays - 1));

  _racePlayers.forEach(pl => {
    const pts = pl.xy.slice(0, _raceIdx + 1);
    pl.pathEl.setAttribute('d', pts.map((p, k) => `${k ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' '));
    // Label glides (via CSS transform transition) to its current rank lane
    pl.labelEl.setAttribute('transform', `translate(0,${(_raceGeom.y(pl.rank[_raceIdx]) + 3).toFixed(1)})`);
    pl.labelEl.textContent = `${pl.rank[_raceIdx]}. ${pl.name}`;
  });

  const cx = _raceGeom.x(_raceIdx);
  _raceGeom.cursor.setAttribute('x1', cx);
  _raceGeom.cursor.setAttribute('x2', cx);

  document.getElementById('race-slider').value = String(_raceIdx);
  document.getElementById('race-date').textContent =
    `${_raceDays[_raceIdx].label}  ·  Day ${_raceIdx + 1} of ${nDays}`;
  setRacePlayLabel(!!_raceTimer);
}

// ── PLAYBACK ──────────────────────────────────────────────────────────────────

function toggleRace() {
  if (_raceTimer) { stopRace(); return; }
  if (_raceIdx >= _raceDays.length - 1) showRaceFrame(0);
  startRace();
}
function startRace() {
  clearInterval(_raceTimer);
  setRacePlayLabel(true);
  _raceTimer = setInterval(() => {
    if (_raceIdx >= _raceDays.length - 1) { stopRace(); return; }
    showRaceFrame(_raceIdx + 1);
  }, _raceSpeed);
}
function stopRace() {
  clearInterval(_raceTimer);
  _raceTimer = null;
  setRacePlayLabel(false);
}
function setRacePlayLabel(playing) {
  const btn = document.getElementById('race-play');
  if (!btn) return;
  const atEnd = _raceDays && _raceIdx >= _raceDays.length - 1;
  btn.textContent = playing ? '❚❚ Pause' : (atEnd ? '↻ Replay' : '▶ Play');
}
