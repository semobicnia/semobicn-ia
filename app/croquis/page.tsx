import { DraftingCompass } from "lucide-react";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { AppFooter } from "@/components/app-footer";
import { CroquisList } from "@/components/croquis-list";
import { getAuthenticatedSession } from "@/lib/auth";
import { listProcesses } from "@/lib/database";

export default async function UrbanSketchesPage() {
  const session = await getAuthenticatedSession();
  if (!session || !session.user.role) redirect("/entrar");
  const processes = await listProcesses({
    userId: session.user.id,
    role: session.user.role,
    limit: 50,
  });

  return (
    <main className="flex min-h-dvh flex-col">
      <AppHeader
        currentUser={{
          name: session.user.name || "Servidor autorizado",
          email: session.user.email || "",
          role: session.user.role,
        }}
      />
      <div className="page-shell management-shell flex-1">
        <section className="management-heading">
          <span><DraftingCompass size={24} /></span>
          <div>
            <p className="eyebrow">Agente de Croqui Urbano</p>
            <h1>Croquis dos imóveis</h1>
            <p>
              Inicie um novo croqui pelo desenho original ou continue um
              processo já analisado.
            </p>
          </div>
        </section>

        <CroquisList
          initialProcesses={processes}
          isAdmin={session.user.role === "admin"}
        />
      </div>
      <AppFooter />
    </main>
  );
}
