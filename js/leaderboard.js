'use strict';

// ── BANNERS ───────────────────────────────────────────────────────────────────

function renderBanners() {
  document.getElementById('banners').innerHTML = _participants === null
    ? `<div class="banner banner-warn">⚠️ No <code>entries.csv</code> found — add it to the repo to see participant scores.</div>`
    : '';
}

// ── LAST UPDATED ──────────────────────────────────────────────────────────────

function renderLastUpdated() {
  document.getElementById('last-updated').textContent =
    _lastFetch ? `Updated ${timeAgo(_lastFetch)}` : '';
}

// ── LEADERBOARD ───────────────────────────────────────────────────────────────

function renderLeaderboard() {
  const grid = document.getElementById('stats-grid');
  const body = document.getElementById('leaderboard-body');

  if (!_participants?.length) {
    grid.innerHTML = '';
    body.innerHTML = `<div class="empty-state">
      <span class="icon">📋</span>
      Entries will appear here once <code>entries.csv</code> is added to the repo.
    </div>`;
    return;
  }

  // Score every participant
  const ranked = _participants
    .map(p => {
      let total = 0;
      const breakdown = {};
      for (const team of p.teams) {
        const pts = _matches ? teamStats(team, _matches).total : 0;
        breakdown[team] = pts;
        total += pts;
      }
      return { ...p, total, breakdown };
    })
    .sort((a, b) => b.total - a.total);

  const played = _matches ? _matches.filter(m => m.status === 'FINISHED').length : 0;
  const leader = ranked[0];

  // Stat chips
  grid.innerHTML = `
    <div class="stat-card"><div class="val">${_participants.length}</div><div class="lbl">Participants</div></div>
    <div class="stat-card"><div class="val">${played}</div><div class="lbl">Matches Played</div></div>
    <div class="stat-card"><div class="val">${leader.total}</div><div class="lbl">Top Score</div></div>
    <div class="stat-card"><div class="val sm">${esc(leader.name)}</div><div class="lbl">Leader</div></div>
  `;

  // Leaderboard table
  const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };
  const rows = ranked.map((p, i) => {
    const rank  = i + 1;
    const medal = MEDALS[rank] ?? rank;
    const cls   = rank <= 3 ? ` r${rank}` : '';
    const pills = p.teams
      .map(t => `<span class="team-pill">${esc(t)}<span class="pts-chip">${p.breakdown[t]}pts</span></span>`)
      .join('');
    return `<tr>
      <td><span class="rank-num${cls}">${medal}</span></td>
      <td style="font-weight:700;white-space:nowrap">${esc(p.name)}</td>
      <td>${pills}</td>
      <td class="total-score">${p.total}</td>
    </tr>`;
  }).join('');

  body.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Rank</th>
          <th>Name</th>
          <th>Teams &amp; Points</th>
          <th style="text-align:right">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}
