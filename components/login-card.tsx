"use client";

import {
  DraftingCompass,
  FileCheck2,
  FolderKanban,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const modules = [
  {
    title: "Croqui urbano",
    description: "Interpretação, revisão e desenho técnico do imóvel.",
    icon: DraftingCompass,
    className: "border-emerald-200/80 bg-emerald-50/[0.85]",
    iconClassName: "bg-emerald-100 text-emerald-900",
  },
  {
    title: "Informações topográficas",
    description: "Documento padronizado a partir do croqui aprovado.",
    icon: FileCheck2,
    className: "border-zinc-200 bg-white/[0.85]",
    iconClassName: "bg-zinc-100 text-zinc-900",
  },
  {
    title: "Gestão de processos",
    description: "Histórico, acompanhamento e organização dos trabalhos.",
    icon: FolderKanban,
    className: "border-stone-200 bg-stone-100/80",
    iconClassName: "bg-white text-zinc-900",
  },
];

export function LoginCard({ error }: { error?: string }) {
  const [loading, setLoading] = useState(false);

  async function enterWithGoogle() {
    setLoading(true);
    try {
      await signIn("google", { callbackUrl: "/" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[linear-gradient(135deg,#dcfce7_0%,#f4f4f5_46%,#ffffff_100%)] px-4 py-7 font-sans text-zinc-950 sm:px-7 lg:grid lg:place-items-center lg:py-10">
      <div
        aria-hidden="true"
        className="absolute -left-32 -top-36 -z-10 h-[28rem] w-[28rem] rounded-full bg-emerald-200/[0.45] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-52 right-[-8rem] -z-10 h-[34rem] w-[34rem] rounded-full bg-white/90 blur-3xl"
      />

      <div className="mx-auto grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.08fr_0.82fr] lg:gap-14">
        <section className="order-2 px-1 pb-5 lg:order-1 lg:px-0 lg:pb-0">
          <div className="mb-8 inline-flex items-center rounded-2xl border border-white/80 bg-white/70 px-5 py-4 shadow-sm backdrop-blur-xl">
            <Image
              src="/assets/logo-semobi.png"
              alt="SEMOBI — Secretaria Municipal de Obras e Infraestrutura"
              width={846}
              height={258}
              priority
              className="h-auto w-48 sm:w-56"
            />
          </div>

          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-900/10 bg-emerald-950 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white">
              <ShieldCheck size={14} />
              Plataforma institucional
            </div>
            <h1 className="max-w-xl font-sans text-4xl font-semibold leading-[1.06] tracking-[-0.045em] text-zinc-950 sm:text-5xl lg:text-[3.45rem]">
              Gestão técnica, do desenho ao documento.
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-zinc-600 sm:text-base">
              Ambiente integrado da Secretaria Municipal de Obras e
              Infraestrutura de Coelho Neto para produzir, revisar e organizar
              documentos dos imóveis.
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {modules.map((module) => {
              const Icon = module.icon;
              return (
                <Card
                  key={module.title}
                  className={`min-h-40 p-4 shadow-none backdrop-blur-md transition-transform duration-200 hover:-translate-y-1 ${module.className}`}
                >
                  <div
                    className={`mb-5 grid h-10 w-10 place-items-center rounded-xl ${module.iconClassName}`}
                  >
                    <Icon size={19} strokeWidth={1.8} />
                  </div>
                  <h2 className="font-sans text-sm font-semibold tracking-tight text-zinc-950">
                    {module.title}
                  </h2>
                  <p className="mt-2 text-xs leading-5 text-zinc-600">
                    {module.description}
                  </p>
                </Card>
              );
            })}
          </div>
        </section>

        <Card className="order-1 w-full max-w-md justify-self-center overflow-hidden border-white/90 bg-white/[0.88] shadow-[0_30px_90px_rgba(24,24,27,0.13)] backdrop-blur-xl lg:order-2 lg:justify-self-end">
          <div className="h-1.5 bg-[linear-gradient(90deg,#052e16_0%,#86efac_50%,#e4e4e7_100%)]" />
          <CardHeader className="px-6 pb-0 pt-7 sm:px-9 sm:pt-9">
            <div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-zinc-950 text-white shadow-lg shadow-zinc-950/15">
              <LockKeyhole size={22} strokeWidth={1.8} />
            </div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-800">
              Acesso institucional
            </p>
            <CardTitle className="text-3xl sm:text-[2rem]">
              Entre para continuar
            </CardTitle>
            <CardDescription className="max-w-sm">
              Use a conta Google autorizada pela Secretaria Municipal de Obras
              e Infraestrutura.
            </CardDescription>
          </CardHeader>

          <CardContent className="px-6 pt-6 sm:px-9">
            {error ? (
              <div
                className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-5 text-red-800"
                role="alert"
              >
                Esta conta não está autorizada. Solicite acesso ao
                administrador.
              </div>
            ) : null}

            <Button
              className="w-full shadow-lg shadow-zinc-950/15"
              size="lg"
              onClick={enterWithGoogle}
              disabled={loading}
            >
              {loading ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <span className="grid h-6 w-6 place-items-center rounded-full bg-white font-sans text-xs font-black text-zinc-950">
                  G
                </span>
              )}
              {loading ? "Abrindo o Google..." : "Entrar com Google"}
            </Button>
          </CardContent>

          <CardFooter className="mx-6 mt-6 gap-2 border-t border-zinc-100 px-0 py-5 text-[11px] leading-5 text-zinc-500 sm:mx-9">
            <ShieldCheck className="shrink-0 text-emerald-700" size={16} />
            Acesso protegido e restrito aos servidores autorizados.
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
