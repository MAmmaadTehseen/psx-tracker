export const C = {
  // Backgrounds (layered depth)
  void:    '#03060e',
  base:    '#07101d',
  surface: '#0b1627',
  raised:  '#101e30',

  // Brand
  primary: '#00d47a',
  primaryDark: '#00a35e',
  dim:     'rgba(0,212,122,0.12)',
  glow:    'rgba(0,212,122,0.35)',

  // Sentiment
  bull:    '#00d47a',
  bullBg:  'rgba(0,212,122,0.12)',
  bear:    '#f23645',
  bearBg:  'rgba(242,54,69,0.10)',
  gold:    '#f5a623',
  goldBg:  'rgba(245,166,35,0.13)',

  // Text
  t1: '#e8eef8',
  t2: '#7f93a8',
  t3: '#3d5268',
  t4: '#1e3044',

  // Borders
  b1: '#162034',
  b2: '#1e2e48',
} as const;

export const S = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  glow: {
    shadowColor: '#00d47a',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  goldGlow: {
    shadowColor: '#f5a623',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
} as const;
