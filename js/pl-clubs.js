'use strict';

// ── PL CLUBS TAB ──────────────────────────────────────────────────────────────

const COUNTRY_FLAGS = {
  'Algeria':      '🇩🇿', 'Argentina':    '🇦🇷', 'Australia':    '🇦🇺',
  'Austria':      '🇦🇹', 'Belgium':      '🇧🇪', 'Bosnia-Herzegovina': '🇧🇦',
  'Brazil':       '🇧🇷', 'Canada':       '🇨🇦', 'Cape Verde Islands': '🇨🇻',
  'Colombia':     '🇨🇴', 'Congo DR':     '🇨🇩', 'Croatia':      '🇭🇷',
  'Curaçao':      '🇨🇼', 'Czechia':      '🇨🇿', 'Ecuador':      '🇪🇨',
  'Egypt':        '🇪🇬', 'England':      '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'France':       '🇫🇷',
  'Germany':      '🇩🇪', 'Ghana':        '🇬🇭', 'Haiti':        '🇭🇹',
  'Iran':         '🇮🇷', 'Iraq':         '🇮🇶', 'Ivory Coast':  '🇨🇮',
  'Japan':        '🇯🇵', 'Jordan':       '🇯🇴', 'Mexico':       '🇲🇽',
  'Morocco':      '🇲🇦', 'Netherlands':  '🇳🇱', 'New Zealand':  '🇳🇿',
  'Norway':       '🇳🇴', 'Panama':       '🇵🇦', 'Paraguay':     '🇵🇾',
  'Portugal':     '🇵🇹', 'Qatar':        '🇶🇦', 'Saudi Arabia': '🇸🇦',
  'Scotland':     '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Senegal':      '🇸🇳', 'South Africa': '🇿🇦',
  'South Korea':  '🇰🇷', 'Spain':        '🇪🇸', 'Sweden':       '🇸🇪',
  'Switzerland':  '🇨🇭', 'Tunisia':      '🇹🇳', 'Türkiye':      '🇹🇷',
  'Turkey':       '🇹🇷', 'United States':'🇺🇸', 'Uruguay':      '🇺🇾',
  'Uzbekistan':   '🇺🇿',
};

const POS_ORDER = { GK: 0, DF: 1, MF: 2, FW: 3 };

function renderPlClubs() {
  const el = document.getElementById('pl-clubs-body');
  if (!el) return;

  if (!_plClubs) {
    el.innerHTML = `<div class="empty-state"><span class="icon">⏳</span>Loading club data…</div>`;
    return;
  }

  // Build set of active countries from matches (teams with upcoming fixtures)
  const active = buildActiveCountries(_matches);

  const clubs = Object.entries(_plClubs)
    .sort((a, b) => b[1].players.length - a[1].players.length);

  const totalPlayers  = clubs.reduce((s, [, d]) => s + d.players.length, 0);
  const totalCountries = new Set(clubs.flatMap(([, d]) => d.players.map(p => p.country))).size;

  // Summary bar
  const summary = `
    <div class="pl-summary">
      <span><strong>${totalPlayers}</strong> PL players at the WC</span>
      <span class="sep">·</span>
      <span><strong>${clubs.length}</strong> clubs represented</span>
      <span class="sep">·</span>
      <span><strong>${totalCountries}</strong> nations</span>
    </div>`;

  // Club accordions
  const sections = clubs.map(([clubName, data], idx) => {
    const byCountry = {};
    for (const p of data.players) {
      (byCountry[p.country] = byCountry[p.country] || []).push(p);
    }

    const countryRows = Object.entries(byCountry)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([country, players]) => {
        const flag     = COUNTRY_FLAGS[country] || '🏳';
        const fdName   = players[0].fd_country || country;
        const isActive = active.has(fdName) || active.has(country);
        const badge    = isActive
          ? '<span class="pl-badge active">Active</span>'
          : '<span class="pl-badge out">Eliminated</span>';
        const sorted = [...players].sort((a, b) =>
          (POS_ORDER[a.position] ?? 9) - (POS_ORDER[b.position] ?? 9)
        );
        const playerList = sorted
          .map(p => `<span class="pl-player">${esc(p.name)}<span class="pl-pos">${esc(p.position)}</span></span>`)
          .join('');
        return `<div class="pl-country-row">
          <div class="pl-country-name">${flag} ${esc(country)} ${badge}</div>
          <div class="pl-players">${playerList}</div>
        </div>`;
      }).join('');

    const activeCount = Object.entries(byCountry)
      .filter(([c, ps]) => active.has(ps[0].fd_country || c) || active.has(c))
      .reduce((s, [, ps]) => s + ps.length, 0);

    const isOpen = idx === 0;

    return `<div class="match-section">
      <button class="match-section-toggle${isOpen ? ' open' : ''}">
        <span class="pl-toggle-inner">
          ${data.logo ? `<img class="pl-club-logo-sm" src="${esc(data.logo)}" alt="">` : ''}
          <span>${esc(clubName)}</span>
          <span class="pl-toggle-meta">${data.players.length} players · ${activeCount} active</span>
        </span>
        <span class="chevron">▾</span>
      </button>
      <div class="match-section-body${isOpen ? ' open' : ''}">
        <div class="pl-countries">${countryRows}</div>
      </div>
    </div>`;
  }).join('');

  el.innerHTML = summary + `<div class="card">${sections}</div>`;

  el.querySelectorAll('.match-section-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const open = btn.classList.toggle('open');
      btn.nextElementSibling.classList.toggle('open', open);
    });
  });
}

function buildActiveCountries(matches) {
  if (!matches) return new Set();
  const active = new Set();
  for (const m of matches) {
    if (!['TIMED', 'SCHEDULED'].includes(m.status)) continue;
    if (m.homeTeam?.name) active.add(m.homeTeam.name);
    if (m.awayTeam?.name) active.add(m.awayTeam.name);
  }
  return active;
}
