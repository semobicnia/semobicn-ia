import { DraftingCompass, MapPinned } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
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

        <section className="sketch-process-grid">
          <article className="sketch-process-card sketch-demo-card">
            <span><MapPinned size={20} /></span>
            <div>
              <strong>Modelo de referência</strong>
              <small>Croqui de Maria Resende usado como padrão visual</small>
              <small>Demonstração sem alteração no banco</small>
            </div>
            <Link
              className="button secondary compact"
              href="/croquis/novo?demonstracao=1"
            >
              Visualizar modelo
            </Link>
          </article>
          {processes.length === 0 ? (
            <div className="empty-state sketch-empty">
              <MapPinned size={36} />
              <strong>Nenhum croqui iniciado</strong>
              <span>Envie uma foto ou PDF do desenho original para começar.</span>
              <Link className="button primary compact" href="/">
                Criar primeiro croqui
              </Link>
            </div>
          ) : (
            processes.map((process) => (
              <article className="sketch-process-card" key={process.id}>
                <span><DraftingCompass size={20} /></span>
                <div>
                  <strong>{process.claimantName}</strong>
                  <small>{process.propertyAddress}</small>
                  <small>
                    Quadra {process.blockNumber || "-"} · Lote{" "}
                    {process.lotNumber || "-"}
                  </small>
                </div>
                <Link
                  className="button secondary compact"
                  href={`/croquis/${process.id}`}
                >
                  Criar croqui
                </Link>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
