'use strict';

// ── TEAMS TAB ─────────────────────────────────────────────────────────────────

function renderTeams() {
  const rows = [];

  for (let tier = 1; tier <= 6; tier++) {
    // Tier header row
    rows.push(`<tr class="tier-row"><td colspan="8">${TIER_LABELS[tier]}</td></tr>`);

    // Teams within this tier, sorted highest cost first
    const teams = Object.entries(TEAM_DATA)
      .filter(([, d]) => d.tier === tier)
      .sort((a, b) => b[1].cost - a[1].cost);

    for (const [name, data] of teams) {
      const s    = _matches ? teamStats(name, _matches) : { wins: 0, draws: 0, losses: 0, matchPts: 0, prog: {}, total: 0 };
      const tags = STAGES
        .filter(stage => s.prog[stage])
        .map(stage => `<span class="stage-tag">✓ ${STAGE_LABELS[stage]}</span>`)
        .join('');
      const ppc  = ptsPerCredit(s.total, data.cost);

      rows.push(`<tr>
        <td style="font-weight:600;white-space:nowrap">${esc(name)}</td>
        <td><span class="cost-chip">${data.cost}</span></td>
        <td style="text-align:center">${s.wins}</td>
        <td style="text-align:center">${s.draws}</td>
        <td style="text-align:center">${s.losses}</td>
        <td style="text-align:center">${s.matchPts}</td>
        <td>${tags || '<span style="color:#ccc;font-size:0.7rem">—</span>'}</td>
        <td><span class="pts-pill">${s.total}</span></td>
        <td style="text-align:center;color:var(--muted);font-size:0.8rem">${ppc > 0 ? ppc.toFixed(2) : '—'}</td>
      </tr>`);
    }
  }

  document.getElementById('teams-tbody').innerHTML = rows.join('');
}
