import { brainBrief, buildShelves, heldDocument, passages, postKnowledge, type BrainItem } from '@/lib/learn/brain'

function item(partial: Partial<BrainItem> & Pick<BrainItem, 'title' | 'origin' | 'quote'>): BrainItem {
  return { url: '', ...partial }
}

test('an uploaded PDF and a transcript are held, and a web page is not', () => {
  expect(heldDocument(item({
    title: 'Filing',
    origin: 'member',
    url: '/topic-docs/a.pdf',
    quote: 'The PDF is the source. Open the file to read it.',
    body: 'The processor is named Snapdragon X Elite and the filing describes its cores in detail here.'
  }))).toBe(true)
  expect(heldDocument(item({
    title: 'Hearing',
    origin: 'member',
    url: 'https://www.youtube.com/watch?v=abc',
    video: '/topic-videos/a.mp4',
    quote: 'The witness said the laptop chip is Snapdragon X Elite and named the core count on the record.'
  }))).toBe(true)
  expect(heldDocument(item({
    title: 'News',
    origin: 'search',
    url: 'https://example.com/story',
    quote: 'A news page says the laptop chip is Snapdragon X Elite and describes the launch.'
  }))).toBe(false)
  expect(heldDocument(item({
    title: 'Video',
    origin: 'member',
    url: '/topic-videos/a.mp4',
    video: '/topic-videos/a.mp4',
    quote: 'Video added to this question.'
  }))).toBe(false)
})

test('the brief puts the held document ahead of the web page', () => {
  const brief = brainBrief([
    item({
      title: 'News',
      origin: 'search',
      url: 'https://example.com/story',
      question: 'Which chip',
      quote: 'A news page says the laptop chip is something else and describes a launch event in detail.'
    }),
    item({
      title: 'Filing',
      origin: 'member',
      url: '/topic-docs/a.pdf',
      question: 'Which chip',
      quote: 'Open the file to read it.',
      body: 'The uploaded filing says the laptop chip is Snapdragon X Elite and describes the cores.'
    })
  ], 'laptop chip')
  expect(brief.indexOf('HELD RECORD')).toBeLessThan(brief.indexOf('REST OF THE GROUP'))
  expect(brief.indexOf('Snapdragon X Elite')).toBeLessThan(brief.indexOf('something else'))
})

test('a line late in a saved document is included when the question asks about it', () => {
  const opening = 'The project was established to promote American global leadership and a strong military. '.repeat(30)
  const late = 'The process of transformation is likely to be a long one, absent some catastrophic and catalyzing event like a new Pearl Harbor.'
  const found = passages(`${opening} ${late}`, 'Pearl Harbor', 1800)
  expect(found).toContain('new Pearl Harbor')
})

test('the group brief includes the whole saved document', () => {
  const late = 'A catalyzing event like a new Pearl Harbor appears late in the report.'
  const body = `${'The opening describes American global leadership and the project directors. '.repeat(20)} ${late}`
  const brief = brainBrief([
    item({
      title: 'Rebuilding',
      origin: 'member',
      url: '/topic-docs/a.pdf',
      question: 'Role',
      quote: 'Open the file to read it.',
      body
    })
  ], 'something unrelated')
  expect(brief).toContain('American global leadership')
  expect(brief).toContain('new Pearl Harbor')
})

test('a question bot reads that question before the rest of the group', () => {
  const brief = brainBrief([
    item({
      title: 'Other report',
      origin: 'member',
      url: '/topic-docs/b.pdf',
      question: 'Other question',
      quote: 'Open the file to read it.',
      body: 'OTHER DOCUMENT belongs to a different question and is long enough to count as saved text.'
    }),
    item({
      title: 'This report',
      origin: 'member',
      url: '/topic-docs/a.pdf',
      question: 'This question',
      quote: 'Open the file to read it.',
      body: 'THIS QUESTION START is the full text that belongs on the question being asked.'
    })
  ], 'ask', 'This question')
  expect(brief.indexOf('THIS QUESTION START')).toBeLessThan(brief.indexOf('OTHER DOCUMENT'))
})

test('a full shelf starts another shelf without cutting a document', () => {
  const body = (letter: string) => `${letter.repeat(80)} saved document text that has to stay together on one shelf.`
  const shelves = buildShelves([
    item({ title: 'One', origin: 'member', url: '/topic-docs/a.pdf', quote: 'Open the file to read it.', body: body('A') }),
    item({ title: 'Two', origin: 'member', url: '/topic-docs/b.pdf', quote: 'Open the file to read it.', body: body('B') }),
    item({ title: 'Three', origin: 'member', url: '/topic-docs/c.pdf', quote: 'Open the file to read it.', body: body('C') })
  ], '', 280)
  expect(shelves.length).toBeGreaterThan(1)
  expect(shelves.join('\n')).toContain(body('A'))
  expect(shelves.join('\n')).toContain(body('C'))
  expect(shelves[0].startsWith('SHELF 1 OF')).toBe(true)
  for (const shelf of shelves) {
    if (shelf.includes('AAAA')) expect(shelf).toContain(body('A'))
    if (shelf.includes('BBBB')) expect(shelf).toContain(body('B'))
    if (shelf.includes('CCCC')) expect(shelf).toContain(body('C'))
  }
})

test('shelves stop when the documents run out', () => {
  expect(buildShelves([])).toEqual([])
  const one = buildShelves([
    item({
      title: 'Report',
      origin: 'member',
      url: '/topic-docs/a.pdf',
      quote: 'Open the file to read it.',
      body: 'x'.repeat(371579)
    })
  ])
  expect(one).toHaveLength(1)
  expect(one[0].startsWith('SHELF 1 OF 1.')).toBe(true)

  const chunk = 'y'.repeat(900_000)
  const shelves = buildShelves([1, 2, 3, 4, 5].map((n) => item({
    title: `Doc ${n}`,
    origin: 'member',
    url: `/topic-docs/${n}.pdf`,
    quote: 'Open the file to read it.',
    body: `${chunk} end-${n}`
  })))
  expect(shelves).toHaveLength(3)
  expect(shelves[0].startsWith('SHELF 1 OF 3.')).toBe(true)
  expect(shelves[2].startsWith('SHELF 3 OF 3.')).toBe(true)
  const joined = shelves.join('\n')
  for (const n of [1, 2, 3, 4, 5]) expect(joined).toContain(`end-${n}`)
  for (const shelf of shelves) expect(shelf.length).toBeLessThan(2_050_000)
})

test('a document larger than a shelf finishes and stays in order', () => {
  const shelves = buildShelves([
    item({
      title: 'Long',
      origin: 'member',
      url: '/topic-docs/long.pdf',
      quote: 'Open the file to read it.',
      body: `${'word '.repeat(400)}TAIL`
    })
  ], '', 500)
  expect(shelves.length).toBeGreaterThan(1)
  expect(shelves[0].startsWith(`SHELF 1 OF ${shelves.length}.`)).toBe(true)
  expect(shelves.join('\n')).toContain('TAIL')
})

test('a saved transcript is held and a saved web page is not', () => {
  const items = postKnowledge(
    'The story is here https://example.com/chip and it names a different processor than the filing.',
    'The speaker said the laptop chip on the table is Snapdragon X Elite and described the cores.',
    'Which chip'
  )
  expect(items.map((entry) => heldDocument(entry))).toEqual([true, false])
})
