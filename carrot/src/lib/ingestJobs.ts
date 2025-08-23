// Persistent ingest job storage using Prisma database
// Each job represents an external media ingestion task (e.g., YouTube URL -> MP4 -> Storage).

import { PrismaClient } from '@prisma/client';

export type IngestSourceType = 'youtube' | 'x' | 'facebook' | 'reddit' | 'tiktok';

export type IngestJobStatus =
  | 'queued'
  | 'downloading'
  | 'transcoding'
  | 'uploading'
  | 'completed'
  | 'failed';

export interface IngestJob {
  id: string;
  createdAt: number;
  updatedAt: number;
  userId?: string | null;
  postId?: string | null; // optional: if you want to attach to a post immediately
  sourceUrl: string;
  sourceType: IngestSourceType;
  status: IngestJobStatus;
  progress?: number; // 0-100 (best-effort)
  error?: string;
  // Result
  mediaUrl?: string; // final uploaded MP4 URL in your bucket
  cfUid?: string | null; // Cloudflare Stream UID when uploaded there
  cfStatus?: string | null; // optional Cloudflare processing status
  durationSec?: number;
  width?: number;
  height?: number;
  title?: string;
  channel?: string;
}

// Use global prisma instance to avoid connection issues in serverless
declare global {
  var __prisma: PrismaClient | undefined;
}

const prisma = globalThis.__prisma ?? (globalThis.__prisma = new PrismaClient());

function genId() {
  return `ing_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function createJob(params: Omit<IngestJob, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { status?: IngestJobStatus }) {
  try {
    const id = genId();
    console.log('[createJob] Creating job with data:', {
      id,
      sourceUrl: params.sourceUrl,
      sourceType: params.sourceType,
      status: params.status ?? 'queued'
    });
    
    const job = await prisma.ingestJob.create({
      data: {
        id,
        sourceUrl: params.sourceUrl,
        sourceType: params.sourceType,
        status: params.status ?? 'queued',
        userId: params.userId ?? null,
        postId: params.postId ?? null,
        progress: 0,
      }
    });
    
    console.log('[createJob] Job created successfully:', job.id);
  
    return {
      id: job.id,
      createdAt: job.createdAt.getTime(),
      updatedAt: job.updatedAt.getTime(),
      sourceUrl: job.sourceUrl,
      sourceType: job.sourceType as IngestSourceType,
      status: job.status as IngestJobStatus,
      userId: job.userId,
      postId: job.postId,
      progress: job.progress ?? undefined,
      error: job.error ?? undefined,
      mediaUrl: job.mediaUrl ?? undefined,
      cfUid: job.cfUid ?? undefined,
      cfStatus: job.cfStatus ?? undefined,
      durationSec: job.durationSec ?? undefined,
      width: job.width ?? undefined,
      height: job.height ?? undefined,
      title: job.title ?? undefined,
      channel: job.channel ?? undefined,
    } as IngestJob;
  } catch (error) {
    console.error('Failed to create job:', error);
    throw error;
  }
}

export async function getJob(id: string) {
  const job = await prisma.ingestJob.findUnique({ where: { id } });
  if (!job) return null;
  
  return {
    id: job.id,
    createdAt: job.createdAt.getTime(),
    updatedAt: job.updatedAt.getTime(),
    sourceUrl: job.sourceUrl,
    sourceType: job.sourceType as IngestSourceType,
    status: job.status as IngestJobStatus,
    userId: job.userId,
    postId: job.postId,
    progress: job.progress ?? undefined,
    error: job.error ?? undefined,
    mediaUrl: job.mediaUrl ?? undefined,
    cfUid: job.cfUid ?? undefined,
    cfStatus: job.cfStatus ?? undefined,
    durationSec: job.durationSec ?? undefined,
    width: job.width ?? undefined,
    height: job.height ?? undefined,
    title: job.title ?? undefined,
    channel: job.channel ?? undefined,
  } as IngestJob;
}

export async function updateJob(id: string, patch: Partial<IngestJob>) {
  try {
    const updateData: any = {};
    if (patch.status !== undefined) updateData.status = patch.status;
    if (patch.progress !== undefined) updateData.progress = patch.progress;
    if (patch.error !== undefined) updateData.error = patch.error;
    if (patch.mediaUrl !== undefined) updateData.mediaUrl = patch.mediaUrl;
    if (patch.cfUid !== undefined) updateData.cfUid = patch.cfUid;
    if (patch.cfStatus !== undefined) updateData.cfStatus = patch.cfStatus;
    if (patch.durationSec !== undefined) updateData.durationSec = patch.durationSec;

    const job = await prisma.ingestJob.update({
      where: { id },
      data: updateData
    });

    return {
      id: job.id,
      createdAt: job.createdAt.getTime(),
      updatedAt: job.updatedAt.getTime(),
      sourceUrl: job.sourceUrl,
      sourceType: job.sourceType as IngestSourceType,
      status: job.status as IngestJobStatus,
      userId: job.userId,
      postId: job.postId,
      progress: job.progress ?? undefined,
      error: job.error ?? undefined,
      mediaUrl: job.mediaUrl ?? undefined,
      cfUid: job.cfUid ?? undefined,
      cfStatus: job.cfStatus ?? undefined,
      durationSec: job.durationSec ?? undefined,
      width: job.width ?? undefined,
      height: job.height ?? undefined,
      title: job.title ?? undefined,
      channel: job.channel ?? undefined,
    } as IngestJob;
  } catch (error) {
    console.error('Failed to update job:', error);
    return null;
  }
}

export async function listJobs() {
  const jobs = await prisma.ingestJob.findMany({
    orderBy: { createdAt: 'desc' }
  });
  
  return jobs.map(job => ({
    id: job.id,
    createdAt: job.createdAt.getTime(),
    updatedAt: job.updatedAt.getTime(),
    sourceUrl: job.sourceUrl,
    sourceType: job.sourceType as IngestSourceType,
    status: job.status as IngestJobStatus,
    userId: job.userId,
    postId: job.postId,
    progress: job.progress ?? undefined,
    error: job.error ?? undefined,
    mediaUrl: job.mediaUrl ?? undefined,
    cfUid: job.cfUid ?? undefined,
    cfStatus: job.cfStatus ?? undefined,
    durationSec: job.durationSec ?? undefined,
    width: job.width ?? undefined,
    height: job.height ?? undefined,
    title: job.title ?? undefined,
    channel: job.channel ?? undefined,
  } as IngestJob));
}
