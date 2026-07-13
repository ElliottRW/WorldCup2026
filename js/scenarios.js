'use strict';

// ── PODIUM SCENARIOS ──────────────────────────────────────────────────────────
//
// Once the tournament is down to the final four, there are only four matches
// left: two semi-finals, a 3rd-place play-off, and the Final. This module
// brute-forces every combination of results for those matches (2^4 = 16) and
// works out exactly who finishes 1st, 2nd and 3rd in each one.
//
// It only understands that one bracket shape — two semis feeding a 3rd-place
// play-off (losers) and a Final (winners) — because that's all that's left
// once the quarter-finals are done. If earlier rounds still have fixtures
// to play, resolveBracket() returns null and renderScenarios() shows a
// "not yet" message instead of guessing at a bigger bracket.

/**
 * Enumerate every possible resolution of the semis → 3rd place → Final
 * bracket. Each scenario is a full copy of `matches` with those fixtures
 * marked FINISHED (with a winner), ready to feed straight into the existing
 * teamStats() engine — no separate scoring logic needed.
 *
 * Returns null if the match list doesn't have the expected final-four shape
 * yet (i.e. the semi-finals aren't both set).
 */
function resolveBracket(matches) {
  const semis = matches
    .filter(m => m.stage === 'SEMI_FINALS')
    .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
  const thirdPlace = matches.find(m => m.stage === 'THIRD_PLACE');
  const final       = matches.find(m => m.stage === 'FINAL');

  if (semis.length !== 2 || !thirdPlace || !final) return null;
  if (semis.some(m => !m.homeTeam?.name || !m.awayTeam?.name)) return null;

  // Which sides of a match are still "live" possibilities — one if it's
  // already been played, both if it hasn't.
  const sideOptions = m => (m.status === 'FINISHED' && m.score?.winner)
    ? [m.score.winner === 'HOME_TEAM' ? 'home' : 'away']
    : ['home', 'away'];

  const tpFixed = thirdPlace.status === 'FINISHED' && thirdPlace.score?.winner;
  const fFixed  = final.status === 'FINISHED' && final.score?.winner;

  const scenarios = [];

  for (const s1 of sideOptions(semis[0])) {
    for (const s2 of sideOptions(semis[1])) {
      const sf1Winner = getDisplayName(s1 === 'home' ? semis[0].homeTeam.name : semis[0].awayTeam.name);
      const sf1Loser  = getDisplayName(s1 === 'home' ? semis[0].awayTeam.name : semis[0].homeTeam.name);
      const sf2Winner = getDisplayName(s2 === 'home' ? semis[1].homeTeam.name : semis[1].awayTeam.name);
      const sf2Loser  = getDisplayName(s2 === 'home' ? semis[1].awayTeam.name : semis[1].homeTeam.name);

      // Home = semi 1's side, away = semi 2's side, by convention — only
      // matters internally for picking a winner, never shown to the user.
      const tpOptions = tpFixed ? [thirdPlace.score.winner === 'HOME_TEAM' ? 'home' : 'away'] : ['home', 'away'];
      const fOptions  = fFixed  ? [final.score.winner === 'HOME_TEAM' ? 'home' : 'away']       : ['home', 'away'];

      for (const tp of tpOptions) {
        for (const f of fOptions) {
          const thirdPlaceWinner = tp === 'home' ? sf1Loser  : sf2Loser;
          const champion         = f  === 'home' ? sf1Winner : sf2Winner;
          const runnerUp         = f  === 'home' ? sf2Winner : sf1Winner;

          const resolved = matches.map(m => {
            if (m.id === semis[0].id) {
              return { ...m, status: 'FINISHED', score: { ...m.score, winner: s1 === 'home' ? 'HOME_TEAM' : 'AWAY_TEAM' } };
            }
            if (m.id === semis[1].id) {
              return { ...m, status: 'FINISHED', score: { ...m.score, winner: s2 === 'home' ? 'HOME_TEAM' : 'AWAY_TEAM' } };
            }
            if (m.id === thirdPlace.id) {
              return {
                ...m, status: 'FINISHED',
                homeTeam: { ...m.homeTeam, name: sf1Loser },
                awayTeam: { ...m.awayTeam, name: sf2Loser },
                score: { ...m.score, winner: tp === 'home' ? 'HOME_TEAM' : 'AWAY_TEAM' },
              };
            }
            if (m.id === final.id) {
              return {
                ...m, status: 'FINISHED',
                homeTeam: { ...m.homeTeam, name: sf1Winner },
                awayTeam: { ...m.awayTeam, name: sf2Winner },
                score: { ...m.score, winner: f === 'home' ? 'HOME_TEAM' : 'AWAY_TEAM' },
              };
            }
            return m;
          });

          scenarios.push({ sf1Winner, sf2Winner, thirdPlaceWinner, champion, runnerUp, matches: resolved });
        }
      }
    }
  }

  return scenarios;
}

/**
 * Score and rank every participant under a resolved scenario.
 * Standard competition ranking — ties share a rank, the next rank skips
 * (1, 2, 2, 4 …) so a tie for 2nd means nobody is shown outright 3rd.
 */
function rankScenario(participants, resolvedMatches) {
  const scored = participants
    .map(p => ({
      name: p.name,
      total: p.teams.reduce((sum, t) => sum + teamStats(t, resolvedMatches).total, 0),
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  let rank = 0, lastTotal = null;
  for (let i = 0; i < scored.length; i++) {
    if (scored[i].total !== lastTotal) { rank = i + 1; lastTotal = scored[i].total; }
    scored[i].rank = rank;
  }
  return scored;
}

// ── RENDER ────────────────────────────────────────────────────────────────────

function renderScenarios() {
  const el = document.getElementById('data-scenarios');
  if (!el) return;

  const scenarios = _matches ? resolveBracket(_matches) : null;
  if (!scenarios) {
    el.innerHTML = `<p style="color:var(--muted);font-size:0.85rem">Scenarios will appear here once both semi-finals are set.</p>`;
    return;
  }

  // Filtering to exactly one participant (via the filter dropdown above)
  // spotlights them with their own rank/points column.
  const spotlight = _statsFilter && _statsFilter.size === 1 ? [..._statsFilter][0] : null;

  const nameChips = (names) => names.length
    ? names.map(n => `<span class="scenario-name${n === spotlight ? ' spotlight-name' : ''}">${esc(n)}</span>`).join('')
    : '<span style="color:var(--muted)">—</span>';

  const rows = scenarios.map(s => {
    const ranked = rankScenario(_participants, s.matches);
    const at     = r => ranked.filter(x => x.rank === r).map(x => x.name);

    let meCell = '';
    let rowCls = '';
    if (spotlight) {
      const me = ranked.find(x => x.name === spotlight);
      const cls = me && me.rank <= 3 ? ` r${me.rank}` : '';
      meCell = `<td><span class="rank-num${cls}">${me ? me.rank : '—'}</span>
        <span style="color:var(--muted);font-size:0.78rem">(${me ? me.total : '—'} pts)</span></td>`;
      rowCls = me && me.rank <= 3 ? ' class="scenario-row-hit"' : '';
    }

    return `<tr${rowCls}>
      <td>${esc(s.sf1Winner)}</td>
      <td>${esc(s.sf2Winner)}</td>
      <td>${esc(s.thirdPlaceWinner)}</td>
      <td style="font-weight:700">${esc(s.champion)}</td>
      <td>${nameChips(at(1))}</td>
      <td>${nameChips(at(2))}</td>
      <td>${nameChips(at(3))}</td>
      ${spotlight ? meCell : ''}
    </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="scrollable">
      <table>
        <thead>
          <tr>
            <th>Semi 1</th>
            <th>Semi 2</th>
            <th>3rd place</th>
            <th>Champion</th>
            <th>🥇 1st</th>
            <th>🥈 2nd</th>
            <th>🥉 3rd</th>
            ${spotlight ? `<th>${esc(spotlight)}</th>` : ''}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p style="font-size:0.72rem;color:var(--muted);margin-top:0.6rem">
      ${scenarios.length} possible outcomes from here${spotlight ? '' : ' — filter to one person above to see their rank in every scenario'}.
    </p>`;
}
