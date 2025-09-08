export const formatDuration = (s?: number | null) => {
  if (!s || s < 0) return "";
  const total = Math.floor(s);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const r = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  return m ? `${m}:${String(r).padStart(2, "0")}` : `${r}s`;
};
