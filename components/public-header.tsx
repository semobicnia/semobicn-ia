import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function PublicHeader({
  active,
}: {
  active?: "home" | "register";
}) {
  return (
    <header className="h-[76px] shrink-0 border-b border-zinc-200/80 bg-white/90 backdrop-blur-xl sm:h-[84px]">
      <div className="mx-auto grid h-full w-full max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 sm:px-7 lg:px-10">
        <Link className="w-fit" href="/" aria-label="Página inicial SEMOBI">
          <Image
            src="/assets/logo-semobi.png"
            alt="SEMOBI"
            width={846}
            height={258}
            priority
            className="h-auto w-[76px] sm:w-[150px]"
          />
        </Link>

        <nav
          className="flex items-center gap-1 rounded-full border border-zinc-200/70 bg-zinc-50/80 p-1"
          aria-label="Navegação pública"
        >
          <Link
            className={cn(
              "rounded-full px-2 py-2 text-[10px] font-semibold transition-colors sm:px-5 sm:text-sm",
              active === "home"
                ? "bg-white text-zinc-950 shadow-sm"
                : "text-zinc-500 hover:text-zinc-950",
            )}
            href="/"
          >
            Início
          </Link>
          <Link
            className={cn(
              "rounded-full px-2 py-2 text-[10px] font-semibold transition-colors sm:px-5 sm:text-sm",
              active === "register"
                ? "bg-white text-zinc-950 shadow-sm"
                : "text-zinc-500 hover:text-zinc-950",
            )}
            href="/cadastro"
          >
            Cadastro
          </Link>
        </nav>

        <Link
          className="justify-self-end rounded-xl bg-zinc-950 px-2.5 py-2.5 text-[10px] font-semibold text-white shadow-sm transition-colors hover:bg-zinc-800 sm:px-5 sm:text-sm"
          href="/entrar"
        >
          Entrar
        </Link>
      </div>
    </header>
  );
}
