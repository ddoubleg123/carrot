import Redis from 'ioredis'

async function main() {
  const handle = process.argv[2]
  if (!handle) {
    console.error('Usage: tsx scripts/force-stop-patch.ts <patch-handle>')
    process.exit(1)
  }
  const url = process.env.REDIS_URL
  if (!url) {
    console.error('REDIS_URL not set')
    process.exit(1)
  }
  const parsed = new URL(url)
  const client = new Redis({
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : undefined,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    tls: parsed.protocol === 'rediss:' ? { rejectUnauthorized: false, servername: parsed.hostname } : undefined
  })
  try {
    const key = 'discovery:v2:force_stop_patches'
    await client.sadd(key, handle)
    const members = await client.smembers(key)
    console.log(JSON.stringify({ ok: true, key, members }, null, 2))
  } finally {
    client.disconnect()
  }
}

main().catch((err) => {
  console.error(err?.message || err)
  process.exit(1)
})


