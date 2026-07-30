import { FlaskConical } from "lucide-react";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { ExtractionTestLab } from "@/components/extraction-test-lab";
import { getAuthenticatedSession } from "@/lib/auth";

export default async function TestsPage() {
  const session = await getAuthenticatedSession();
  if (!session) redirect("/entrar");
  if (session.user.role !== "admin") redirect("/");

  return (
    <main className="min-h-screen">
      <AppHeader
        currentUser={{
          name: session.user.name || "Servidor autorizado",
          email: session.user.email || "",
          role: session.user.role,
        }}
      />
      <div className="page-shell management-shell">
        <section className="management-heading">
          <span><FlaskConical size={24} /></span>
          <div>
            <p className="eyebrow">Validação do agente</p>
            <h1>Laboratório de croquis</h1>
            <p>
              Compare a leitura de diferentes modelos sem criar processos no
              histórico oficial.
            </p>
          </div>
        </section>
        <ExtractionTestLab />
      </div>
    </main>
  );
}
