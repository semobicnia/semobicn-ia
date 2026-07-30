"use client";

import {
  DraftingCompass,
  FileClock,
  FilePlus2,
  LayoutDashboard,
  LogOut,
  UsersRound,
} from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  const links = [
    { href: "/", label: "Novo croqui", icon: FilePlus2, visible: true },
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
  ];

  return (
    <header className="topbar">
      <Link className="brand" href="/">
        <div className="brand-mark">S</div>
        <div>
          <strong>SEMOBICN IA</strong>
          <span>Prefeitura de Coelho Neto</span>
        </div>
      </Link>
      <nav className="app-navigation" aria-label="Navegação principal">
        {links
          .filter((item) => item.visible)
          .map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                className={active ? "active" : ""}
                href={item.href}
                key={item.href}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
      </nav>
      <div className="topbar-actions">
        <div className="current-user">
          <span className="user-avatar">
            {currentUser.name.trim().charAt(0).toUpperCase() || "S"}
          </span>
          <span>
            <strong>{currentUser.name}</strong>
            <small>{roleLabels[currentUser.role]}</small>
          </span>
        </div>
        <button
          className="signout-button"
          type="button"
          onClick={() => signOut({ callbackUrl: "/entrar" })}
          title="Sair do sistema"
        >
          <LogOut size={17} />
          Sair
        </button>
      </div>
    </header>
  );
}
