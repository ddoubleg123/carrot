import { prisma } from '@/lib/prisma'

type StandingRow = {
  below: number
  peers: number
}

export async function peerStanding(userId: string): Promise<{ ahead: number | null; peers: number }> {
  const rows = await prisma.$queryRaw<StandingRow[]>`
    WITH people AS (
      SELECT id
      FROM "User"
      WHERE email IS NULL OR email NOT LIKE '%@bots.carrot.invalid'
    ),
    post_scores AS (
      SELECT "userId" AS user_id,
        SUM(
          COALESCE((substring("carrotText" from '^-?[0-9]+'))::int, 0)
          - COALESCE((substring("stickText" from '^-?[0-9]+'))::int, 0)
        ) AS n
      FROM posts
      GROUP BY "userId"
    ),
    like_n AS (
      SELECT user_id, COUNT(*)::int AS n FROM post_likes GROUP BY user_id
    ),
    comment_n AS (
      SELECT user_id, COUNT(*)::int AS n FROM comments GROUP BY user_id
    ),
    save_n AS (
      SELECT user_id, COUNT(*)::int AS n FROM post_saves GROUP BY user_id
    ),
    patch_n AS (
      SELECT user_id, COUNT(*)::int AS n FROM patch_members GROUP BY user_id
    ),
    scores AS (
      SELECT p.id,
        GREATEST(
          0,
          COALESCE(ps.n, 0) + FLOOR(
            COALESCE(l.n, 0) / 10.0
            + COALESCE(c.n, 0) / 5.0
            + COALESCE(s.n, 0) / 3.0
            + COALESCE(pm.n, 0) * 2
          )
        )::int AS carrots
      FROM people p
      LEFT JOIN post_scores ps ON ps.user_id = p.id
      LEFT JOIN like_n l ON l.user_id = p.id
      LEFT JOIN comment_n c ON c.user_id = p.id
      LEFT JOIN save_n s ON s.user_id = p.id
      LEFT JOIN patch_n pm ON pm.user_id = p.id
    )
    SELECT
      COUNT(*) FILTER (WHERE scores.id <> ${userId} AND scores.carrots < mine.carrots)::int AS below,
      COUNT(*) FILTER (WHERE scores.id <> ${userId})::int AS peers
    FROM scores
    CROSS JOIN (SELECT carrots FROM scores WHERE id = ${userId}) AS mine
  `
  const row = rows[0]
  const peers = Number(row?.peers ?? 0)
  const below = Number(row?.below ?? 0)
  if (!peers) return { ahead: null, peers: 0 }
  return { ahead: Math.round((below / peers) * 100), peers }
}
