import React from "react";
import LivePreloadClient from './LivePreloadClient.tsx';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const params = await searchParams;
  const limit = typeof params?.limit === 'string' ? parseInt(params.limit, 10) : 20;
  return <LivePreloadClient limit={isFinite(limit) && limit > 0 ? limit : 20} />;
}
