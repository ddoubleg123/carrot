import CarrotLogo from '../components/CarrotLogo';

export default function GlobalLoading() {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-white/60 dark:bg-black/40">
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/90 shadow border border-orange-100">
        <div className="relative w-7 h-7">
          <CarrotLogo size={28} className="opacity-90" />
          <span className="absolute inset-0 rounded-full animate-ping pointer-events-none" style={{ boxShadow: "0 0 0 2px rgba(251,146,60,0.25)", borderRadius: "9999px" }} />
        </div>
        <span className="text-sm font-medium text-gray-700">Loading…</span>
      </div>
    </div>
  );
}
