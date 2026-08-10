"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type DrawerContextValue = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const DrawerContext = createContext<DrawerContextValue | null>(null);

function useDrawer() {
  const context = useContext(DrawerContext);
  if (!context) throw new Error("Drawer deve ser usado dentro de Drawer.");
  return context;
}

export function Drawer({
  open,
  onOpenChange,
  children,
}: DrawerContextValue & { children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, onOpenChange]);

  return (
    <DrawerContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DrawerContext.Provider>
  );
}

export function DrawerTrigger({
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { onOpenChange } = useDrawer();
  return (
    <button
      type="button"
      className={className}
      onClick={() => onOpenChange(true)}
      {...props}
    >
      {children}
    </button>
  );
}

export function DrawerContent({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  const { open, onOpenChange } = useDrawer();
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }

    setVisible(false);
    const timer = window.setTimeout(() => setMounted(false), 760);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-[80] overflow-hidden" role="presentation">
      <button
        type="button"
        aria-label="Fechar painel"
        className={cn(
          "absolute inset-0 bg-zinc-900/35 backdrop-blur-md transition-opacity duration-700 ease-out motion-reduce:transition-none",
          visible ? "opacity-100" : "opacity-0",
        )}
        onClick={() => onOpenChange(false)}
      />
      <section
        role="dialog"
        aria-modal="true"
        className={cn(
          "absolute bottom-4 left-4 top-4 flex w-[min(calc(100vw-2rem),440px)] flex-col overflow-hidden rounded-[28px] border border-white/80 bg-white/95 shadow-[0_28px_80px_rgba(9,9,11,0.28)] transition-[transform,opacity] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          visible
            ? "translate-x-0 opacity-100"
            : "-translate-x-[calc(100%+2rem)] opacity-70",
          className,
        )}
        {...props}
      >
        <button
          type="button"
          aria-label="Fechar"
          className="absolute right-4 top-4 z-10 inline-flex size-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950"
          onClick={() => onOpenChange(false)}
        >
          <X size={17} />
        </button>
        {children}
        <div className="border-t border-zinc-200/80 bg-white/95 px-5 py-4">
          <button
            type="button"
            className="flex h-10 w-full items-center justify-center rounded-full bg-zinc-950 text-sm font-semibold text-white transition hover:bg-zinc-800"
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </button>
        </div>
      </section>
    </div>
  );
}

export function DrawerHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("border-b border-zinc-200 px-6 py-5 pr-16", className)}
      {...props}
    />
  );
}

export function DrawerTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn("text-lg font-bold text-zinc-950", className)} {...props} />
  );
}

export function DrawerDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("mt-1 text-sm leading-6 text-zinc-500", className)} {...props} />
  );
}
