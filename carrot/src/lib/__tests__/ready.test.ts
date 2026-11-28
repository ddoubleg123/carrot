import { readyLink, readyTitle, readyType } from '../curator/ready'

describe('ready inventory', () => {
  it('sorts a saved post into the column a person can open', () => {
    expect(readyType({ audioUrl: 'https://example.com/a.mp3', videoUrl: 'https://example.com/v.mp4' })).toBe('audio')
    expect(readyType({ videoUrl: '/api/video?path=clip', content: 'https://www.youtube.com/watch?v=abc' })).toBe('clip')
    expect(readyType({ content: 'kind: quote\nsource: BBC\n\nThe sentence itself.' })).toBe('image')
    expect(readyType({ content: 'A talk.\nhttps://www.youtube.com/watch?v=abc' })).toBe('video')
    expect(readyType({ content: 'A page.\nhttps://www.haaretz.com/story' })).toBe('article')
    expect(readyType({ content: 'A note with no link.' })).toBe('text')
    expect(readyTitle('kind: quote\nsource: BBC\n\nThe sentence itself.')).toBe('The sentence itself.')
    expect(readyLink('Note\nhttps://firebasestorage.googleapis.com/v0/b/x/o/y?alt=media&token=secret')).toBe('https://firebasestorage.googleapis.com/v0/b/x/o/y')
  })
})
