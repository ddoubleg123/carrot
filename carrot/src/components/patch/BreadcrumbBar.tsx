'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function BreadcrumbBar() {
  const router = useRouter();

  const handleBack = () => {
    router.push('/patch');
  };

  return (
        <div className="h-10 flex items-center px-4 md:px-6 text-slate-700 bg-white border-b border-[#E6E8EC] sticky top-0 z-50 shadow-sm">
      <button
        onClick={handleBack}
        className="flex items-center gap-2 text-sm hover:text-[#FF6A00] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Carrot Patch
      </button>
    </div>
  );
}
