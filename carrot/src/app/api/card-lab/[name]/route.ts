import { readFile, readdir } from 'fs/promises'
import path from 'path'
import { NextResponse } from 'next/server'

const NAME = /^[a-z0-9-]+__[a-z]+__p\d+\.png$/

const ROOTS = [
  path.join(process.cwd(), 'quote-review', 'kit', 'kit', 'build', 'cards'),
  path.join(process.cwd(), 'public', 'quote-cards'),
]

async function readCard(name: string) {
  for (const root of ROOTS) {
    try {
      return await readFile(path.join(root, name))
    } catch {
      /* look one folder down */
    }
    try {
      const folders = await readdir(root)
      for (const folder of folders) {
        try {
          return await readFile(path.join(root, folder, name))
        } catch {
          /* next folder */
        }
      }
    } catch {
      /* root missing */
    }
  }
  return null
}

export async function GET(_request: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params
  if (!NAME.test(name)) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const file = await readCard(name)
  if (!file) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return new NextResponse(file, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store',
    },
  })
}
