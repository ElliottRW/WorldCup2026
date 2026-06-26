'use strict';

// Pure calculation helpers for the Data tab.
// All functions take state as arguments — no global reads — making them easy to test.

// ── MATCH SCORING (subset) ────────────────────────────────────────────────────

/**
 * Win/draw points for a team within a specific set of matches.
 * Deliberately excludes progression bonuses — useful for per-day / per-round analysis
 * where comparing cumulative bonuses across rounds doesn't make sense.
 */
function matchPtsInSet(displayName, matches) {
  let wins = 0, draws = 0;
  for (const m of matches) {
    if (!['FINISHED', 'IN_PLAY', 'PAUSED'].includes(m.status) || !m.score?.winner) continue;
    if (m.stage !== 'GROUP_STAGE' && m.score.winner === 'DRAW') continue; // ET/pens not resolved yet
    const isHome = getDisplayName(m.homeTeam?.name) === displayName;
    const isAway = getDisplayName(m.awayTeam?.name) === displayName;
    if (!isHome && !isAway) continue; // team not in this match
    if (m.score.winner === 'DRAW')                        draws++;
    else if ((m.score.winner === 'HOME_TEAM') === isHome) wins++;
  }
  return wins * SCORING.WIN + draws * SCORING.DRAW;
}

/**
 * Score all participants against an arbitrary match subset (match pts only).
 * Returns array sorted highest → lowest.
 */
function scoreParticipantsInSet(participants, matches) {
  return participants
    .map(p => {
      let total = 0;
      const breakdown = {};
      for (const team of p.teams) {
        const pts    = matchPtsInSet(team, matches);
        breakdown[team] = pts;
        total           += pts;
      }
      return { ...p, total, breakdown };
    })
    .sort((a, b) => b.total - a.total);
}

// ── BUDGET ANALYTICS ──────────────────────────────────────────────────────────

/** Total draft credits spent by a participant. */
function creditsUsed(participant) {
  return participant.teams.reduce((sum, team) => sum + (TEAM_DATA[team]?.cost ?? 0), 0);
}

/** Points-per-credit ratio, rounded to 2 decimal places. */
function ptsPerCredit(pts, credits) {
  if (!credits) return 0;
  return Math.round((pts / credits) * 100) / 100;
}

// ── POPULARITY ────────────────────────────────────────────────────────────────

/**
 * Returns a Map of teamName → pickCount across all participant entries.
 * Sorted descending by pick count.
 */
function teamPickCounts(participants) {
  const counts = new Map();
  for (const p of participants) {
    for (const team of p.teams) {
      counts.set(team, (counts.get(team) ?? 0) + 1);
    }
  }
  return new Map([...counts.entries()].sort((a, b) => b[1] - a[1]));
}

// ── MATCH DAY ─────────────────────────────────────────────────────────────────

/** Format a Date to a short date key ("11 Jun 2026"). */
function toDateKey(d) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Format a Date to a human-friendly label ("Thu 11 Jun"). */
function toDateLabel(d) {
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/**
 * Returns all calendar dates that had at least one finished match,
 * as an array of { dateKey, label, utcDate } sorted most-recent first.
 */
function allMatchDays(matches) {
  const finished = matches.filter(m => m.status === 'FINISHED');
  const map = new Map();
  for (const m of finished) {
    const d   = new Date(m.utcDate);
    const key = toDateKey(d);
    if (!map.has(key)) map.set(key, { dateKey: key, label: toDateLabel(d), utcDate: m.utcDate });
  }
  return [...map.values()].sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate));
}

/** All matches whose calendar date equals dateKey. */
function matchesOnDate(matches, dateKey) {
  return matches.filter(m => toDateKey(new Date(m.utcDate)) === dateKey);
}

// ── STAGES ────────────────────────────────────────────────────────────────────

/** Stages that have at least one finished match, ordered newest → oldest. */
function completedStages(matches) {
  const STAGE_ORDER = ['FINAL', 'THIRD_PLACE', 'SEMI_FINALS', 'QUARTER_FINALS', 'LAST_16', 'LAST_32', 'GROUP_STAGE'];
  const finished    = new Set(matches.filter(m => m.status === 'FINISHED').map(m => m.stage));
  return STAGE_ORDER.filter(s => finished.has(s));
}

/** The single most recently active stage (most recent finished match's stage). */
function mostRecentStage(matches) {
  const stages = completedStages(matches);
  return stages[0] ?? null;
}

// ── HEADLINE NUMBERS ──────────────────────────────────────────────────────────

/** Sum of all goals across finished matches. */
function totalGoals(matches) {
  return matches
    .filter(m => m.status === 'FINISHED')
    .reduce((sum, m) => sum + (m.score?.fullTime?.home ?? 0) + (m.score?.fullTime?.away ?? 0), 0);
}

/**
 * Set of team canonical names that still have upcoming (TIMED/SCHEDULED) matches.
 * These teams are still in the tournament.
 */
function activeTeams(matches) {
  const upcoming = matches.filter(m => ['TIMED', 'SCHEDULED', 'IN_PLAY', 'PAUSED'].includes(m.status));
  const set      = new Set();
  for (const m of upcoming) {
    const home = getDisplayName(m.homeTeam?.name);
    const away = getDisplayName(m.awayTeam?.name);
    if (home && TEAM_DATA[home]) set.add(home);
    if (away && TEAM_DATA[away]) set.add(away);
  }
  return set;
}

/** Days remaining until the Final (negative = Final has passed). */
function daysToFinal(matches) {
  const final = matches.find(m => m.stage === 'FINAL');
  if (!final) return null;
  return Math.ceil((new Date(final.utcDate) - Date.now()) / 86_400_000);
}

// ── REMAINING POTENTIAL ───────────────────────────────────────────────────────

/**
 * Maximum additional points a single team can still earn from this point.
 * Returns 0 if the team is eliminated (no upcoming matches).
 * Assumes every remaining scheduled match ends in a win.
 */
function teamRemainingPts(team, matches) {
  if (!activeTeams(matches).has(team)) return 0;

  const s = teamStats(team, matches);

  // Remaining group stage match wins (includes IN_PLAY/PAUSED — result still unknown)
  const groupRemain = matches.filter(m =>
    m.stage === 'GROUP_STAGE' &&
    ['TIMED', 'SCHEDULED', 'IN_PLAY', 'PAUSED'].includes(m.status) &&
    (getDisplayName(m.homeTeam?.name) === team || getDisplayName(m.awayTeam?.name) === team)
  ).length * SCORING.WIN;

  // Potential knockout match wins.
  // Unearned stages = not yet reached at all.
  // TIMED knockout fixtures = progression already awarded (team qualified) but match not yet played.
  const knockoutStagesWithWin = ['last32', 'last16', 'quarterfinal', 'semifinal'];
  const unearnedKnockout = knockoutStagesWithWin.filter(st => !s.prog[st]).length * SCORING.WIN;
  const timedKnockoutWins = matches.filter(m =>
    m.stage !== 'GROUP_STAGE' &&
    m.stage !== 'FINAL' &&   // Final win = STAGE bonus ('winner'), not WIN bonus — handled in progRemain
    ['TIMED', 'SCHEDULED'].includes(m.status) &&
    (getDisplayName(m.homeTeam?.name) === team || getDisplayName(m.awayTeam?.name) === team)
  ).length * SCORING.WIN;
  const knockoutRemain = unearnedKnockout + timedKnockoutWins;

  // Remaining progression bonuses
  const earnedCount  = STAGES.filter(st => s.prog[st]).length;
  const progRemain   = (STAGES.length - earnedCount) * SCORING.STAGE;

  return groupRemain + knockoutRemain + progRemain;
}

/**
 * Brute-force search for all tied best 4-team entries within 100 credits,
 * based on points scored so far. C(48,4) = 194,580 combinations — fast enough.
 * Returns { entries: [{teams, cost}], score }.
 */
function bestHindsightEntry(matches) {
  const names  = Object.keys(TEAM_DATA);
  const n      = names.length;
  const scores = names.map(t => teamStats(t, matches).total);
  const costs  = names.map(t => TEAM_DATA[t].cost);

  let bestScore = -1, entries = [];

  for (let i = 0; i < n - 3; i++) {
    for (let j = i + 1; j < n - 2; j++) {
      const cij = costs[i] + costs[j];
      if (cij > 100) continue;
      const sij = scores[i] + scores[j];
      for (let k = j + 1; k < n - 1; k++) {
        const cijk = cij + costs[k];
        if (cijk > 100) continue;
        const sijk = sij + scores[k];
        for (let l = k + 1; l < n; l++) {
          const c4 = cijk + costs[l];
          if (c4 > 100) continue;
          const s4 = sijk + scores[l];
          if (s4 > bestScore) {
            bestScore = s4;
            entries   = [{ teams: [names[i], names[j], names[k], names[l]], cost: c4 }];
          } else if (s4 === bestScore) {
            entries.push({ teams: [names[i], names[j], names[k], names[l]], cost: c4 });
          }
        }
      }
    }
  }

  return { entries, score: bestScore };
}

/**
 * For a participant, returns { current, remaining, max } where:
 *  - current   = points already on the board
 *  - remaining = best-case additional points assuming active teams finish 1st/2nd/3rd/4th
 *  - max       = current + remaining
 *
 * Penalties come from the max-scores table (champion 95, runner-up 85, 3rd 75, 4th 70):
 *   1st: −0  |  2nd: −10  |  3rd: −20  |  4th: −25
 */
function participantMaxPossible(p, matches) {
  const current   = p.teams.reduce((sum, t) => sum + teamStats(t, matches).total, 0);
  const PENALTIES = [0, 10, 20, 25];
  const remaining = p.teams
    .map(t => teamRemainingPts(t, matches))
    .sort((a, b) => b - a)
    .reduce((sum, r, i) => sum + Math.max(0, r - (PENALTIES[i] ?? 25)), 0);
  return { current, remaining, max: current + remaining };
}
