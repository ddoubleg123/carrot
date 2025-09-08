import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import * as React from "react";

export type MinimalSearchProps = React.InputHTMLAttributes<HTMLInputElement> & {
  onHotkey?: () => void;
};

export function MinimalSearch({ onHotkey, className, ...props }: MinimalSearchProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (onHotkey) onHotkey();
        // Attempt to focus the input if present
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onHotkey]);

  return (
    <div className={`relative ${className ?? ""}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#60646C]" />
      <Input
        ref={inputRef}
        aria-label="Search media"
        placeholder="Search title or #label"
        className="h-10 w-full rounded-xl pl-9 pr-16"
        {...props}
      />
      <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-[#E6E8EC] bg-[#F7F8FA] px-1.5 py-0.5 text-[11px] text-[#60646C]">
        ⌘/Ctrl K
      </kbd>
    </div>
  );
}
