import { UsersRound } from "lucide-react";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { UsersManager } from "@/components/users-manager";
import { getAuthenticatedSession } from "@/lib/auth";
import { listManagedUsers, listPendingAccessRequests } from "@/lib/users";

export default async function UsersPage() {
  const session = await getAuthenticatedSession();
  if (!session) redirect("/entrar");
  if (session.user.role !== "admin") redirect("/sistema");

  const [users, accessRequests] = await Promise.all([
    listManagedUsers(),
    listPendingAccessRequests(),
  ]);
  const currentUser = {
    name: session.user.name || "Servidor autorizado",
    email: session.user.email || "",
    role: session.user.role,
  };

  return (
    <main className="min-h-screen">
      <AppHeader currentUser={currentUser} />
      <div className="page-shell management-shell">
        <section className="management-heading">
          <span><UsersRound size={24} /></span>
          <div>
            <p className="eyebrow">Administração</p>
            <h1>Usuários e permissões</h1>
            <p>
              Autorize servidores, defina o perfil de acesso e os cargos usados
              nas assinaturas.
            </p>
          </div>
        </section>
        <UsersManager
          currentUserId={session.user.id}
          initialUsers={users}
          initialAccessRequests={accessRequests}
        />
      </div>
    </main>
  );
}
