import { sanitizeInputs } from '@/lib/prompt/sanitize';
import { buildPrompt } from '@/lib/prompt/build';

test('single subject: Derrick Rose', () => {
  const s = sanitizeInputs(
    'Derrick Rose MVP Season Analysis',
    "Comprehensive look at Derrick Rose's 2011 MVP season with the Bulls, including his stats, impact on the team, and legacy in Chicago basketball."
  );
  expect(s.names).toEqual(['Derrick Rose']);
  expect(s.mode).toBe('single');
  const { positive } = buildPrompt({ s, styleOverride: 'photorealistic' });
  expect(positive).toMatch(/Derrick Rose is clearly visible/);
  expect(positive).not.toMatch(/Both/);
});

test('dual subject: Michael Jordan and Scottie Pippen', () => {
  const s = sanitizeInputs('Michael Jordan and Scottie Pippen', '1996 Bulls');
  expect(s.names.sort()).toEqual(['Michael Jordan', 'Scottie Pippen'].sort());
  expect(s.mode).toBe('dual');
  const { positive } = buildPrompt({ s });
  expect(positive).toMatch(/Both Michael Jordan and Scottie Pippen are clearly visible/);
});

test('dual subject via "with": Donald Trump with Vladimir Putin', () => {
  const s = sanitizeInputs('Donald Trump', 'Donald Trump in a large arena with Vladimir Putin celebrating');
  expect(s.names.sort()).toEqual(['Donald Trump', 'Vladimir Putin'].sort());
  expect(s.mode).toBe('dual');
  expect(s.locationHint).toBe('large arena');
  const { positive } = buildPrompt({ s });
  expect(positive).toMatch(/Both Donald Trump and Vladimir Putin are clearly visible/);
  expect(positive).toMatch(/in large arena/);
});

test('location hint extraction', () => {
  const s = sanitizeInputs('Derrick Rose', 'Derrick Rose playing in a large stadium');
  expect(s.locationHint).toBe('in a large stadium');
});

test('action and event hint extraction', () => {
  const s = sanitizeInputs(
    'Jesus Christ',
    'Jesus Christ giving a political speech at a political rally in front of the Grand Canyon.'
  );
  expect(s.names).toEqual(['Jesus Christ']);
  expect(s.mode).toBe('single');
  expect(s.actionHint).toMatch(/giving.*speech/);
  expect(s.eventHint).toBe('political rally');
  expect(s.locationHint).toBe('in front of the Grand Canyon');
});

test('dedup: Jesus Christ Jesus Christ → Jesus Christ', () => {
  const s = sanitizeInputs('Jesus Christ Jesus Christ', 'Some summary');
  expect(s.names).toEqual(['Jesus Christ']);
  expect(s.mode).toBe('single');
});

test('safety rewrite prevents "both X and X"', () => {
  const s = {
    cleanTitle: 'Derrick Rose Derrick Rose',
    cleanSummary: '',
    names: ['Derrick Rose'],
    mode: 'dual' as const,
  };
  const { positive } = buildPrompt({ s: s as any });
  expect(positive).not.toMatch(/Both Derrick Rose and Derrick Rose/);
  expect(positive).toMatch(/Derrick Rose is clearly visible/);
});

test('illustration style: no photo elements in positive, photo excluded in negative', () => {
  const s = sanitizeInputs('Jesus Christ', 'Jesus Christ giving a speech');
  const { positive, negative } = buildPrompt({ s, styleOverride: 'illustration' });
  
  // Positive should have illustration terms
  expect(positive).toMatch(/illustration/i);
  expect(positive).toMatch(/stylized/i);
  expect(positive).toMatch(/bold colors/i);
  
  // Positive should NOT have photo terms
  expect(positive).not.toMatch(/photorealistic/i);
  expect(positive).not.toMatch(/85mm lens/i);
  expect(positive).not.toMatch(/camera/i);
  
  // Negative should exclude photography
  expect(negative).toMatch(/photograph/i);
  expect(negative).toMatch(/photorealistic/i);
  expect(negative).toMatch(/camera/i);
});

test('scene extraction: feeding 100 people with fish', () => {
  const s = sanitizeInputs('Jesus Christ', 'Jesus Christ feeding 100 people with fish');
  
  expect(s.names).toEqual(['Jesus Christ']);
  expect(s.mode).toBe('single');
  expect(s.actionHint).toBe('feeding');
  expect(s.objectHint).toBe('fish');
  expect(s.countHint).toBe('100 people');
  
  const { positive } = buildPrompt({ s, styleOverride: 'illustration' });
  expect(positive).toMatch(/Jesus Christ is clearly visible/);
  expect(positive).toMatch(/feeding/);
  expect(positive).toMatch(/fish/);
  expect(positive).toMatch(/surrounded by 100 people/);
  expect(positive).toMatch(/wide-angle view/);
});

test('wide scene uses correct camera: 24-35mm for crowd scenes', () => {
  const s = sanitizeInputs('Jesus Christ', 'Jesus Christ feeding 100 people with fish');
  const { positive } = buildPrompt({ s });
  
  expect(positive).toMatch(/wide-angle view/);
  expect(positive).toMatch(/24–35mm/);
  expect(positive).not.toMatch(/85mm/);
  expect(positive).not.toMatch(/shallow depth of field/);
});

test('portrait uses correct camera: 85mm for single person', () => {
  const s = sanitizeInputs('Derrick Rose', 'Portrait of Derrick Rose');
  const { positive } = buildPrompt({ s });
  
  expect(positive).toMatch(/portrait/);
  expect(positive).toMatch(/85mm/);
  expect(positive).toMatch(/f\/1.4/);
  expect(positive).toMatch(/shallow depth of field/);
});

test('animation style: anime elements, no photo terms', () => {
  const s = sanitizeInputs('Jesus Christ', 'Jesus Christ feeding 100 people with fish');
  const { positive, negative } = buildPrompt({ s, styleOverride: 'animation' });
  
  // Positive should have anime/animation terms
  expect(positive).toMatch(/anime/i);
  expect(positive).toMatch(/cel-shaded/i);
  expect(positive).toMatch(/vibrant colors/i);
  expect(positive).toMatch(/cartoon animation/i);
  
  // Positive should NOT have photo/realistic terms
  expect(positive).not.toMatch(/photorealistic/i);
  expect(positive).not.toMatch(/lens/i);
  expect(positive).not.toMatch(/camera/i);
  expect(positive).not.toMatch(/f\/1.4/i);
  
  // Negative should exclude photography and 3D
  expect(negative).toMatch(/photograph/i);
  expect(negative).toMatch(/photorealistic/i);
  expect(negative).toMatch(/3d render/i);
  expect(negative).toMatch(/cgi/i);
});

test('prioritize tangible objects: fish over people', () => {
  const s = sanitizeInputs('Jesus Christ', 'Jesus Christ feeding 100 people with fish');
  const { positive } = buildPrompt({ s });
  
  // Should use "fish" as object, not "people"
  expect(positive).toMatch(/holding or distributing fish/);
  expect(positive).not.toMatch(/holding or distributing people/);
  
  // "100 people" should be in crowd, not object
  expect(positive).toMatch(/surrounded by 100 people/);
});

test('dedup before mode selection: multiple identical names → single', () => {
  const s = sanitizeInputs('Jesus Christ', 'Jesus Christ and Jesus Christ');
  // Should detect both instances but deduplicate to single mode
  expect(s.names).toEqual(['Jesus Christ']);
  expect(s.mode).toBe('single');
});

test('painting style: no camera language, painterly tokens', () => {
  const s = sanitizeInputs('Jesus Christ', 'Portrait of Jesus Christ');
  const { positive, negative, styleMode } = buildPrompt({ s, styleOverride: 'painting' });
  
  expect(styleMode).toBe('painting');
  
  // Positive should have painting terms
  expect(positive).toMatch(/artistic brushwork/i);
  expect(positive).toMatch(/painterly strokes/i);
  expect(positive).toMatch(/gallery-quality painting/i);
  
  // Positive should NOT have camera terms
  expect(positive).not.toMatch(/lens/i);
  expect(positive).not.toMatch(/f\/1.4/i);
  expect(positive).not.toMatch(/85mm/i);
  
  // Negative should NOT exclude painting (since we want painting style)
  expect(negative).not.toMatch(/painting/i);
  expect(negative).not.toMatch(/illustration/i);
});

test('cgi/digital_art style: CGI tokens, no photo lens', () => {
  const s = sanitizeInputs('Person', 'Portrait of Person');
  const { positive, negative, styleMode } = buildPrompt({ s, styleOverride: 'digital_art' });
  
  expect(styleMode).toBe('cgi');
  expect(positive).toMatch(/CGI/i);
  expect(positive).toMatch(/3D modeled/i);
  expect(positive).toMatch(/ray-traced/i);
  expect(positive).not.toMatch(/lens/i);
  expect(positive).not.toMatch(/f\/1.4/i);
});

test('sketch style: pencil, cross-hatching, graphite', () => {
  const s = sanitizeInputs('Person', 'Portrait of Person');
  const { positive, negative, styleMode } = buildPrompt({ s, styleOverride: 'sketch' });
  
  expect(styleMode).toBe('sketch');
  expect(positive).toMatch(/pencil/i);
  expect(positive).toMatch(/cross-hatching/i);
  expect(positive).toMatch(/graphite/i);
  expect(negative).toMatch(/heavy color fills/);
});

test('minimalist style: clean, simple, negative space', () => {
  const s = sanitizeInputs('Person', 'Portrait of Person');
  const { positive, negative, styleMode } = buildPrompt({ s, styleOverride: 'minimalist' });
  
  expect(styleMode).toBe('minimalist');
  expect(positive).toMatch(/minimalist/i);
  expect(positive).toMatch(/clean/i);
  expect(positive).toMatch(/simple/i);
  expect(negative).toMatch(/cluttered/);
  expect(negative).toMatch(/busy/);
});

test('vintage style: film grain, sepia, classic', () => {
  const s = sanitizeInputs('Person', 'Portrait of Person');
  const { positive, negative, styleMode } = buildPrompt({ s, styleOverride: 'vintage' });
  
  expect(styleMode).toBe('vintage');
  expect(positive).toMatch(/vintage/i);
  expect(positive).toMatch(/film grain/i);
  expect(positive).toMatch(/sepia/i);
  expect(negative).toMatch(/modern digital/);
});

