import { DESKS, deskById, type Desk } from '@/lib/curator/desks'

const PAST_TERMS = [
  'ancient', 'antiquity', 'dynasty', 'emperor', 'excavation', 'archaeolog', 'manuscript', 'medieval',
  'ottoman', 'byzantine', 'pharaoh', 'shogun', 'samurai', 'joseon', 'goryeo', 'safavid', 'qajar', 'samanid',
  'parthian', 'sasanian', 'sasan', 'augustus', 'caesar', 'nero', 'hadrian', 'trajan', 'pompeii', 'caligula',
  'tiberius', 'vespasian', 'marcus aurelius', 'colosseum', 'pax romana', 'reformation', 'enlightenment',
  'stoic', 'seneca', 'epictetus', 'talmud', 'kabbalah', 'zohar', 'gilded age', 'civil war', 'confederate',
  'abraham lincoln', 'bolshevik', 'soviet', 'lenin', 'stalin', 'trotsky', 'brezhnev', 'gorbachev',
  'thomas jefferson', 'james madison', 'alexander hamilton', 'george washington', 'continental congress',
  'dead sea', 'qumran', 'caliph', 'umayyad', 'abbasid', 'meiji', 'tokugawa', 'ming dynasty', 'qing dynasty',
  'han dynasty', 'tang dynasty', 'song dynasty', 'opium war', 'balfour', 'peel commission', 'crusade',
  'viking', 'roman legion', 'roman empire', 'roman republic', 'roman army', 'roman coin', 'denarius',
  'gracchi', 'scipio', 'spartacus', 'cleopatra', 'octavian', 'diocletian', 'livy', 'tacitus', 'polybius', 'plutarch',
  'gladiator', 'constantinople', 'sparta', 'athens', 'pericles', 'hannibal', 'cannae', 'punic',
  'charlemagne', 'napoleon', 'victorian', 'world war', 'magna carta', 'hieroglyph', 'cuneiform',
  'mesopotamia', 'babylon', 'sumer', 'neanderthal', 'hominin', 'denisovan', 'cyrus', 'darius', 'xerxes', 'persepolis',
  'behistun', 'achaemenid', 'shapur', 'mossadegh', 'french revolution', 'haitian revolution',
  'american revolution', 'bastille', 'founding father', 'declaration of independence',
  'constitutional convention', 'thirteen colonies', 'house of wisdom', 'khwarizmi', 'ibn sina',
  'sephard', 'ashkenaz', 'council of nicaea', 'council of trent', 'martin luther', 'great schism',
  'edo period', 'heian', 'shogunate', 'robber baron', 'standard oil', 'appomattox', 'emancipation',
  'war communism', 'april theses', '19th century', '18th century', '17th century', 'archival',
  'genealogy', 'ancestor', 'diaspora', 'second temple', 'caliphate', 'auxilia', 'sestertius',
  'aureus', 'sima qian', 'british mandate', 'reconstruction era', 'codex', 'sejong', 'nader shah',
  'confucius', 'laozi', 'buddha', 'tao te ching', 'analects', 'voltaire', 'john locke',
  'immanuel kant', 'rousseau', 'census record', 'family tree', 'historic newspaper'
]

export function isPast(text: string): boolean {
  const hay = text.toLowerCase()
  if (PAST_TERMS.some((term) => hay.includes(term))) return true
  const years = hay.match(/\b\d{3,4}\b/g) || []
  return years.some((year) => {
    const value = Number(year)
    return value >= 500 && value <= 1970
  })
}

function hits(hay: string, terms: string[], min: number): number {
  return terms.filter((term) => {
    const clean = term.trim().toLowerCase()
    if (clean.length < min) return false
    const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`).test(hay)
  }).length
}

/** One desk owns a video. A weak match stays with the catch-all desk. */
export function chooseDesk(text: string): Desk {
  const hay = text.toLowerCase()
  let best: Desk | null = null
  let score = 0
  for (const desk of DESKS) {
    if (desk.id === 'finds') continue
    if (desk.past && !isPast(hay)) continue
    const focus = hits(hay, [...(desk.focus || []), ...(desk.route || [])], 3)
    const beat = hits(hay, desk.beat.split(/[^a-z0-9]+/i), 4)
    const next = focus * 2 + (focus > 0 ? beat : 0)
    if (next > score) {
      score = next
      best = desk
    }
  }
  return (score >= 2 && best) || deskById('finds') || DESKS[0]
}
