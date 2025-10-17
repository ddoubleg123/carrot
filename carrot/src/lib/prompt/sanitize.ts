export interface SanitizeResult {
  cleanTitle: string;
  cleanSummary: string;
  names: string[];
  mode: 'single' | 'dual';
  actionHint?: string;
  locationHint?: string;
  crowdHint?: string;
  countHint?: string;
  eventHint?: string;
  objectHint?: string;
}

import { extractUniqueNames, decideSubjectMode } from './subject';

// Broadened to handle all dynamic scenes, not just sports.
const ACTION_VERBS = [
  'running','walking','fighting','shooting','speaking','debating','protesting','performing','rescuing',
  'arguing','celebrating','dancing','building','destroying','helping','marching','climbing','saving',
  'embracing','shouting','explaining','giving a speech','attacking','defending','searching','filming',
  'interviewing','reporting','crowd watching','crowd cheering'
];

const ENVIRONMENTS = [
  'arena','stadium','stage','court','street','battlefield','conference','press room','office','temple',
  'church','mosque','market','field','mountain','beach','forest','desert','highway','bridge','school',
  'city square','studio','rooftop','hall','riverbank'
];

const CROWD_PHRASES = [
  'crowd cheering','crowd watching','crowd panicking','crowd in awe','audience clapping','people shouting',
  'supporters applauding','onlookers','massive audience','packed crowd'
];

export function sanitizeInputs(title: string, summary: string): SanitizeResult {
  const cleanTitle = title.replace(/\s+/g, ' ').trim();
  const cleanSummary = summary.replace(/\s+/g, ' ').trim();

  const merged = `${title ?? ''}. ${summary ?? ''}`.trim();

  // Detect capitalized names
  const nameMatches = merged.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)\b/g) || [];
  const names = Array.from(new Set(nameMatches));

  // Find main action(s)
  const actionHint = ACTION_VERBS.find(v => merged.toLowerCase().includes(v));

  // Detect setting/environment
  const locationHint = ENVIRONMENTS.find(v => merged.toLowerCase().includes(v));

  // Detect emotional / crowd context
  const crowdHint = CROWD_PHRASES.find(v => merged.toLowerCase().includes(v));

  // Optional quantitative context
  const countHint = merged.match(/\b\d+\s*(people|soldiers|attendees|fans|spectators|vehicles)\b/i)?.[0];

  // Determine mode
  const mode: 'single' | 'dual' = names.length >= 2 ? 'dual' : 'single';

  return {
    cleanTitle,
    cleanSummary,
    names,
    mode,
    actionHint,
    locationHint,
    crowdHint,
    countHint
  };
}

