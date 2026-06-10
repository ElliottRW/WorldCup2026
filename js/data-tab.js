'use strict';

// ── DATA TAB ──────────────────────────────────────────────────────────────────

function renderDataTab() {
  const noData = !_participants?.length || !_matches?.length;

  renderOverviewStats(noData);
  if (noData) return;

  renderPointsGap();
  renderRemainingPotential();
  renderPtsPerCreditParticipants();
  renderBestValueTeams();
  renderMostPickedTeams();
  renderMatchDayHistory();
  renderRoundByRound();
}

// ── POINTS GAP ────────────────────────────────────────────────────────────────

function renderPointsGap() {
  const el = document.getElementById('data-gap');
  if (!el) return;

  const rows = _participants.map(p => {
    const { current, remaining, max } = participantMaxPossible(p, _matches);
    return { ...p, current, remaining, max };
  }).sort((a, b) => b.current - a.current);

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

  const rows = _participants.map(p => {
    const { current, remaining, max } = participantMaxPossible(p, _matches);
    return { ...p, current, remaining, max };
  }).sort((a, b) => b.max - a.max);

  if (!rows.length) {
    el.innerHTML = '<p style="color:var(--muted);font-size:0.85rem">No data yet.</p>';
    return;
  }

  const globalMax = rows[0].max || 1;
  const active    = activeTeams(_matches);

  el.innerHTML = rows.map(p => {
    const curPct  = Math.round((p.current   / globalMax) * 100);
    const remPct  = Math.round((p.remaining / globalMax) * 100);

    const teamChips = p.teams.map(t =>
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

  const rows = _participants
    .map(p => {
      const credits = creditsUsed(p);
      const total   = _matches ? teamStats(p.teams[0], _matches).total
                               + teamStats(p.teams[1], _matches).total
                               + teamStats(p.teams[2], _matches).total
                               + teamStats(p.teams[3], _matches).total : 0;
      return { ...p, credits, total, ppc: ptsPerCredit(total, credits) };
    })
    .sort((a, b) => b.ppc - a.ppc);

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
  const picks    = teamPickCounts(_participants);
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
      const ppc   = ptsPerCredit(pts, cost);
      const picks = teamPickCounts(_participants).get(team) ?? 0;
      const still = active.has(team);
      return { team, cost, pts, ppc, picks, still };
    })
    .sort((a, b) => b.ppc - a.ppc);

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

// ── MOST PICKED TEAMS ─────────────────────────────────────────────────────────

function renderMostPickedTeams() {
  const el = document.getElementById('data-popular');
  if (!el) return;

  const counts  = teamPickCounts(_participants);
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
    const pickers = _participants.filter(p => p.teams.includes(team)).map(p => nameWithTip(p)).join(', ');
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
    const scored     = scoreParticipantsInSet(_participants, dayMatches);
    const isOpen     = idx === 0; // most recent open by default

    const rows = scored.map((p, i) => {
      const rank  = i + 1;
      const medal = MEDALS[rank] ?? rank;
      const pills = p.teams
        .filter(t => p.breakdown[t] > 0)
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

  const sections = stages.map((stage, idx) => {
    const stageMatches = _matches.filter(m => m.stage === stage);
    const scored       = scoreParticipantsInSet(_participants, stageMatches);
    const isOpen       = idx === 0; // open most recent by default

    const rows = scored.map((p, i) => {
      const rank  = i + 1;
      const medal = MEDALS[rank] ?? rank;
      const pills = p.teams
        .filter(t => p.breakdown[t] > 0)
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
      <button class="match-section-toggle${isOpen ? ' open' : ''}" data-stage="${esc(stage)}">
        <span>${MATCH_STAGE_LABELS[stage] || stage}</span>
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
