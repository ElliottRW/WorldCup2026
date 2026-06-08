'use strict';

// ── APP STATE ─────────────────────────────────────────────────────────────────
let _participants = null;
let _matches      = null;

// ── RENDER ────────────────────────────────────────────────────────────────────
function renderAll() {
  renderBanners();
  renderLastUpdated();
  renderLeaderboard();
  renderTeams();
  renderMatches();
  renderDataTab();
}

// ── TAB NAVIGATION ────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// ── REFRESH BUTTON ────────────────────────────────────────────────────────────
document.getElementById('btn-refresh').addEventListener('click', async () => {
  const btn = document.getElementById('btn-refresh');
  btn.disabled = true;
  btn.textContent = '…';
  [_matches, _participants] = await Promise.all([loadMatches(true), loadEntries()]);
  renderAll();
  btn.disabled = false;
  btn.textContent = '↻';
});

// ── INIT ──────────────────────────────────────────────────────────────────────
async function init() {
  [_matches, _participants] = await Promise.all([loadMatches(true), loadEntries()]);
  renderAll();

  // Re-fetch every 60s (matches.json is updated by GitHub Actions every 30 min)
  setInterval(async () => {
    [_matches, _participants] = await Promise.all([loadMatches(), loadEntries()]);
    renderAll();
  }, 60_000);

  // Refresh the "Updated X mins ago" label independently
  setInterval(renderLastUpdated, 30_000);
}

init();
