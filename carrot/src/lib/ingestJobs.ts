// Persistent ingest job storage using Prisma database
// Each job represents an external media ingestion task (e.g., YouTube URL -> MP4 -> Storage).

import { PrismaClient } from '@prisma/client';

export type IngestSourceType = 'youtube' | 'x' | 'facebook' | 'reddit' | 'tiktok';

export type IngestJobStatus =
  | 'queued'
  | 'downloading'
  | 'processing'
  | 'transcoding'
  | 'uploading'
  | 'completed'
  | 'failed';

export interface IngestJob {
  id: string;
  createdAt: number;
  updatedAt: number;
  userId?: string | null;
  postId?: string | null;
  sourceUrl: string;
  sourceType: IngestSourceType;
  status: IngestJobStatus;
  progress?: number;
  error?: string;
  mediaUrl?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  cfUid?: string | null;
  cfStatus?: string | null;
  durationSec?: number;
  width?: number;
  height?: number;
  title?: string;
  channel?: string;
}

// Initialize Prisma client with better error handling
let prisma: PrismaClient;

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

try {
  const g = globalThis as typeof globalThis & { __prisma?: PrismaClient };
  prisma = g.__prisma || new PrismaClient({
    log: ['error', 'warn'],
  });
  
  if (process.env.NODE_ENV !== 'production') {
    g.__prisma = prisma;
  }
} catch (error) {
  console.error('Failed to initialize Prisma client:', error);
  throw new Error('Database connection failed');
}

// Verify database connection on startup
async function verifyDatabaseConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('Database connection verified');
  } catch (error) {
    console.error('Database connection error:', error);
    throw new Error('Database connection failed');
  }
}

// Call verify on import to fail fast
verifyDatabaseConnection().catch(console.error);

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
  
    return mapPrismaJobToIngestJob(job);
  } catch (error) {
    console.error('Failed to create job:', error);
    throw new Error(`Failed to create job: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getJob(id: string) {
  try {
    const job = await prisma.ingestJob.findUnique({ 
      where: { id }
    });
    
    if (!job) return null;
    return mapPrismaJobToIngestJob(job);
  } catch (error) {
    console.error(`Failed to get job ${id}:`, error);
    throw new Error(`Failed to get job: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function updateJob(id: string, patch: Partial<IngestJob>) {
  try {
    const updateData: any = {};
    if (patch.status !== undefined) updateData.status = patch.status;
    if (patch.progress !== undefined) updateData.progress = patch.progress;
    if (patch.error !== undefined) updateData.error = patch.error;
    if (patch.mediaUrl !== undefined) updateData.mediaUrl = patch.mediaUrl;
    if (patch.videoUrl !== undefined) updateData.videoUrl = patch.videoUrl;
    if (patch.thumbnailUrl !== undefined) updateData.thumbnailUrl = patch.thumbnailUrl;
    if (patch.title !== undefined) updateData.title = patch.title;
    if (patch.channel !== undefined) updateData.channel = patch.channel;
    if (patch.cfUid !== undefined) updateData.cfUid = patch.cfUid;
    if (patch.cfStatus !== undefined) updateData.cfStatus = patch.cfStatus;
    if (patch.durationSec !== undefined) updateData.durationSec = patch.durationSec;
    if (patch.width !== undefined) updateData.width = patch.width;
    if (patch.height !== undefined) updateData.height = patch.height;

    const job = await prisma.ingestJob.update({
      where: { id },
      data: updateData
    });

    return mapPrismaJobToIngestJob(job);
  } catch (error) {
    console.error(`Failed to update job ${id}:`, error);
    throw new Error(`Failed to update job: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Helper function to map Prisma job to IngestJob interface
function mapPrismaJobToIngestJob(job: any): IngestJob {
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
    videoUrl: job.videoUrl ?? undefined,
    thumbnailUrl: job.thumbnailUrl ?? undefined,
    cfUid: job.cfUid ?? undefined,
    cfStatus: job.cfStatus ?? undefined,
    durationSec: job.durationSec ?? undefined,
    width: job.width ?? undefined,
    height: job.height ?? undefined,
    title: job.title ?? undefined,
    channel: job.channel ?? undefined,
  };
}

export async function listJobs() {
  try {
    const jobs = await prisma.ingestJob.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    return jobs.map(mapPrismaJobToIngestJob);
  } catch (error) {
    console.error('Failed to list jobs:', error);
    throw new Error(`Failed to list jobs: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
