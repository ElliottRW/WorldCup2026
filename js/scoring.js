'use strict';

// ── UTILITIES ─────────────────────────────────────────────────────────────────

/** HTML-escape a value for safe insertion into markup. */
const esc = s => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/**
 * Render a participant's display name, wrapped in a tooltip span when an
 * email username is available — helps disambiguate abbreviated or duplicate names.
 * e.g. "John S" → hovers to show "John.Stephenson"
 */
function nameWithTip(p) {
  if (!p.emailUser) return esc(p.name);
  return `<span class="has-tip" data-tip="${esc(p.emailUser)}">${esc(p.name)}</span>`;
}

/** Human-readable "time ago" string from a timestamp. */
function timeAgo(ts) {
  if (!ts) return '';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60)   return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

// ── NAME NORMALISATION ────────────────────────────────────────────────────────

/**
 * Map an API team name to the canonical display name used in TEAM_DATA.
 * Falls back to the raw value if no match is found.
 */
function getDisplayName(name) {
  if (!name) return null;
  if (API_NAME_MAP[name]) return API_NAME_MAP[name];
  if (TEAM_DATA[name])    return name;
  const lower = name.toLowerCase();
  for (const key of Object.keys(TEAM_DATA)) {
    if (key.toLowerCase() === lower) return key;
  }
  return name;
}

/**
 * Resolve a raw string (e.g. from a CSV or form submission) to the canonical
 * team name in TEAM_DATA. Returns null if no match found.
 */
function findTeam(raw) {
  const s = raw.trim();
  if (TEAM_DATA[s])    return s;
  if (API_NAME_MAP[s]) return API_NAME_MAP[s];
  const lower = s.toLowerCase();
  for (const key of Object.keys(TEAM_DATA)) {
    if (key.toLowerCase() === lower) return key;
  }
  return null;
}

// ── SCORING CALCULATOR ────────────────────────────────────────────────────────

/**
 * Calculate a team's match record, progression milestones, and total score
 * from a list of match objects (as returned by the football-data.org API).
 *
 * Scoring rules (defined in SCORING in data.js):
 *   Win  → SCORING.WIN  pts  (group stage + knockout rounds, NOT the Final)
 *   Draw → SCORING.DRAW pts (group stage only in practice)
 *   Each knockout stage reached → SCORING.STAGE pts
 *     Stages: Last 32, Last 16, Quarter-final, Semi-final, Final, Winner
 *   The Final match result is NOT counted as a win — instead the team earns
 *   +SCORING.STAGE for reaching the Final and +SCORING.STAGE for winning it.
 *
 * Progression is appearance-based — reaching a stage earns the bonus
 * regardless of the result in that round.
 */
function teamStats(displayName, matches) {
  // Matches involving this team
  const mine = matches.filter(m =>
    getDisplayName(m.homeTeam?.name) === displayName ||
    getDisplayName(m.awayTeam?.name) === displayName
  );

  // Win / draw / loss tally from completed matches.
  // The Final is excluded — it is rewarded purely via the 'final' and 'winner'
  // progression bonuses (+10 each), not as a regular match win (+5).
  // Knockout stages (non-group) never have draws — they go to ET/pens.
  // If score.winner is still DRAW for a knockout match the data isn't resolved yet; skip it.
  let wins = 0, draws = 0, losses = 0;
  for (const m of mine) {
    if (!['FINISHED', 'IN_PLAY', 'PAUSED'].includes(m.status) || !m.score?.winner) continue;
    if (m.stage === 'FINAL') continue;
    if (m.stage !== 'GROUP_STAGE' && m.score.winner === 'DRAW') continue;
    const isHome = getDisplayName(m.homeTeam?.name) === displayName;
    if (m.score.winner === 'DRAW')                          draws++;
    else if ((m.score.winner === 'HOME_TEAM') === isHome)   wins++;
    else                                                    losses++;
  }

  // Stages this team has appeared in (completed or live)
  const playedStages = new Set(
    mine
      .filter(m => ['FINISHED', 'IN_PLAY', 'PAUSED'].includes(m.status))
      .map(m => m.stage)
  );

  // Progression milestones — cumulative (reaching Last 16 implies Last 32, etc.)
  const last32       = ['LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL'].some(s => playedStages.has(s));
  const last16       = ['LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL'].some(s => playedStages.has(s));
  const quarterfinal = ['QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL'].some(s => playedStages.has(s));
  const semifinal    = ['SEMI_FINALS', 'THIRD_PLACE', 'FINAL'].some(s => playedStages.has(s));
  const final        = playedStages.has('FINAL');

  // Winner — must have won the Final match specifically
  let winner = false;
  const finalMatch = matches.find(m => m.stage === 'FINAL' && m.status === 'FINISHED');
  if (finalMatch?.score?.winner) {
    const isHome = getDisplayName(finalMatch.homeTeam?.name) === displayName;
    winner = (finalMatch.score.winner === 'HOME_TEAM' && isHome) ||
             (finalMatch.score.winner === 'AWAY_TEAM' && !isHome);
  }

  const prog     = { last32, last16, quarterfinal, semifinal, final, winner };
  const progPts  = STAGES.filter(s => prog[s]).length * SCORING.STAGE;
  const matchPts = wins * SCORING.WIN + draws * SCORING.DRAW;

  return { wins, draws, losses, matchPts, prog, progPts, total: matchPts + progPts };
}
