import MinimalNav from '@/components/MinimalNav';

export default function AppLoading() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="hidden h-screen w-20 shrink-0 border-r border-gray-200 bg-gray-50 sm:block">
        <MinimalNav />
      </aside>
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-200 border-t-orange-500" aria-label="Opening" />
      </div>
    </div>
  );
}
