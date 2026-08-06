"use client";

import {
  Building2,
  DraftingCompass,
  FileClock,
  FilePlus2,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  UsersRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/users";

export type HeaderUser = {
  name: string;
  email: string;
  role: UserRole;
};

const roleLabels: Record<UserRole, string> = {
  admin: "Administrador",
  operator: "Operador",
  reviewer: "Revisor",
};

export function AppHeader({ currentUser }: { currentUser: HeaderUser }) {
  const pathname = usePathname();
  const [institution, setInstitution] = useState({
    acronym: "SEMOBI",
    logoUrl: "/assets/logo-semobi.png" as string | null,
  });

  useEffect(() => {
    let active = true;
    fetch("/api/secretaria", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((settings: { acronym?: string; logoUrl?: string | null } | null) => {
        if (!active || !settings) return;
        setInstitution({
          acronym: settings.acronym || "SEMOBI",
          logoUrl: settings.logoUrl || "/assets/logo-semobi.png",
        });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const links = [
    { href: "/sistema", label: "Novo croqui", icon: FilePlus2, visible: true },
    { href: "/croquis", label: "Croquis", icon: DraftingCompass, visible: true },
    { href: "/historico", label: "Histórico", icon: FileClock, visible: true },
    {
      href: "/painel",
      label: "Painel",
      icon: LayoutDashboard,
      visible: currentUser.role === "admin",
    },
    {
      href: "/administracao/usuarios",
      label: "Usuários",
      icon: UsersRound,
      visible: currentUser.role === "admin",
    },
    {
      href: "/administracao/secretaria",
      label: "Secretaria",
      icon: Building2,
      visible: currentUser.role === "admin",
    },
    {
      href: "/administracao/testes",
      label: "Testes",
      icon: FlaskConical,
      visible: currentUser.role === "admin",
    },
  ];
  const visibleLinks = links.filter((item) => item.visible);

  function navigation(linkClassName: string) {
    return visibleLinks.map((item) => {
      const active =
        item.href === "/sistema"
          ? pathname === "/sistema"
          : pathname.startsWith(item.href);
      const Icon = item.icon;
      return (
        <Link
          className={cn(
            linkClassName,
            active
              ? "bg-emerald-950 text-white shadow-sm"
              : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950",
          )}
          href={item.href}
          key={item.href}
        >
          <Icon size={15} strokeWidth={1.9} />
          {item.label}
        </Link>
      );
    });
  }

  return (
    <header className="sticky top-0 z-40 shrink-0 border-b border-zinc-200/80 bg-white/90 shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex h-[78px] w-full max-w-[1500px] items-center gap-5 px-4 sm:px-6 lg:px-8">
        <Link
          className="relative block h-[50px] w-[105px] shrink-0 sm:w-[122px]"
          href="/sistema"
          aria-label={`Área interna ${institution.acronym}`}
        >
          <Image
            src={institution.logoUrl || "/assets/logo-semobi.png"}
            alt={institution.acronym}
            fill
            sizes="(min-width: 640px) 122px, 105px"
            priority
            unoptimized={Boolean(institution.logoUrl?.startsWith("http"))}
            className="object-contain object-left"
          />
        </Link>

        <nav
          className="hidden flex-1 items-center justify-center gap-1 xl:flex"
          aria-label="Navegação principal"
        >
          {navigation(
            "inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors",
          )}
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="hidden min-w-0 items-center gap-2.5 sm:flex">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-950">
              {currentUser.name.trim().charAt(0).toUpperCase() || "S"}
            </span>
            <span className="hidden min-w-0 flex-col lg:flex">
              <strong className="max-w-40 truncate text-xs font-semibold text-zinc-900">
                {currentUser.name}
              </strong>
              <small className="mt-0.5 text-[10px] text-zinc-500">
                {roleLabels[currentUser.role]}
              </small>
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut({ callbackUrl: "/entrar" })}
            title="Sair do sistema"
            className="px-2.5 text-zinc-600"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </div>

      <nav
        className="flex gap-1 overflow-x-auto border-t border-zinc-100 px-4 py-2 xl:hidden"
        aria-label="Navegação principal móvel"
      >
        {navigation(
          "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-semibold transition-colors",
        )}
      </nav>
    </header>
  );
}
