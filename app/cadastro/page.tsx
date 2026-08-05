import { UserPlus } from "lucide-react";
import { AccessRequestForm } from "@/components/access-request-form";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import { Card } from "@/components/ui/card";

export default function RegistrationPage() {
  return (
    <main className="flex min-h-dvh flex-col">
      <PublicHeader active="register" />

      <section className="flex flex-1 items-center justify-center px-4 py-7 sm:px-7">
        <div className="grid w-full max-w-5xl items-center gap-7 lg:grid-cols-[0.72fr_1.28fr]">
          <div className="px-2 text-center lg:text-left">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-emerald-950 text-white lg:mx-0">
              <UserPlus size={20} />
            </span>
            <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-800">
              Cadastro institucional
            </p>
            <h1 className="mt-2 font-sans text-3xl font-semibold tracking-[-0.04em] text-zinc-950 sm:text-4xl">
              Solicite acesso ao sistema
            </h1>
            <p className="mt-3 text-sm leading-6 text-zinc-500">
              Preencha os dados funcionais. A equipe responsável analisará o
              pedido antes de liberar o acesso pela conta Google.
            </p>
          </div>

          <Card className="overflow-hidden border-white/90 bg-white/90 shadow-[0_24px_70px_rgba(24,24,27,0.1)] backdrop-blur-xl">
            <div className="h-1.5 bg-[linear-gradient(90deg,#052e16_0%,#86efac_50%,#e4e4e7_100%)]" />
            <AccessRequestForm />
          </Card>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
