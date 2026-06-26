'use strict';

// ── RULES TAB ─────────────────────────────────────────────────────────────────

function renderRules() {
  const el = document.getElementById('tab-rules');
  if (!el) return;

  el.innerHTML = `
    <div class="card">
      <div class="card-title">📋 How It Works</div>
      <p style="font-size:0.85rem;color:var(--muted);margin-bottom:1.25rem">
        Each entry picks <strong>4 teams</strong> with a budget of <strong>100 credits.</strong>
        Points from all 4 teams are added together throughout the tournament.
        The leaderboard updates automatically every 30 minutes.
      </p>

      <div class="rules-section">
        <h3 class="rules-heading">Group Stage</h3>
        <table class="rules-table">
          <thead><tr><th>Result</th><th>Points</th></tr></thead>
          <tbody>
            <tr><td>Win</td><td class="pts">+5 pts</td></tr>
            <tr><td>Draw</td><td class="pts">+2 pts</td></tr>
            <tr><td>Loss</td><td class="pts muted">0 pts</td></tr>
          </tbody>
        </table>
        <p class="rules-note">Each team plays 3 group stage matches — maximum 15 pts from the group stage.</p>
      </div>

      <div class="rules-section">
        <h3 class="rules-heading">Knockout Rounds</h3>
        <p class="rules-note" style="margin-bottom:0.75rem">Each knockout round scores in two ways — <strong>reaching it</strong> and <strong>winning it.</strong></p>
        <table class="rules-table">
          <thead><tr><th>Milestone</th><th>Points</th></tr></thead>
          <tbody>
            <tr><td>Reach Round of 32</td><td class="pts">+10 pts</td></tr>
            <tr><td>Win Round of 32</td><td class="pts">+5 pts</td></tr>
            <tr class="rules-row-sep"><td>Reach Round of 16</td><td class="pts">+10 pts</td></tr>
            <tr><td>Win Round of 16</td><td class="pts">+5 pts</td></tr>
            <tr class="rules-row-sep"><td>Reach Quarter-Finals</td><td class="pts">+10 pts</td></tr>
            <tr><td>Win Quarter-Final</td><td class="pts">+5 pts</td></tr>
            <tr class="rules-row-sep"><td>Reach Semi-Finals</td><td class="pts">+10 pts</td></tr>
            <tr><td>Win Semi-Final</td><td class="pts">+5 pts</td></tr>
            <tr class="rules-row-sep"><td>Reach the Final</td><td class="pts">+10 pts</td></tr>
            <tr><td>Win the World Cup</td><td class="pts">+10 pts</td></tr>
          </tbody>
        </table>
        <p class="rules-note">Extra time &amp; penalties — only the winning team scores. No draw points in knockout rounds.</p>
        <p class="rules-note">The Final — winning is rewarded as the <em>Win World Cup</em> bonus (+10 pts). The match result does not count as a separate win.</p>
        <p class="rules-note"><strong>Progression is automatic</strong> — the moment your team appears in a fixture for a knockout round, the +10 pts bonus is awarded, even before the match is played.</p>
      </div>

      <div class="rules-section">
        <h3 class="rules-heading">3rd Place Play-off</h3>
        <table class="rules-table">
          <thead><tr><th>Result</th><th>Points</th></tr></thead>
          <tbody>
            <tr><td>Win</td><td class="pts">+5 pts</td></tr>
            <tr><td>Loss</td><td class="pts muted">0 pts</td></tr>
          </tbody>
        </table>
      </div>

      <div class="rules-section">
        <h3 class="rules-heading">Maximum Possible Scores</h3>
        <table class="rules-table">
          <thead><tr><th>Finish</th><th>Max pts (one team)</th></tr></thead>
          <tbody>
            <tr><td>🥇 World Cup Winner</td><td class="pts"><strong>95</strong></td></tr>
            <tr><td>🥈 Runner-up (loses Final)</td><td class="pts">85</td></tr>
            <tr><td>🥉 3rd place (wins play-off)</td><td class="pts">75</td></tr>
            <tr><td>4th place (loses play-off)</td><td class="pts">70</td></tr>
            <tr><td>Knocked out in Quarter-Finals</td><td class="pts">55</td></tr>
            <tr><td>Knocked out in Round of 16</td><td class="pts">40</td></tr>
            <tr><td>Knocked out in Round of 32</td><td class="pts">25</td></tr>
            <tr><td>Eliminated at Group Stage</td><td class="pts">15</td></tr>
          </tbody>
        </table>
        <p class="rules-note" style="margin-top:0.75rem">With 4 teams, the theoretical ceiling per entry is <strong>380 pts</strong> — but only one team can win the World Cup, so the realistic ceiling is lower.</p>
      </div>
    </div>`;
}
