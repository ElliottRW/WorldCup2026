'use strict';

// ── DATA TAB ──────────────────────────────────────────────────────────────────

// null = show everyone; Set of names = show only those
let _statsFilter    = null;
let _filterDropOpen = false; // persist dropdown open state across re-renders

// Returns the participant list filtered by _statsFilter
function viewParticipants() {
  if (!_statsFilter) return _participants;
  return (_participants || []).filter(p => _statsFilter.has(p.name));
}

function renderDataTab() {
  const noData = !_participants?.length || !_matches?.length;

  renderOverviewStats(noData);
  if (noData) return;

  renderParticipantFilter();
  renderPointsGap();
  renderRemainingPotential();
  renderPtsPerCreditParticipants();
  renderBestValueTeams();
  renderHindsightBest();
  renderCivilWar();
  renderEliminated();
  renderMostPickedTeams();
  renderMatchDayHistory();
  renderRoundByRound();
}

// ── PARTICIPANT FILTER ────────────────────────────────────────────────────────

function renderParticipantFilter() {
  const el = document.getElementById('data-filter');
  if (!el) return;

  const all     = _participants || [];
  const active  = _statsFilter ?? new Set(all.map(p => p.name));
  const allSel  = active.size === all.length;
  const label   = allSel ? `All ${all.length} participants` : `${active.size} of ${all.length} selected`;

  const checkboxes = all
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(p => {
      const checked = active.has(p.name) ? 'checked' : '';
      return `<label class="filter-option">
        <input type="checkbox" data-name="${esc(p.name)}" ${checked}>
        ${esc(p.name)}
      </label>`;
    }).join('');

  const dropDisplay = _filterDropOpen ? 'block' : 'none';
  const chevron     = _filterDropOpen ? '▴' : '▾';

  el.innerHTML = `
    <div class="filter-bar">
      <button class="filter-toggle" id="filter-toggle-btn">
        <span>👥 ${esc(label)}</span>
        <span class="chevron">${chevron}</span>
      </button>
      <div class="filter-dropdown" id="filter-dropdown" style="display:${dropDisplay}">
        <div class="filter-actions">
          <button class="filter-action-btn" id="filter-select-all">Select all</button>
          <button class="filter-action-btn" id="filter-clear-all">Clear all</button>
        </div>
        <div class="filter-options">${checkboxes}</div>
      </div>
    </div>`;

  const toggle   = el.querySelector('#filter-toggle-btn');
  const dropdown = el.querySelector('#filter-dropdown');

  toggle.addEventListener('click', () => {
    _filterDropOpen = dropdown.style.display === 'none';
    dropdown.style.display = _filterDropOpen ? 'block' : 'none';
    toggle.querySelector('.chevron').textContent = _filterDropOpen ? '▴' : '▾';
  });

  el.querySelector('#filter-select-all').addEventListener('click', () => {
    _statsFilter    = null;
    _filterDropOpen = false;
    renderDataTab();
  });

  el.querySelector('#filter-clear-all').addEventListener('click', () => {
    _statsFilter    = new Set();
    _filterDropOpen = false;
    renderDataTab();
  });

  el.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      if (!_statsFilter) _statsFilter = new Set(all.map(p => p.name));
      if (cb.checked) _statsFilter.add(cb.dataset.name);
      else            _statsFilter.delete(cb.dataset.name);
      if (_statsFilter.size === all.length) _statsFilter = null;
      renderDataTab(); // dropdown stays open because _filterDropOpen is still true
    });
  });
}

// ── POINTS GAP ────────────────────────────────────────────────────────────────

function renderPointsGap() {
  const el = document.getElementById('data-gap');
  if (!el) return;

  const rows = viewParticipants().map(p => {
    const { current, remaining, max } = participantMaxPossible(p, _matches);
    return { ...p, current, remaining, max };
  }).sort((a, b) => b.current - a.current || a.name.localeCompare(b.name));

  if (!rows.length) {
    el.innerHTML = '<p style="color:var(--muted);font-size:0.85rem">No data yet.</p>';
    return;
  }

  const leader   = rows[0];
  const MEDALS   = { 1: '🥇', 2: '🥈', 3: '🥉' };

  el.innerHTML = rows.map((p, i) => {
    const rank     = i + 1;
    const medal    = MEDALS[rank] ?? `${rank}`;
    const barPct   = leader.current > 0 ? Math.round((p.current / leader.current) * 100) : 100;
    const gap      = leader.current - p.current;

    let badgeHtml;
    if (rank === 1) {
      badgeHtml = `<span class="gap-leader-badge">🏆 Leader</span>`;
    } else if (p.max > leader.current) {
      badgeHtml = `<span class="still-active">↑ Can catch up</span>`;
    } else {
      badgeHtml = `<span class="eliminated">Max ${p.max} pts</span>`;
    }

    return `<div class="gap-row${rank === 1 ? ' gap-top-row' : ''}">
      <span class="gap-rank">${medal}</span>
      <div class="gap-body">
        <div class="gap-top-line">
          <span class="gap-name">${nameWithTip(p)}</span>
          <span class="gap-score">${p.current} pts</span>
          ${rank > 1 ? `<span class="gap-diff">−${gap}</span>` : ''}
          ${badgeHtml}
        </div>
        <div class="gap-bar-wrap">
          <div class="gap-bar${rank === 1 ? ' gap-bar-leader' : ''}" style="width:${barPct}%"></div>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── REMAINING POTENTIAL ───────────────────────────────────────────────────────

function renderRemainingPotential() {
  const el = document.getElementById('data-potential');
  if (!el) return;

  const rows = viewParticipants().map(p => {
    const { current, remaining, max } = participantMaxPossible(p, _matches);
    return { ...p, current, remaining, max };
  }).sort((a, b) => b.max - a.max || b.current - a.current || a.name.localeCompare(b.name));

  if (!rows.length) {
    el.innerHTML = '<p style="color:var(--muted);font-size:0.85rem">No data yet.</p>';
    return;
  }

  const globalMax = rows[0].max || 1;
  const active    = activeTeams(_matches);

  el.innerHTML = rows.map(p => {
    const curPct  = ((p.current   / globalMax) * 100).toFixed(2);
    const remPct  = ((p.remaining / globalMax) * 100).toFixed(2);

    const teamChips = [...p.teams].sort((a, b) => a.localeCompare(b)).map(t =>
      active.has(t)
        ? `<span class="still-active">${esc(t)}</span>`
        : `<span class="eliminated">${esc(t)}</span>`
    ).join('');

    return `<div class="potential-row">
      <div class="potential-header">
        <span class="potential-name">${nameWithTip(p)}</span>
        <span class="potential-nums">
          <span class="potential-now">${p.current}</span>
          <span class="potential-sep">＋</span>
          <span class="potential-add">${p.remaining} more</span>
          <span class="potential-sep">=</span>
          <span class="potential-max-num">${p.max} max</span>
        </span>
      </div>
      <div class="potential-track">
        <div class="potential-bar-cur"  style="width:${curPct}%"></div>
        <div class="potential-bar-rem"  style="width:${remPct}%"></div>
      </div>
      <div class="potential-teams">${teamChips}</div>
    </div>`;
  }).join('');
}

// ── OVERVIEW STAT CARDS ───────────────────────────────────────────────────────

function renderOverviewStats(noData) {
  const el = document.getElementById('data-overview');
  if (!_matches?.length) {
    el.innerHTML = '';
    return;
  }

  const played   = _matches.filter(m => m.status === 'FINISHED').length;
  const total    = _matches.length;
  const goals    = totalGoals(_matches);
  const active   = activeTeams(_matches).size;
  const days     = daysToFinal(_matches);
  const daysStr  = days === null ? '–' : days <= 0 ? 'Today!' : `${days}d`;

  el.innerHTML = `
    <div class="stat-card"><div class="val">${played}<span style="font-size:1rem;font-weight:400;color:var(--muted)">/${total}</span></div><div class="lbl">Matches Played</div></div>
    <div class="stat-card"><div class="val">${goals}</div><div class="lbl">Goals Scored</div></div>
    <div class="stat-card"><div class="val">${active}</div><div class="lbl">Teams Active</div></div>
    <div class="stat-card"><div class="val">${daysStr}</div><div class="lbl">Days to Final</div></div>
  `;
}

// ── POINTS PER CREDIT — PARTICIPANTS ─────────────────────────────────────────

function renderPtsPerCreditParticipants() {
  const el = document.getElementById('data-ppc-participants');
  if (!el) return;

  const rows = viewParticipants()
    .map(p => {
      const credits = creditsUsed(p);
      const total   = _matches ? teamStats(p.teams[0], _matches).total
                               + teamStats(p.teams[1], _matches).total
                               + teamStats(p.teams[2], _matches).total
                               + teamStats(p.teams[3], _matches).total : 0;
      const ppcRaw = credits ? total / credits : 0;
      return { ...p, credits, total, ppc: ptsPerCredit(total, credits), ppcRaw };
    })
    .sort((a, b) => b.ppcRaw - a.ppcRaw || b.total - a.total || a.name.localeCompare(b.name));

  const maxPpc = rows[0]?.ppc || 1;
  const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };

  const tableRows = rows.map((p, i) => {
    const rank  = i + 1;
    const medal = MEDALS[rank] ?? rank;
    const bar   = Math.round((p.ppc / maxPpc) * 100);
    return `<tr>
      <td><span class="rank-num${rank <= 3 ? ` r${rank}` : ''}">${medal}</span></td>
      <td style="font-weight:700;white-space:nowrap">${nameWithTip(p)}</td>
      <td style="text-align:center;color:var(--muted)">${p.credits}</td>
      <td style="text-align:center">${p.total}</td>
      <td>
        <div class="ppc-cell">
          <div class="ppc-bar-wrap"><div class="ppc-bar" style="width:${bar}%"></div></div>
          <span class="ppc-val">${p.ppc.toFixed(2)}</span>
        </div>
      </td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <table>
      <thead><tr>
        <th>Rank</th><th>Name</th><th title="Credits spent">Credits</th>
        <th>Total Pts</th><th>Pts / Credit</th>
      </tr></thead>
      <tbody>${tableRows}</tbody>
    </table>`;
}

// ── BEST VALUE TEAM PICKS ─────────────────────────────────────────────────────

function renderBestValueTeams() {
  const el = document.getElementById('data-best-value');
  if (!el) return;

  // Only teams that appear in at least one entry
  const picks    = teamPickCounts(viewParticipants());
  const pickedTeams = [...picks.keys()];

  if (!pickedTeams.length) {
    el.innerHTML = '<div class="empty-state"><span class="icon">📊</span>No picks yet.</div>';
    return;
  }

  const active = activeTeams(_matches);

  const rows = pickedTeams
    .map(team => {
      const cost  = TEAM_DATA[team]?.cost ?? 0;
      const pts   = _matches ? teamStats(team, _matches).total : 0;
      const ppc    = ptsPerCredit(pts, cost);
      const ppcRaw = cost ? pts / cost : 0;
      const picks  = teamPickCounts(viewParticipants()).get(team) ?? 0;
      const still  = active.has(team);
      return { team, cost, pts, ppc, ppcRaw, picks, still };
    })
    .sort((a, b) => b.ppcRaw - a.ppcRaw || b.pts - a.pts || a.team.localeCompare(b.team));

  const maxPpc = rows[0]?.ppc || 1;

  const tableRows = rows.map((r, i) => {
    const bar    = Math.round((r.ppc / maxPpc) * 100);
    const active = r.still ? '<span class="still-active">✓ Active</span>' : '<span class="eliminated">✗ Out</span>';
    return `<tr>
      <td style="font-weight:600;white-space:nowrap">${esc(r.team)}</td>
      <td style="text-align:center"><span class="cost-chip">${r.cost}</span></td>
      <td style="text-align:center">${r.pts}</td>
      <td>
        <div class="ppc-cell">
          <div class="ppc-bar-wrap"><div class="ppc-bar" style="width:${bar}%"></div></div>
          <span class="ppc-val">${r.ppc.toFixed(2)}</span>
        </div>
      </td>
      <td style="text-align:center">${r.picks}×</td>
      <td>${active}</td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <table>
      <thead><tr>
        <th>Team</th><th>Cost</th><th>Points</th><th>Pts / Credit</th>
        <th title="Times picked">Picks</th><th>Status</th>
      </tr></thead>
      <tbody>${tableRows}</tbody>
    </table>`;
}

// ── HINDSIGHT BEST ENTRY ──────────────────────────────────────────────────────

function renderHindsightBest() {
  const el = document.getElementById('data-hindsight');
  if (!el) return;

  const { entries, score } = bestHindsightEntry(_matches);

  if (!entries.length) {
    el.innerHTML = '<p style="color:var(--muted);font-size:0.85rem">No data yet.</p>';
    return;
  }

  const active      = activeTeams(_matches);
  const leaderScore = (_participants || [])
    .map(p => p.teams.reduce((s, t) => s + teamStats(t, _matches).total, 0))
    .reduce((max, s) => Math.max(max, s), 0);

  const diff     = score - leaderScore;
  const vsLeader = leaderScore > 0
    ? `vs actual leader's <strong>${leaderScore} pts</strong> — ${diff > 0 ? `<span style="color:var(--green)">+${diff} ahead</span>` : diff === 0 ? 'exactly matched' : `<span style="color:var(--muted)">${diff} behind</span>`}`
    : '';

  // Sort all entries cheapest first
  const sorted = entries.slice().sort((a, b) => a.cost - b.cost);

  const buildTeamRows = ({ teams, cost }) => teams
    .slice()
    .sort((a, b) => teamStats(b, _matches).total - teamStats(a, _matches).total)
    .map(t => {
      const pts  = teamStats(t, _matches).total;
      const pill = active.has(t)
        ? `<span class="still-active">Active</span>`
        : `<span class="eliminated">Out</span>`;
      return `<div class="hindsight-row">
        <span class="hindsight-team">${esc(t)}</span>
        <span class="cost-chip">${TEAM_DATA[t].cost}</span>
        <span class="hindsight-pts">${pts} pts</span>
        ${pill}
      </div>`;
    }).join('') + `<div class="hindsight-footer">
      <span>Budget: <strong>${cost} / 100 credits</strong></span>
      <span class="hindsight-total">${score} pts</span>
    </div>`;

  const buildOption = (entry, idx) =>
    `<div class="hindsight-option">
      ${idx > 0 ? '<hr class="hindsight-divider">' : ''}
      ${sorted.length > 1 ? `<div class="hindsight-option-label">Option ${idx + 1} · ${entry.cost} credits</div>` : ''}
      <div class="hindsight-teams">${buildTeamRows(entry)}</div>
    </div>`;

  let html;
  if (sorted.length === 1) {
    html = buildOption(sorted[0], 0);
  } else {
    // Show cheapest option always; rest hidden in a dropdown
    const rest = sorted.slice(1).map((entry, i) => buildOption(entry, i + 1)).join('');
    html = `
      ${buildOption(sorted[0], 0)}
      <button class="hindsight-toggle" id="hindsight-toggle">
        <span>Show ${sorted.length - 1} more tied option${sorted.length - 1 > 1 ? 's' : ''}</span>
        <span class="chevron">▾</span>
      </button>
      <div class="hindsight-dropdown" id="hindsight-dropdown">${rest}</div>`;
  }

  el.innerHTML = `${html}${vsLeader ? `<p class="rules-note" style="margin-top:0.75rem">${vsLeader}</p>` : ''}`;

  const toggle = el.querySelector('#hindsight-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const drop     = el.querySelector('#hindsight-dropdown');
      const isOpen   = drop.classList.toggle('open');
      toggle.querySelector('.chevron').textContent = isOpen ? '▴' : '▾';
    });
  }
}

// ── MOST PICKED TEAMS ─────────────────────────────────────────────────────────

function renderMostPickedTeams() {
  const el = document.getElementById('data-popular');
  if (!el) return;

  const counts  = teamPickCounts(viewParticipants());
  const active  = activeTeams(_matches);
  // Only show teams picked by 2+ people — otherwise the section is trivial
  const shared  = [...counts.entries()].filter(([, n]) => n > 1);

  if (!shared.length) {
    el.innerHTML = `<p style="color:var(--muted);font-size:0.85rem;padding:0.5rem 0">No teams are shared between participants yet.</p>`;
    return;
  }

  const cards = shared.map(([team, count]) => {
    const pts    = _matches ? teamStats(team, _matches).total : 0;
    const still  = active.has(team);
    const pickers = viewParticipants().filter(p => p.teams.includes(team)).map(p => nameWithTip(p)).join(', ');
    return `<div class="shared-team-card">
      <div class="shared-team-name">${esc(team)}</div>
      <div class="shared-team-meta">Picked by <strong>${pickers}</strong></div>
      <div class="shared-team-stats">
        <span class="pts-pill">${pts} pts</span>
        ${still ? '<span class="still-active">✓ Still active</span>' : '<span class="eliminated">✗ Eliminated</span>'}
      </div>
    </div>`;
  }).join('');

  el.innerHTML = cards;
}

// ── MATCH DAY HISTORY ─────────────────────────────────────────────────────────

function renderMatchDayHistory() {
  const el = document.getElementById('data-matchday');
  if (!el) return;

  const days = allMatchDays(_matches);
  if (!days.length) {
    el.innerHTML = `<p style="color:var(--muted);font-size:0.85rem">No matches played yet.</p>`;
    return;
  }

  const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };

  const sections = days.map(({ dateKey, label }, idx) => {
    const dayMatches = matchesOnDate(_matches, dateKey);
    const scored     = scoreParticipantsInSet(viewParticipants(), dayMatches);
    const isOpen     = idx === 0; // most recent open by default

    const scorers = scored.filter(p => p.total > 0);
    const rows = scorers.map((p, i) => {
      const rank  = i + 1;
      const medal = MEDALS[rank] ?? rank;
      const pills = p.teams
        .filter(t => p.breakdown[t] > 0)
        .sort((a, b) => a.localeCompare(b))
        .map(t => `<span class="team-pill">${esc(t)}<span class="pts-chip">+${p.breakdown[t]}</span></span>`)
        .join('');
      return `<tr>
        <td><span class="rank-num${rank <= 3 ? ` r${rank}` : ''}">${medal}</span></td>
        <td style="font-weight:700;white-space:nowrap">${nameWithTip(p)}</td>
        <td>${pills}</td>
        <td class="total-score">${p.total}</td>
      </tr>`;
    }).join('');

    return `<div class="match-section">
      <button class="match-section-toggle${isOpen ? ' open' : ''}">
        <span>${esc(label)}</span>
        <span class="chevron">▾</span>
      </button>
      <div class="match-section-body${isOpen ? ' open' : ''}">
        <table style="margin-top:0.25rem">
          <thead><tr><th>Rank</th><th>Name</th><th>Scoring Teams</th><th style="text-align:right">Pts</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
  }).join('');

  el.innerHTML = sections;

  el.querySelectorAll('.match-section-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const open = btn.classList.toggle('open');
      btn.nextElementSibling.classList.toggle('open', open);
    });
  });
}

// ── ROUND BY ROUND ────────────────────────────────────────────────────────────

function renderRoundByRound() {
  const el = document.getElementById('data-rounds');
  if (!el) return;

  const stages = completedStages(_matches);
  if (!stages.length) {
    el.innerHTML = `<p style="color:var(--muted);font-size:0.85rem">No rounds completed yet.</p>`;
    return;
  }

  const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };

  // Expand GROUP_STAGE into per-matchday entries; keep knockout stages as-is.
  // Each entry: { label, matches }
  const roundEntries = [];
  for (const stage of stages) {
    if (stage === 'GROUP_STAGE') {
      const finishedDays = [...new Set(
        _matches
          .filter(m => m.stage === 'GROUP_STAGE' && m.status === 'FINISHED' && m.matchday)
          .map(m => m.matchday)
      )].sort((a, b) => b - a); // most recent first
      for (const day of finishedDays) {
        roundEntries.push({
          label: `Group Stage — Matchday ${day}`,
          matches: _matches.filter(m => m.stage === 'GROUP_STAGE' && m.matchday === day),
        });
      }
    } else {
      roundEntries.push({
        label: MATCH_STAGE_LABELS[stage] || stage,
        matches: _matches.filter(m => m.stage === stage),
      });
    }
  }

  const sections = roundEntries.map(({ label, matches }, idx) => {
    const scored = scoreParticipantsInSet(viewParticipants(), matches);
    const isOpen = idx === 0;

    const rows = scored.map((p, i) => {
      const rank  = i + 1;
      const medal = MEDALS[rank] ?? rank;
      const pills = p.teams
        .filter(t => p.breakdown[t] > 0)
        .sort((a, b) => a.localeCompare(b))
        .map(t => `<span class="team-pill">${esc(t)}<span class="pts-chip">+${p.breakdown[t]}</span></span>`)
        .join('');
      return `<tr>
        <td><span class="rank-num${rank <= 3 ? ` r${rank}` : ''}">${medal}</span></td>
        <td style="font-weight:700;white-space:nowrap">${nameWithTip(p)}</td>
        <td>${pills || '<span style="color:var(--muted);font-size:0.8rem">No points</span>'}</td>
        <td class="total-score">${p.total}</td>
      </tr>`;
    }).join('');

    return `<div class="match-section">
      <button class="match-section-toggle${isOpen ? ' open' : ''}">
        <span>${esc(label)}</span>
        <span class="chevron">▾</span>
      </button>
      <div class="match-section-body${isOpen ? ' open' : ''}">
        <table style="margin-top:0.25rem">
          <thead><tr><th>Rank</th><th>Name</th><th>Scoring Teams</th><th style="text-align:right">Pts</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
  }).join('');

  el.innerHTML = sections;

  // Wire accordions
  el.querySelectorAll('.match-section-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const open = btn.classList.toggle('open');
      btn.nextElementSibling.classList.toggle('open', open);
    });
  });
}

// ── CIVIL WAR ─────────────────────────────────────────────────────────────────

function renderCivilWar() {
  const el = document.getElementById('data-civil-war');
  if (!el) return;

  const ps = viewParticipants();

  // Collect all civil war fixtures grouped by stage
  const byStage = {}; // stage key → [{p, home, away, result, utcDate, status}]
  for (const m of _matches) {
    const home = getDisplayName(m.homeTeam?.name);
    const away = getDisplayName(m.awayTeam?.name);
    if (!home || !away) continue;
    for (const p of ps) {
      if (!p.teams.includes(home) || !p.teams.includes(away)) continue;
      const date = new Date(m.utcDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      let result = '';
      if (m.status === 'FINISHED' && m.score?.winner) {
        const hg = m.score.fullTime?.home ?? '?';
        const ag = m.score.fullTime?.away ?? '?';
        const winner = m.score.winner === 'HOME_TEAM' ? home
                     : m.score.winner === 'AWAY_TEAM' ? away : null;
        const note = m.score.duration === 'PENALTY_SHOOTOUT'
          ? (m.score.penalties?.home != null ? ` (${m.score.penalties.home}–${m.score.penalties.away} pens)` : ' (pens)')
          : m.score.duration === 'EXTRA_TIME' ? ' (aet)' : '';
        result = winner
          ? `${hg}–${ag}${note} · <strong>${esc(winner)}</strong> won`
          : `${hg}–${ag} · Draw`;
      } else if (m.status === 'IN_PLAY' || m.status === 'PAUSED') {
        result = '🔴 LIVE';
      } else {
        result = `upcoming · ${date}`;
      }
      (byStage[m.stage] = byStage[m.stage] || []).push({ p, home, away, result, utcDate: m.utcDate, status: m.status });
    }
  }

  // Stage render order: most prestigious first (same as matches tab)
  const stageOrder = ['FINAL','THIRD_PLACE','SEMI_FINALS','QUARTER_FINALS','LAST_16','LAST_32','GROUP_STAGE'];
  const presentStages = stageOrder.filter(s => byStage[s]);

  if (!presentStages.length) {
    el.innerHTML = `<p style="color:var(--muted);font-size:0.85rem">No civil war fixtures — nobody holds both sides of the same match.</p>`;
    return;
  }

  // Determine the "active" stage: prefer live/upcoming over finished
  const isActive = s => byStage[s]?.some(r => r.status !== 'FINISHED');
  const activeStage = presentStages.find(isActive) || presentStages[0];

  const sections = presentStages.map(stage => {
    const rows = byStage[stage].slice().sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
    const isOpen = stage === activeStage;
    const label = MATCH_STAGE_LABELS[stage] || stage;
    const count = rows.length;

    const rowsHtml = rows.map(r => `
      <div class="civil-war-row">
        <div class="civil-war-participant">${nameWithTip(r.p)}</div>
        <div class="civil-war-fixture">
          <span class="civil-war-teams">${esc(r.home)} <span class="vs">vs</span> ${esc(r.away)}</span>
          <span class="civil-war-stage">${r.result}</span>
        </div>
      </div>`).join('');

    return `<div class="match-section">
      <button class="match-section-toggle${isOpen ? ' open' : ''}">
        <span>${esc(label)} <span style="font-weight:400;color:var(--muted)">(${count})</span></span>
        <span class="chevron">▾</span>
      </button>
      <div class="match-section-body${isOpen ? ' open' : ''}">${rowsHtml}</div>
    </div>`;
  }).join('');

  el.innerHTML = sections;

  el.querySelectorAll('.match-section-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const open = btn.classList.toggle('open');
      btn.nextElementSibling.classList.toggle('open', open);
    });
  });
}

// ── ELIMINATED ────────────────────────────────────────────────────────────────

function renderEliminated() {
  const el = document.getElementById('data-eliminated');
  if (!el) return;

  function teamEliminatedInfo(team) {
    const mine = _matches.filter(m =>
      getDisplayName(m.homeTeam?.name) === team ||
      getDisplayName(m.awayTeam?.name) === team
    );

    // Upcoming knockout fixture → still alive
    if (mine.some(m => m.stage !== 'GROUP_STAGE' && ['TIMED', 'SCHEDULED'].includes(m.status)))
      return null;

    // Check finished knockout matches — most recent first
    const finishedKO = mine
      .filter(m => m.stage !== 'GROUP_STAGE' && m.status === 'FINISHED')
      .sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate));

    if (finishedKO.length) {
      const last = finishedKO[0];
      const w = last.score?.winner;
      if (w && w !== 'DRAW') {
        const isHome = getDisplayName(last.homeTeam?.name) === team;
        const won = (w === 'HOME_TEAM') === isHome;
        if (!won) return { date: last.utcDate, round: MATCH_STAGE_LABELS[last.stage] || last.stage };
        return null; // won last KO match — still in
      }
    }

    // Never reached a knockout — out at group stage
    const groupDone = mine.filter(m => m.stage === 'GROUP_STAGE' && m.status === 'FINISHED');
    if (groupDone.length >= 3) {
      const lastGroup = groupDone.sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate))[0];
      return { date: lastGroup.utcDate, round: 'Group Stage' };
    }

    return null;
  }

  const ps = viewParticipants();
  const entries = ps.map(p => {
    const teamInfos = p.teams.map(t => ({ team: t, info: teamEliminatedInfo(t) }));
    const allOut = teamInfos.every(td => td.info !== null);
    const lastOut = allOut
      ? teamInfos.reduce((l, td) => new Date(td.info.date) > new Date(l.info.date) ? td : l)
      : null;
    return { p, teamInfos, allOut, lastOut };
  });

  const teamsAlive  = e => e.teamInfos.filter(td => !td.info).length;
  const currScore   = e => e.p.teams.reduce((s, t) => s + teamStats(t, _matches).total, 0);

  // Sort: most teams still in first; ties broken by current score; fully out last (by date of last elimination)
  entries.sort((a, b) => {
    const aAlive = teamsAlive(a), bAlive = teamsAlive(b);
    if (aAlive !== bAlive) return bAlive - aAlive;
    if (aAlive === 0) return new Date(a.lastOut.info.date) - new Date(b.lastOut.info.date);
    return currScore(b) - currScore(a);
  });

  const fmt = iso => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  const renderRow = (e, idx) => {
    const pills = e.teamInfos.map(td =>
      `<span class="elim-team-pill ${td.info ? 'out' : 'alive'}">${esc(td.team)}</span>`
    ).join('');

    const n = teamsAlive(e);
    const status = n > 0
      ? `<span class="elim-alive">${n} team${n > 1 ? 's' : ''} still in</span>`
      : `<span class="elim-out">Out — last team (${esc(e.lastOut.team)}) knocked out in <strong>${esc(e.lastOut.info.round)}</strong> on ${fmt(e.lastOut.info.date)}</span>`;

    return `<div class="elim-row">
      <span class="elim-rank">${idx + 1}</span>
      <div class="elim-body">
        <div class="elim-name">${nameWithTip(e.p)}</div>
        <div class="elim-teams">${pills}</div>
        <div class="elim-status">${status}</div>
      </div>
    </div>`;
  };

  el.innerHTML = entries.length
    ? entries.map((e, i) => renderRow(e, i)).join('')
    : `<p style="color:var(--muted);font-size:0.85rem">No eliminations yet.</p>`;
}
