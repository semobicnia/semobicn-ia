import { ArrowRight, FileCheck2, MapPinned, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";

export default function HomePage() {
  return (
    <main className="flex h-dvh flex-col overflow-hidden">
      <PublicHeader active="home" />

      <section className="relative isolate flex min-h-0 flex-1 items-center justify-center overflow-hidden px-5 py-6 text-center sm:px-8">
        <div
          aria-hidden="true"
          className="absolute left-[8%] top-[8%] -z-10 h-56 w-56 rounded-full bg-emerald-200/40 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute bottom-[-7rem] right-[8%] -z-10 h-72 w-72 rounded-full bg-white blur-3xl"
        />

        <div className="mx-auto flex max-w-3xl flex-col items-center">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-300 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-950 sm:text-[11px]">
            <ShieldCheck size={13} />
            Plataforma institucional
          </span>
          <h1 className="max-w-3xl font-sans text-[2.35rem] font-semibold leading-[0.98] tracking-[-0.055em] text-emerald-950 sm:text-6xl lg:text-7xl">
            Do desenho original ao documento técnico.
          </h1>
          <p className="mt-5 max-w-xl text-xs leading-5 text-zinc-500 sm:text-sm sm:leading-6">
            A SEMOBI utiliza inteligência artificial para apoiar a criação de
            croquis urbanos, a revisão dos dados e a emissão padronizada das
            Informações Topográficas.
          </p>

          <div className="mt-6 flex items-center gap-3">
            <Link
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-zinc-950 px-5 text-xs font-semibold text-white shadow-lg shadow-zinc-950/10 transition-colors hover:bg-zinc-800 sm:text-sm"
              href="/entrar"
            >
              Acessar sistema <ArrowRight size={15} />
            </Link>
            <Link
              className="inline-flex h-11 items-center rounded-xl border border-zinc-300 bg-white/70 px-5 text-xs font-semibold text-zinc-800 transition-colors hover:bg-white sm:text-sm"
              href="/cadastro"
            >
              Solicitar acesso
            </Link>
          </div>

          <div className="mt-7 hidden items-center gap-6 text-[11px] font-medium text-zinc-500 sm:flex">
            <span className="inline-flex items-center gap-1.5">
              <MapPinned size={14} className="text-emerald-800" /> Croqui urbano
            </span>
            <span className="h-3 w-px bg-zinc-300" />
            <span className="inline-flex items-center gap-1.5">
              <FileCheck2 size={14} className="text-emerald-800" /> Documentação
              padronizada
            </span>
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
