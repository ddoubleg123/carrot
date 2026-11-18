'use client';

import dynamic from 'next/dynamic';

const RabbitApp = dynamic(() => import('./RabbitApp'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-200 border-t-orange-500" aria-label="Opening Rabbit" />
    </div>
  )
});

export default function RabbitPage() {
  return <RabbitApp />;
}
