import { ShieldCheck } from "lucide-react";

export function AppFooter() {
  return (
    <footer className="mt-auto shrink-0 border-t border-zinc-200/70 bg-white/65 px-4 py-3 text-[10px] text-zinc-400 backdrop-blur-sm sm:px-7">
      <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-4">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck size={12} className="text-emerald-700" />
          Ambiente institucional protegido
        </span>
        <span>aux automação - 2026</span>
      </div>
    </footer>
  );
}
