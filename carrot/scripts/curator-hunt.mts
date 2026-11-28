import { runCurator } from '../src/lib/curator/hunt'

try {
  const hunt = await runCurator({
    deskIds: ['science', 'history', 'world', 'technology'],
    maxKeep: 1,
    channels: 2,
    videosPerChannel: 2,
    articles: 1
  })
  for (const desk of hunt.desks) {
    console.log(`\n${desk.name}`)
    console.log(`  looked: ${desk.looked.join(' | ') || 'none'}`)
    for (const drop of desk.dropped) console.log(`  drop: ${drop.title} — ${drop.reason}`)
    for (const kept of desk.kept) console.log(`  KEEP: ${kept.title} -> ${kept.topicUrl}`)
  }
} catch (error) {
  console.error(error)
  process.exit(1)
}

process.exit(0)
