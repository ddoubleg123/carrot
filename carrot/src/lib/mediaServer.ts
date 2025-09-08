import prisma from '@/lib/prisma';

export type MediaType = 'image' | 'video' | 'gif' | 'audio';

export type MediaAssetDTO = {
  id: string;
  userId: string;
  type: MediaType;
  url: string;
  storagePath?: string | null;
  thumbUrl?: string | null;
  thumbPath?: string | null;
  title?: string | null;
  hidden: boolean;
  source?: string | null;
  durationSec?: number | null;
  width?: number | null;
  height?: number | null;
  inUseCount: number;
  cfUid?: string | null;
  cfStatus?: string | null;
  createdAt: string;
  updatedAt: string;
  labels?: string[];
};

export type MediaQuery = {
  userId: string;
  q?: string;
  includeHidden?: boolean;
  type?: MediaType | 'any';
  sort?: 'newest' | 'oldest' | 'az' | 'duration';
  limit?: number;
};

export async function listMedia(opts: MediaQuery): Promise<MediaAssetDTO[]> {
  const includeHidden = !!opts.includeHidden;
  const wantType = opts.type && opts.type !== 'any' ? opts.type : undefined;
  const q = (opts.q || '').trim();

  // Parse label operator: #tag or label:tag
  const labelMatch = q.match(/(?:#|label:)([\w-]+)/i);
  const text = q.replace(/(?:#|label:)([\w-]+)/gi, '').trim();

  // Use a relaxed type here to avoid compile errors if Prisma client hasn't been regenerated yet
  const where: any = {
    userId: opts.userId,
    ...(includeHidden ? {} : { hidden: false }),
    ...(wantType ? { type: wantType } : {}),
    ...(text
      ? {
          OR: [
            { title: { contains: text, mode: 'insensitive' } },
            { url: { contains: text, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(labelMatch
      ? {
          labels: {
            some: { label: { name: { equals: labelMatch[1], mode: 'insensitive' }, userId: opts.userId } },
          },
        }
      : {}),
  };

  const orderBy =
    opts.sort === 'oldest'
      ? { createdAt: 'asc' as const }
      : opts.sort === 'az'
      ? [{ title: 'asc' as const }, { createdAt: 'desc' as const }]
      : opts.sort === 'duration'
      ? [{ durationSec: 'desc' as const }, { createdAt: 'desc' as const }]
      : { createdAt: 'desc' as const };

  const rows = await (prisma as any).mediaAsset.findMany({
    where,
    orderBy: Array.isArray(orderBy) ? orderBy : [orderBy],
    take: opts.limit ?? 60,
    include: { labels: { include: { label: true } } },
  });

  const deriveStoragePath = (u?: string | null): string | undefined => {
    if (!u) return undefined;
    try {
      // Match Firebase Storage public URL forms: .../o/<ENCODED_PATH>?...
      const m = u.match(/\/o\/([^?]+)(?:\?|$)/);
      if (m && m[1]) return decodeURIComponent(m[1]);
    } catch {}
    return undefined;
  };

  return rows.map((r: any) => {
    const derivedThumbPath = r.thumbPath || deriveStoragePath(r.thumbUrl);
    const derivedStoragePath = r.storagePath || deriveStoragePath(r.url);
    return {
      id: r.id,
      userId: r.userId,
      type: r.type as MediaType,
      url: r.url,
      storagePath: derivedStoragePath,
      thumbUrl: r.thumbUrl,
      thumbPath: derivedThumbPath,
      title: r.title,
      hidden: r.hidden,
      source: r.source,
      durationSec: r.durationSec ?? undefined,
      width: r.width ?? undefined,
      height: r.height ?? undefined,
      inUseCount: r.inUseCount,
      cfUid: r.cfUid,
      cfStatus: r.cfStatus,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      labels: r.labels?.map((l: any) => l.label.name) ?? [],
    } as MediaAssetDTO;
  });
}

export async function createMedia(params: {
  userId: string;
  type: MediaType;
  url: string;
  storagePath?: string | null;
  thumbUrl?: string | null;
  thumbPath?: string | null;
  title?: string | null;
  hidden?: boolean;
  source?: string | null;
  durationSec?: number | null;
  width?: number | null;
  height?: number | null;
  cfUid?: string | null;
  cfStatus?: string | null;
  labels?: string[];
}) {
  const asset = await (prisma as any).mediaAsset.create({
    data: {
      userId: params.userId,
      type: params.type,
      url: params.url,
      storagePath: params.storagePath ?? null,
      thumbUrl: params.thumbUrl ?? null,
      thumbPath: params.thumbPath ?? null,
      title: params.title ?? null,
      hidden: !!params.hidden,
      source: params.source ?? null,
      durationSec: params.durationSec ?? null,
      width: params.width ?? null,
      height: params.height ?? null,
      cfUid: params.cfUid ?? null,
      cfStatus: params.cfStatus ?? null,
      labels: params.labels && params.labels.length
        ? {
            create: await ensureLabels(params.userId, params.labels).then((ids) => ids.map((labelId) => ({ labelId }))),
          }
        : undefined,
    },
  });
  return asset;
}

export async function updateMedia(id: string, patch: {
  title?: string | null;
  hidden?: boolean;
  labels?: string[];
}) {
  const data: any = {};
  if (typeof patch.title !== 'undefined') data.title = patch.title ?? null;
  if (typeof patch.hidden !== 'undefined') data.hidden = patch.hidden;
  if (patch.labels) {
    // replace labels
    data.labels = {
      deleteMany: {},
      create: await ensureLabelsForAsset(id, patch.labels).then((ids) => ids.map((labelId) => ({ labelId }))),
    } as any;
  }
  return (prisma as any).mediaAsset.update({ where: { id }, data });
}

async function ensureLabels(userId: string, names: string[]): Promise<string[]> {
  const unique = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)));
  const existing = await (prisma as any).mediaLabel.findMany({ where: { userId, name: { in: unique } } });
  const existingNames = new Set(existing.map((e: any) => e.name));
  const toCreate = unique.filter((n) => !existingNames.has(n));
  if (toCreate.length) {
    await (prisma as any).mediaLabel.createMany({ data: toCreate.map((name) => ({ userId, name })) });
  }
  const all = await (prisma as any).mediaLabel.findMany({ where: { userId, name: { in: unique } } });
  return all.map((l: any) => l.id);
}

async function ensureLabelsForAsset(assetId: string, names: string[]): Promise<string[]> {
  const asset = await (prisma as any).mediaAsset.findUnique({ where: { id: assetId } });
  if (!asset) return [];
  return ensureLabels(asset.userId, names);
}
