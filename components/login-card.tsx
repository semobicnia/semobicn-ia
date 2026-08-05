"use client";

import { LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
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

export function LoginCard({ error }: { error?: string }) {
  const [loading, setLoading] = useState(false);

  async function enterWithGoogle() {
    setLoading(true);
    try {
      await signIn("google", { callbackUrl: "/sistema" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="relative isolate grid min-h-0 flex-1 place-items-center overflow-x-hidden overflow-y-auto px-4 py-7 font-sans text-zinc-950">
      <div
        aria-hidden="true"
        className="absolute -left-32 -top-36 -z-10 h-[28rem] w-[28rem] rounded-full bg-emerald-200/[0.45] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-52 right-[-8rem] -z-10 h-[34rem] w-[34rem] rounded-full bg-white/90 blur-3xl"
      />

      <Card className="w-full max-w-md overflow-hidden border-white/90 bg-white/90 shadow-[0_30px_90px_rgba(24,24,27,0.13)] backdrop-blur-xl">
        <div className="h-1.5 bg-[linear-gradient(90deg,#052e16_0%,#86efac_50%,#e4e4e7_100%)]" />
        <CardHeader className="items-center px-6 pb-0 pt-7 text-center sm:px-9 sm:pt-9">
          <Link href="/" aria-label="Voltar à página inicial">
            <Image
              src="/assets/logo-semobi.png"
              alt="SEMOBI"
              width={846}
              height={258}
              priority
              className="mb-5 h-auto w-44"
            />
          </Link>
          <div className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-zinc-950 text-white shadow-lg shadow-zinc-950/15">
            <LockKeyhole size={20} strokeWidth={1.8} />
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-800">
            Acesso institucional
          </p>
          <CardTitle className="text-3xl">Entre para continuar</CardTitle>
          <CardDescription className="max-w-sm">
            Use a conta Google autorizada pela Secretaria Municipal de Obras e
            Infraestrutura.
          </CardDescription>
        </CardHeader>

        <CardContent className="px-6 pt-6 sm:px-9">
          {error ? (
            <div
              className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-5 text-red-800"
              role="alert"
            >
              Esta conta não está autorizada. Solicite acesso ao administrador.
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

          <p className="mt-4 text-center text-xs text-zinc-500">
            Ainda não possui acesso?{" "}
            <Link className="font-semibold text-emerald-800 hover:underline" href="/cadastro">
              Solicite seu cadastro
            </Link>
          </p>
        </CardContent>

        <CardFooter className="mx-6 mt-6 justify-center gap-2 border-t border-zinc-100 px-0 py-5 text-[11px] leading-5 text-zinc-500 sm:mx-9">
          <ShieldCheck className="shrink-0 text-emerald-700" size={16} />
          Acesso restrito aos servidores autorizados.
        </CardFooter>
      </Card>
    </section>
  );
}
