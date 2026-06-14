'use strict';

// ── MATCH DATA ────────────────────────────────────────────────────────────────
// matches.json is updated every 30 mins by GitHub Actions (see .github/workflows/).
// Fetching from the same origin means no CORS and no API key in the browser.

let _lastFetch = 0;

/**
 * Load match data from matches.json.
 * Results are cached for 60 seconds — pass force=true to bypass the cache.
 */
async function loadMatches(force = false) {
  if (!force && Date.now() - _lastFetch < 60_000) return _matches;
  try {
    const res = await fetch('matches.json?t=' + Date.now());
    if (!res.ok) return _matches;
    const data = await res.json();
    _lastFetch = Date.now();
    return Array.isArray(data) ? data : null;
  } catch {
    return _matches;
  }
}

// ── PL CLUBS DATA ─────────────────────────────────────────────────────────────

async function loadPlClubs() {
  try {
    const res = await fetch('pl-clubs.json?t=' + Date.now());
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ── ENTRIES CSV ───────────────────────────────────────────────────────────────

/**
 * Load participant picks from entries.csv.
 *
 * Handles two formats:
 *   Simple:  Name, Team1, Team2, Team3, Team4
 *   Forms:   (Microsoft Forms export) — auto-detected by header row.
 *            Team names may include cost suffixes like "France (48)" which
 *            are stripped before lookup.
 */
async function loadEntries() {
  try {
    const res = await fetch('entries.csv?t=' + Date.now());
    if (!res.ok) return null;
    // Microsoft Forms exports are often Windows-1252 (ü=0xFC, ç=0xE7).
    // Try strict UTF-8 first; if the bytes are invalid, fall back to Windows-1252.
    const buffer = await res.arrayBuffer();
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
      text = new TextDecoder('windows-1252').decode(buffer);
    }
    return parseEntriesCSV(text);
  } catch {
    return null;
  }
}

/**
 * Parse CSV text into an array of { name, teams[] } participant objects.
 * Pure function — no side effects, easy to unit-test.
 */
function parseEntriesCSV(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

  // Detect Microsoft Forms export vs simple format
  const isForms    = headers.includes('your name') || headers.includes('team 1');
  const nameCol    = isForms ? headers.indexOf('your name') : 0;
  const teamStart  = isForms ? headers.indexOf('team 1')    : 1;
  const emailCol   = isForms ? headers.indexOf('email')     : -1;
  if (nameCol === -1 || teamStart === -1) return null;

  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map(p => p.trim());
    const name  = parts[nameCol];
    if (!name) continue;

    // Extract email username for disambiguation tooltip.
    // Handles both "user@domain.com" and already-stripped "user" formats.
    const rawEmail  = emailCol >= 0 ? (parts[emailCol] || '') : '';
    const emailUser = rawEmail ? (rawEmail.includes('@') ? rawEmail.split('@')[0] : rawEmail) : null;

    // Strip cost suffixes e.g. "France (48)" → "France"
    const rawTeams = parts
      .slice(teamStart, teamStart + 4)
      .map(t => t.replace(/\s*\(\d+\)\s*$/, ''));

    const teams = rawTeams.map(findTeam).filter(Boolean);
    if (teams.length === 4) out.push({ name, teams, emailUser });
  }

  return out.length ? out : null;
}
