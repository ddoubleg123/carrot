import { articleExplanation, plainAccount, saysSomething } from '../curator/meaning'
import { feedVisible } from '../feedTimeline'

const MAP = `She drew the ocean floor before anyone had seen it, just ink lines where the bottom should be, and people said that's a woman's hand moving, not a real contour. But the line held. It kept showing up in the same place.

The record says the drawing was the argument before anyone could go down and check. The blank beside it was still a guess, and she was clear about that, a little amazed too.

That's the part that stays with me. The line was the proof and the blank was the honest part, both at once.`

const COUNCIL = `The thing about the Security Council vote on Friday is that it comes down to one country and one frontrunner, and that's the whole story. Costa Rica's candidate is the one to watch, and whether they get blocked is the only question that matters in that room.

The Council votes Friday on the UN secretary general race, and the frontrunner from Costa Rica is the one who could get stopped.

Then it's right back to the same fight over the P5 veto and whether five countries should decide who leads the whole organization.`

describe('a post has to say what happened', () => {
  it('rejects a scene that never names anyone', () => {
    expect(plainAccount(MAP)).toBe('')
    expect(saysSomething(MAP)).toBe(false)
  })

  it('keeps the sentence that names the vote and drops the mood', () => {
    expect(plainAccount(COUNCIL)).toBe('The Council votes Friday on the UN secretary general race, and the frontrunner from Costa Rica is the one who could get stopped. Then it\'s right back to the same fight over the P5 veto and whether five countries should decide who leads the whole organization.')
  })

  it('uses the headline when the note says nothing', () => {
    expect(articleExplanation(MAP, 'Race to be next UN secretary general exposes divisions among world powers')).toBe('Race to be next UN secretary general exposes divisions among world powers.')
  })

  it('drops a desk text post that names nobody and keeps an article', () => {
    const posts = [
      { id: 'map', content: MAP, User: { username: 'maps-and-diagrams' }, bucket: 'ink-map' },
      { id: 'note', content: 'A normal note' },
      { id: 'story', content: `${COUNCIL}\nhttps://www.theguardian.com/world/x`, User: { username: 'jewish-history' } }
    ]
    expect(feedVisible(posts).map((post) => post.id)).toEqual(['note', 'story'])
  })
})
