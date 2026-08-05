"use client";

import { useState } from "react";
import Link from "next/link";
import { DraftingCompass, ImageIcon, MapPinned, Trash2 } from "lucide-react";
import type { ProcessSummary } from "@/lib/database";
import { Button } from "@/components/ui/button";

export function CroquisList({
  initialProcesses,
  isAdmin,
}: {
  initialProcesses: ProcessSummary[];
  isAdmin: boolean;
}) {
  const [processes, setProcesses] = useState(initialProcesses);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleDelete(process: ProcessSummary) {
    const confirmed = window.confirm(
      `Excluir definitivamente o croqui de ${process.claimantName}? Esta ação também removerá o histórico relacionado e não poderá ser desfeita.`,
    );
    if (!confirmed) return;

    setDeletingId(process.id);
    setError("");
    try {
      const response = await fetch(`/api/processes/${process.id}`, {
        method: "DELETE",
      });
      const result = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(result?.error || "Não foi possível excluir o croqui.");
      }
      setProcesses((current) =>
        current.filter((item) => item.id !== process.id),
      );
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Não foi possível excluir o croqui.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
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

      {error ? <p className="sketch-list-error">{error}</p> : null}

      {processes.length === 0 ? (
        <div className="empty-state sketch-empty">
          <MapPinned size={36} />
          <strong>Nenhum croqui iniciado</strong>
          <span>Envie uma foto ou PDF do desenho original para começar.</span>
          <Link className="button primary compact" href="/sistema">
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
                Quadra {process.blockNumber || "-"} · Lote {process.lotNumber || "-"}
              </small>
              {process.sketchStatus ? (
                <small className="sketch-draft-status">
                  {process.sketchLocationImageAvailable ? <ImageIcon size={12} /> : null}
                  {process.sketchStatus === "finalized"
                    ? "Croqui concluído"
                    : process.sketchLocationImageAvailable
                      ? "Rascunho salvo com imagem de localização"
                      : "Rascunho salvo"}
                </small>
              ) : null}
            </div>
            <div className="sketch-card-actions">
              <Link
                className="button secondary compact"
                href={`/croquis/${process.id}`}
              >
                {process.sketchStatus ? "Continuar croqui" : "Criar croqui"}
              </Link>
              {isAdmin ? (
                <Button
                  aria-label={`Excluir croqui de ${process.claimantName}`}
                  className="sketch-delete-button"
                  disabled={deletingId === process.id}
                  onClick={() => handleDelete(process)}
                  size="sm"
                  title="Excluir croqui"
                  variant="outline"
                >
                  <Trash2 size={16} />
                  {deletingId === process.id ? "Excluindo..." : "Excluir"}
                </Button>
              ) : null}
            </div>
          </article>
        ))
      )}
    </section>
  );
}
