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

// Full ranked standings per rendered scenario, indexed to match the table rows.
// Populated by renderScenarios(), read by the hover popover for the rest of the field.
let _scenarioRankings = [];

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

  // A match counts as decided only when finished with a real winner. A lingering
  // DRAW on a knockout fixture means the result isn't resolved yet (ET/pens still
  // to come), so treat that as still live.
  const decided = m => m.status === 'FINISHED' && m.score?.winner && m.score.winner !== 'DRAW';

  // The actual winning team NAME of a decided fixture (null if not played yet).
  // Matching on name — rather than a home/away flag — keeps results correct even
  // though the 3rd-place play-off and Final don't have their teams filled in
  // until the semis are played, so their slots can't be assumed to line up with
  // our sf1/sf2 convention.
  const nameOf     = raw => raw ? getDisplayName(raw) : null;
  const winnerName = m => decided(m)
    ? nameOf(m.score.winner === 'HOME_TEAM' ? m.homeTeam?.name : m.awayTeam?.name)
    : null;
  const sf1Actual = winnerName(semis[0]);
  const sf2Actual = winnerName(semis[1]);
  const tpActual  = winnerName(thirdPlace);
  const fActual   = winnerName(final);

  // The real fixture line-ups, straight from the API. ESPN leaves the Final and
  // 3rd-place team slots empty until the semis are played, then fills in the two
  // actual finalists / 3rd-place teams. While they're empty we derive the pairing
  // from the semis; the moment the API provides them we treat them as the source
  // of truth and cancel any scenario whose pairing disagrees — no guessing.
  const finalPair = (final.homeTeam?.name && final.awayTeam?.name)
    ? [nameOf(final.homeTeam.name), nameOf(final.awayTeam.name)]
    : null;
  const thirdPair = (thirdPlace.homeTeam?.name && thirdPlace.awayTeam?.name)
    ? [nameOf(thirdPlace.homeTeam.name), nameOf(thirdPlace.awayTeam.name)]
    : null;
  const samePair = (a, b) => (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0]);

  // Always enumerate all 16 combinations. Rather than prune the ones a result
  // has ruled out, we keep them and flag each with `alive`: true while still
  // possible, false once contradicted by a played match. The renderer shows the
  // dead ones struck through so you can see what's been cancelled.
  const scenarios = [];

  for (const s1 of ['home', 'away']) {
    for (const s2 of ['home', 'away']) {
      const sf1Winner = getDisplayName(s1 === 'home' ? semis[0].homeTeam.name : semis[0].awayTeam.name);
      const sf1Loser  = getDisplayName(s1 === 'home' ? semis[0].awayTeam.name : semis[0].homeTeam.name);
      const sf2Winner = getDisplayName(s2 === 'home' ? semis[1].homeTeam.name : semis[1].awayTeam.name);
      const sf2Loser  = getDisplayName(s2 === 'home' ? semis[1].awayTeam.name : semis[1].homeTeam.name);

      for (const tp of ['home', 'away']) {
        for (const f of ['home', 'away']) {
          const thirdPlaceWinner = tp === 'home' ? sf1Loser  : sf2Loser;
          const champion         = f  === 'home' ? sf1Winner : sf2Winner;
          const runnerUp         = f  === 'home' ? sf2Winner : sf1Winner;

          // Still possible only if it agrees with every result already in AND
          // with the real Final / 3rd-place line-ups once the API has seeded them.
          const alive =
            (sf1Actual === null || sf1Winner        === sf1Actual) &&
            (sf2Actual === null || sf2Winner        === sf2Actual) &&
            (tpActual  === null || thirdPlaceWinner === tpActual)  &&
            (fActual   === null || champion         === fActual)   &&
            (finalPair === null || samePair([sf1Winner, sf2Winner], finalPair)) &&
            (thirdPair === null || samePair([sf1Loser,  sf2Loser],  thirdPair));

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

          scenarios.push({ sf1Winner, sf2Winner, thirdPlaceWinner, champion, runnerUp, alive, matches: resolved });
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

  // Rank everyone once per scenario and stash it so the hover popover can show
  // the rest of the field (4th onwards) without recomputing.
  _scenarioRankings = scenarios.map(s => rankScenario(_participants, s.matches));

  // Podium cell: each name with the points they'd finish on.
  const nameChips = (entries) => entries.length
    ? entries.map(e => `<span class="scenario-name">${esc(e.name)} <span class="scenario-pts">${e.total}</span></span>`).join('')
    : '<span style="color:var(--muted)">—</span>';

  const rows = scenarios.map((s, i) => {
    const ranked = _scenarioRankings[i];
    const at     = r => ranked.filter(x => x.rank === r).map(x => ({ name: x.name, total: x.total }));

    return `<tr class="${s.alive ? 'scenario-live' : 'scenario-dead'}">
      <td>${esc(s.sf1Winner)}</td>
      <td>${esc(s.sf2Winner)}</td>
      <td>${esc(s.thirdPlaceWinner)}</td>
      <td style="font-weight:700">${esc(s.champion)}</td>
      <td>${nameChips(at(1))}</td>
      <td>${nameChips(at(2))}</td>
      <td>${nameChips(at(3))}</td>
      <td><button class="scenario-more" data-idx="${i}" aria-label="Show the rest of the field">⋯</button></td>
    </tr>`;
  }).join('');

  const aliveCount = scenarios.filter(s => s.alive).length;

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
            <th title="Hover for the rest of the field">⋯</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p style="font-size:0.72rem;color:var(--muted);margin-top:0.6rem">
      ${aliveCount} of ${scenarios.length} outcomes still possible — cancelled scenarios are struck through.
      Hover <span class="scenario-more-inline">⋯</span> to see where everyone else lands.
    </p>`;

  wireScenarioPopover(el);
}

// Shared body-level popover listing the rest of the field (4th onwards) for a
// scenario. Kept out of the scrollable table so overflow can't clip it.
function wireScenarioPopover(container) {
  let pop = document.getElementById('scenario-popover');
  if (!pop) {
    pop = document.createElement('div');
    pop.id = 'scenario-popover';
    pop.className = 'scenario-popover';
    document.body.appendChild(pop);
  }

  // A short hide delay lets the cursor travel from the button into the popover
  // (which cancels the hide) without it vanishing on the way.
  let hideTimer = null;
  const cancelHide   = () => { if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; } };
  const hide         = () => { cancelHide(); pop.style.display = 'none'; pop.dataset.idx = ''; };
  const scheduleHide = () => { cancelHide(); hideTimer = setTimeout(hide, 200); };

  const showFor = (btn) => {
    cancelHide();
    const ranked = _scenarioRankings[+btn.dataset.idx] || [];
    const rest   = ranked.filter(x => x.rank >= 4);
    if (!rest.length) { hide(); return; }
    pop.innerHTML =
      `<div class="scenario-popover-title">The rest of the field</div>` +
      rest.map(x => `<div class="scenario-popover-row">
        <span class="sp-rank">${x.rank}</span>
        <span class="sp-name">${esc(x.name)}</span>
        <span class="sp-pts">${x.total}</span>
      </div>`).join('');
    pop.dataset.idx = btn.dataset.idx;
    pop.style.display = 'block';

    // Measure, then place next to the button. Prefer below; flip above when the
    // button sits low enough that the popover would run off the bottom — this
    // keeps it anchored to the button instead of jumping to the screen edge.
    const r = btn.getBoundingClientRect();
    const h = pop.offsetHeight, w = pop.offsetWidth;
    let top = r.bottom + 6;
    if (top + h > window.innerHeight - 8) {
      const above = r.top - h - 6;
      top = above >= 8 ? above : Math.max(8, window.innerHeight - h - 8);
    }
    const left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8));
    pop.style.top  = top + 'px';
    pop.style.left = left + 'px';
  };

  // Keep it open while the cursor is over the popover (e.g. to scroll it).
  pop.onmouseenter = cancelHide;
  pop.onmouseleave = scheduleHide;

  container.querySelectorAll('.scenario-more').forEach(btn => {
    btn.addEventListener('mouseenter', () => showFor(btn));
    btn.addEventListener('mouseleave', scheduleHide);
    // Tap support on touch devices where hover isn't available.
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (pop.style.display === 'block' && pop.dataset.idx === btn.dataset.idx) hide();
      else showFor(btn);
    });
  });

  // Register the outside-click dismiss once, not on every re-render.
  if (!pop.dataset.wired) {
    document.addEventListener('click', (e) => {
      if (e.target.closest('#scenario-popover') || e.target.closest('.scenario-more')) return;
      hide();
    });
    pop.dataset.wired = '1';
  }
}
