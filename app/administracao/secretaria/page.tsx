import { Building2 } from "lucide-react";
import { redirect } from "next/navigation";
import { AppFooter } from "@/components/app-footer";
import { AppHeader } from "@/components/app-header";
import { SecretariatManager } from "@/components/secretariat-manager";
import { getAuthenticatedSession } from "@/lib/auth";
import { getSecretariatSettings } from "@/lib/secretariat";

export default async function SecretariatPage() {
  const session = await getAuthenticatedSession();
  if (!session) redirect("/entrar");
  if (session.user.role !== "admin") redirect("/sistema");

  const settings = await getSecretariatSettings();
  const currentUser = {
    name: session.user.name || "Servidor autorizado",
    email: session.user.email || "",
    role: session.user.role,
  };

  return (
    <main className="flex min-h-dvh flex-col">
      <AppHeader currentUser={currentUser} />
      <div className="page-shell management-shell flex-1">
        <section className="management-heading">
          <span><Building2 size={24} /></span>
          <div>
            <p className="eyebrow">Administração</p>
            <h1>Dados da Secretaria</h1>
            <p>
              Cadastre a identidade institucional, os contatos e o Secretário
              Municipal de Obras.
            </p>
          </div>
        </section>
        <SecretariatManager initial={settings} />
      </div>
      <AppFooter />
    </main>
  );
}
