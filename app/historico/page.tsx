import { FileClock } from "lucide-react";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { HistoryList } from "@/components/history-list";
import { getAuthenticatedSession } from "@/lib/auth";
import { listProcesses } from "@/lib/database";

export default async function HistoryPage() {
  const session = await getAuthenticatedSession();
  if (!session || !session.user.role) redirect("/entrar");

  const processes = await listProcesses({
    userId: session.user.id,
    role: session.user.role,
  });
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
          <span><FileClock size={24} /></span>
          <div>
            <p className="eyebrow">Controle dos processos</p>
            <h1>Histórico de documentos</h1>
            <p>
              Consulte as análises realizadas e acompanhe quais documentos já
              tiveram o PDF gerado.
            </p>
          </div>
        </section>
        <HistoryList initialProcesses={processes} />
      </div>
    </main>
  );
}
