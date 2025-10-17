export type SubjectMode = 'single' | 'dual';

export function extractUniqueNames(text: string): string[] {
  // Capture proper names with 2+ capitalized words
  const matches = text.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)\b/g) || [];
  
  // Normalize spaces and remove duplicates
  const cleaned = matches.map(m => m.trim().replace(/\s+/g, ' '));
  
  // Break accidental doubles like "Jesus Christ Jesus Christ"
  const splitFixed = cleaned.flatMap(name => {
    const parts = name.split(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)\b/g).filter(Boolean);
    return parts.map(p => p.trim());
  });
  
  const deduped = [...new Set(splitFixed.map(n => n.trim()))];
  return deduped.filter(Boolean);
}

export function decideSubjectMode(names: string[]): SubjectMode {
  return names.length >= 2 ? 'dual' : 'single';
}

