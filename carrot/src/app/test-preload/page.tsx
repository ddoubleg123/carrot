import React from "react";
import LivePreloadClient from './LivePreloadClient';

export const dynamic = 'force-dynamic';

export default function Page({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  const limit = typeof searchParams?.limit === 'string' ? parseInt(searchParams.limit, 10) : 20;
  return <LivePreloadClient limit={isFinite(limit) && limit > 0 ? limit : 20} />;
}
