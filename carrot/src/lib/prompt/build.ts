import { SanitizeResult } from './sanitize';

type StyleMode = 'photo' | 'cgi' | 'painting' | 'sketch' | 'illustration' | 'anime' | 'vintage' | 'minimalist';
type Style = 'studio' | 'editorialSports' | 'photorealistic';

export interface BuildPromptInput {
  s: SanitizeResult;
  styleOverride?: string; // input style string
  locationHint?: string;
}

export interface BuiltPrompt {
  positive: string;
  negative: string;
  styleMode: StyleMode;
}

function resolveStyleMode(styleOverride?: string): StyleMode {
  const s = (styleOverride || '').toLowerCase();
  if (/cgi|digital|3d|render/.test(s)) return 'cgi';
  if (/paint|brush|oil|watercolor/.test(s)) return 'painting';
  if (/sketch|pencil|drawing/.test(s)) return 'sketch';
  if (/illustration|vector|flat/.test(s)) return 'illustration';
  if (/anime|toon|cartoon|animation/.test(s)) return 'anime';
  if (/vintage|retro/.test(s)) return 'vintage';
  if (/minimal/.test(s)) return 'minimalist';
  return 'photo';
}

const NEGATIVE_PHOTOREALISTIC = [
  'cartoon', 'anime', 'stylized', 'illustration', 'drawing', 'sketch', 'painting',
  'lowres', 'blurry', 'overexposed', 'underexposed', 'deformed hands', 'extra limbs',
  'duplicate people', 'text artifacts',
  'halo', 'crown of thorns', 'laurel wreath', 'saint iconography', 'divine glow', 'religious mural', 'backlit halo'
].join(', ');

const NEGATIVE_ILLUSTRATION = [
  'photograph', 'photography', 'photorealistic', 'realistic photo', 'lifelike photo', 'camera', 'lens', 'DSLR',
  'candid', 'snapshot', 'journalistic', 'documentary photo',
  'lowres', 'blurry', 'pixelated', 'deformed', 'bad anatomy', 'duplicate people', 'text artifacts',
  'halo', 'crown of thorns', 'laurel wreath', 'saint iconography', 'divine glow', 'religious mural', 'backlit halo',
  'stained glass', 'mural', 'religious iconography', 'static portrait', 'centered headshot'
].join(', ');

const NEGATIVE_PHOTOREALISTIC_SCENE = [
  'cartoon', 'anime', 'stylized', 'illustration', 'drawing', 'sketch', 'painting',
  'lowres', 'blurry', 'overexposed', 'underexposed', 'deformed hands', 'extra limbs',
  'duplicate people', 'text artifacts',
  'halo', 'saint icon', 'crown of thorns', 'stained glass', 'mural', 'religious iconography', 'static portrait', 'centered headshot'
].join(', ');

const NEGATIVE_ANIMATION = [
  'photograph', 'photography', 'photorealistic', 'realistic', 'lifelike', 'natural', 'authentic',
  'documentary', 'journalistic', 'candid', 'snapshot',
  '3d render', 'cgi', 'realistic rendering',
  'lowres', 'blurry', 'pixelated', 'distorted', 'deformed', 'bad anatomy', 'duplicate people', 'text artifacts',
  'halo', 'crown of thorns', 'stained glass', 'mural', 'religious iconography', 'saint iconography'
].join(', ');

function cameraBlock() {
  return 'sharp focus, bokeh background, 85mm lens look, f/1.4 depth of field, professional composition, 8K detail';
}

function styleBlock(style: Style) {
  switch (style ?? 'photorealistic') {
    case 'studio': return 'studio lighting, seamless background, soft key light';
    case 'editorialSports': return 'sports photography, dynamic motion, candid moment, authentic expressions';
    default: return 'photorealistic, natural light, lifelike skin texture';
  }
}

export function buildPrompt(input: BuildPromptInput): BuiltPrompt {
  const { s, styleOverride } = input;
  
  const mode = resolveStyleMode(styleOverride);
  
  // Build subject line
  const subject = s.mode === 'dual'
    ? `Both ${s.names.join(' and ')} are clearly visible`
    : `${s.names[0] ?? 'the subject'} is clearly visible`;

  const action = s.actionHint ? `, ${s.actionHint}` : '';
  const place = s.locationHint ? `, in the ${s.locationHint}` : ', in a realistic environment';
  const crowd = s.crowdHint ? `, ${s.crowdHint}` : '';
  const count = s.countHint ? `, ${s.countHint}` : '';

  const motion = ', dynamic composition, sense of movement and emotion, natural light, realistic depth and shadow, 8K detail, professional quality, perfect composition, rule of thirds';

  const positive = [
    subject,
    action,
    place,
    crowd,
    count,
    motion
  ].join(' ').replace(/\s+/g, ' ').trim();

  const negative = 'lowres, blurry, pixelated, static pose, empty background, cartoon, anime, painting, sketch, oversaturated, duplicate people, text artifacts';

  return { positive, negative, styleMode: mode };
}

