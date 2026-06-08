'use strict';

// ── MATCHES TAB ───────────────────────────────────────────────────────────────

// Render order: most prestigious stage first
const STAGE_ORDER = ['FINAL', 'THIRD_PLACE', 'SEMI_FINALS', 'QUARTER_FINALS', 'LAST_16', 'LAST_32', 'GROUP_STAGE'];

function renderMatches() {
  const el = document.getElementById('matches-body');

  if (!_matches?.length) {
    el.innerHTML = `<div class="empty-state"><span class="icon">⏳</span>No results yet — check back once the tournament kicks off.</div>`;
    return;
  }

  // Only show matches that are not yet scheduled/postponed/cancelled
  const active = _matches.filter(m => !['SCHEDULED', 'POSTPONED', 'CANCELLED'].includes(m.status));

  if (!active.length) {
    const next = _matches
      .filter(m => m.status === 'SCHEDULED')
      .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))[0];
    const when = next
      ? new Date(next.utcDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
      : '';
    el.innerHTML = `<div class="empty-state"><span class="icon">⏳</span>No results yet.${when ? `<br><small>First match: ${esc(when)}</small>` : ''}</div>`;
    return;
  }

  // Group matches by stage
  const byStage = {};
  for (const m of active) {
    (byStage[m.stage] = byStage[m.stage] || []).push(m);
  }

  el.innerHTML = STAGE_ORDER
    .filter(stage => byStage[stage])
    .map(stage => buildStageSection(stage, byStage[stage], getActiveStage(byStage)))
    .join('');

  // Wire up accordion toggles
  el.querySelectorAll('.match-section-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const open = btn.classList.toggle('open');
      btn.nextElementSibling.classList.toggle('open', open);
    });
  });
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

/**
 * Determine which stage to open by default.
 * Priority: live matches → stage closest to today's date.
 */
function getActiveStage(byStage) {
  // 1. Any live match wins immediately
  for (const stage of STAGE_ORDER) {
    if (byStage[stage]?.some(m => m.status === 'IN_PLAY' || m.status === 'PAUSED')) {
      return stage;
    }
  }
  // 2. Stage whose matches are temporally closest to now
  const now = Date.now();
  let activeStage = null;
  let bestDist    = Infinity;
  for (const stage of STAGE_ORDER) {
    if (!byStage[stage]) continue;
    const dist = Math.min(...byStage[stage].map(m => Math.abs(new Date(m.utcDate) - now)));
    if (dist < bestDist) { bestDist = dist; activeStage = stage; }
  }
  return activeStage;
}

/** Build the collapsible section HTML for one stage. */
function buildStageSection(stage, matches, activeStage) {
  const isOpen  = stage === activeStage;
  const label   = MATCH_STAGE_LABELS[stage] || stage;
  const content = buildMatchRows(matches);

  return `<div class="match-section">
    <button class="match-section-toggle${isOpen ? ' open' : ''}" data-stage="${esc(stage)}">
      <span>${label}</span>
      <span class="chevron">▾</span>
    </button>
    <div class="match-section-body${isOpen ? ' open' : ''}">
      ${content}
    </div>
  </div>`;
}

/** Build match rows for a single stage, grouped by calendar day. */
function buildMatchRows(matches) {
  const sorted = matches.slice().sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
  let currentDay = null;
  const parts   = [];

  for (const m of sorted) {
    const d      = new Date(m.utcDate);
    const dayKey = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    const time   = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const live   = m.status === 'IN_PLAY' || m.status === 'PAUSED';
    const home   = getDisplayName(m.homeTeam?.name) || '?';
    const away   = getDisplayName(m.awayTeam?.name) || '?';
    const hg     = m.score?.fullTime?.home ?? '–';
    const ag     = m.score?.fullTime?.away ?? '–';
    const hw     = m.score?.winner === 'HOME_TEAM';
    const aw     = m.score?.winner === 'AWAY_TEAM';

    if (dayKey !== currentDay) {
      currentDay = dayKey;
      parts.push(`<div class="match-day-header">${esc(dayKey)}</div>`);
    }

    const homeCrest = m.homeTeam?.crest ? `<img class="crest" src="${esc(m.homeTeam.crest)}" alt="">` : '';
    const awayCrest = m.awayTeam?.crest ? `<img class="crest" src="${esc(m.awayTeam.crest)}" alt="">` : '';
    const meta      = live ? '<span class="live-dot"></span>LIVE' : esc(time);

    parts.push(`<div class="match-card">
      <span class="match-team${hw ? ' bold' : ''}"><span class="team-name">${esc(home)}</span>${homeCrest}</span>
      <span class="match-score${live ? ' live' : ''}">${hg} – ${ag}</span>
      <span class="match-team right${aw ? ' bold' : ''}">${awayCrest}<span class="team-name">${esc(away)}</span></span>
      <span class="match-meta">${meta}</span>
    </div>`);
  }

  return parts.join('\n');
}
