'use strict';

// ── SCORING RULES ─────────────────────────────────────────────────────────────
const SCORING = { WIN: 5, DRAW: 2, STAGE: 10 };

// ── TEAM CATALOGUE ────────────────────────────────────────────────────────────
// cost  = draft credit value (budget is 100)
// tier  = display grouping (1 = favourites … 6 = outsiders)
const TEAM_DATA = {
  // Tier 1 — Genuine Favourites
  'Spain':        { cost: 50, tier: 1 },
  'France':       { cost: 48, tier: 1 },
  'England':      { cost: 46, tier: 1 },
  'Portugal':     { cost: 44, tier: 1 },
  'Argentina':    { cost: 42, tier: 1 },
  'Brazil':       { cost: 40, tier: 1 },
  'Germany':      { cost: 38, tier: 1 },
  'Netherlands':  { cost: 36, tier: 1 },
  // Tier 2 — Strong Contenders
  'Belgium':      { cost: 30, tier: 2 },
  'Morocco':      { cost: 29, tier: 2 },
  'Uruguay':      { cost: 28, tier: 2 },
  'Colombia':     { cost: 27, tier: 2 },
  'Croatia':      { cost: 26, tier: 2 },
  'Norway':       { cost: 25, tier: 2 },
  'Japan':        { cost: 24, tier: 2 },
  'United States':{ cost: 23, tier: 2 },
  // Tier 3 — Quarter-final Potential
  'Switzerland':  { cost: 20, tier: 3 },
  'Austria':      { cost: 19, tier: 3 },
  'Sweden':       { cost: 18, tier: 3 },
  'Senegal':      { cost: 17, tier: 3 },
  'Mexico':       { cost: 16, tier: 3 },
  'Türkiye':      { cost: 15, tier: 3 },
  'Ecuador':      { cost: 14, tier: 3 },
  'Paraguay':     { cost: 13, tier: 3 },
  // Tier 4 — Dangerous Knockout Teams
  'South Korea':  { cost: 12, tier: 4 },
  'Australia':    { cost: 12, tier: 4 },
  'Egypt':        { cost: 11, tier: 4 },
  'Iran':         { cost: 11, tier: 4 },
  'Algeria':      { cost: 10, tier: 4 },
  'Scotland':     { cost: 10, tier: 4 },
  'Ghana':        { cost:  9, tier: 4 },
  'Tunisia':      { cost:  9, tier: 4 },
  // Tier 5 — Long Shots
  'Czechia':                 { cost: 8, tier: 5 },
  'Ivory Coast':             { cost: 8, tier: 5 },
  'Bosnia and Herzegovina':  { cost: 7, tier: 5 },
  'Canada':                  { cost: 7, tier: 5 },
  'Uzbekistan':              { cost: 6, tier: 5 },
  'Qatar':                   { cost: 6, tier: 5 },
  'Panama':                  { cost: 5, tier: 5 },
  'Saudi Arabia':            { cost: 5, tier: 5 },
  // Tier 6 — Biggest Outsiders
  'New Zealand':  { cost: 4, tier: 6 },
  'Iraq':         { cost: 4, tier: 6 },
  'Jordan':       { cost: 4, tier: 6 },
  'DR Congo':     { cost: 3, tier: 6 },
  'South Africa': { cost: 3, tier: 6 },
  'Cape Verde':   { cost: 3, tier: 6 },
  'Haiti':        { cost: 2, tier: 6 },
  'Curaçao':      { cost: 2, tier: 6 },
};

// ── TIER LABELS ───────────────────────────────────────────────────────────────
const TIER_LABELS = {
  1: 'Tier 1 — Genuine Favourites',
  2: 'Tier 2 — Strong Contenders',
  3: 'Tier 3 — Quarter-final Potential',
  4: 'Tier 4 — Dangerous Knockout Teams',
  5: 'Tier 5 — Long Shots',
  6: 'Tier 6 — Biggest Outsiders',
};

// ── PROGRESSION STAGES (in scoring order) ────────────────────────────────────
const STAGES = ['last32', 'last16', 'quarterfinal', 'semifinal', 'final', 'winner'];
const STAGE_LABELS = {
  last32:       'Round of 32',
  last16:       'Round of 16',
  quarterfinal: 'Quarter-final',
  semifinal:    'Semi-final',
  final:        'Final',
  winner:       'Winner',
};

// ── MATCH STAGE KEYS (as returned by football-data.org API) ──────────────────
const MATCH_STAGE_LABELS = {
  GROUP_STAGE:   'Group Stage',
  LAST_32:       'Round of 32',
  LAST_16:       'Round of 16',
  QUARTER_FINALS:'Quarter-finals',
  SEMI_FINALS:   'Semi-finals',
  THIRD_PLACE:   'Third Place',
  FINAL:         'Final',
};

// ── API NAME NORMALISATIONS ───────────────────────────────────────────────────
// Maps names returned by the API to the canonical names used in TEAM_DATA.
const API_NAME_MAP = {
  'USA':                          'United States',
  'United States of America':     'United States',
  'Turkey':                       'Türkiye',
  'Turkiye':                      'Türkiye',   // encoding fallback
  'Korea Republic':               'South Korea',
  'Republic of Korea':            'South Korea',
  "Côte d'Ivoire":                'Ivory Coast',
  "Cote d'Ivoire":                'Ivory Coast',
  'Bosnia-Herzegovina':           'Bosnia and Herzegovina',
  'Bosnia & Herzegovina':         'Bosnia and Herzegovina',
  'Congo DR':                     'DR Congo',
  'Congo (DR)':                   'DR Congo',
  'Democratic Republic of Congo': 'DR Congo',
  'Cabo Verde':                   'Cape Verde',
  'Czech Republic':               'Czechia',
  'Curacao':                      'Curaçao',
};
