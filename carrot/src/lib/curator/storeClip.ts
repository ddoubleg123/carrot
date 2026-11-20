import path from 'path'

const BUCKET = 'involuted-river-466315-p0.firebasestorage.app'

function bucketName(): string {
  return process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || BUCKET
}

/** Keep a finished clip in cloud storage so playback survives a server restart. */
export async function storeClip(file: string): Promise<{ bucket: string; objectPath: string } | null> {
  if (!process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) return null
  const bucketId = bucketName()
  const objectPath = `clips/${path.basename(file)}`
  const { app } = await import('@/lib/firebase-admin')
  // firebase-admin is CommonJS
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const admin = require('firebase-admin')
  const bucket = admin.storage(app).bucket(bucketId)
  await bucket.upload(file, {
    destination: objectPath,
    metadata: { contentType: 'video/mp4', cacheControl: 'public, max-age=31536000' }
  })
  return { bucket: bucketId, objectPath }
}
