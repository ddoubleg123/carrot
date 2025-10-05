"use client";
import CarrotLogo from "../CarrotLogo";

export default function CarrotSpinner({ label = "Loading...", size = 28 }: { label?: string; size?: number }) {
  return (
    <div className="flex items-center justify-center gap-3 text-gray-600">
      <div className="relative" style={{ width: size, height: size }}>
        <CarrotLogo size={size} className="opacity-80" />
        {/* subtle pulse ring */}
        <span className="absolute inset-0 rounded-full animate-ping pointer-events-none" style={{ boxShadow: "0 0 0 2px rgba(251,146,60,0.25)", borderRadius: "9999px" }} />
      </div>
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}
