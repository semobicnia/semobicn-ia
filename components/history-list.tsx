"use client";

import { CheckCircle2, Clock3, FileClock, Search } from "lucide-react";
import { useState } from "react";
import type { ProcessSummary } from "@/lib/database";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Fortaleza",
  }).format(new Date(value));
}

export function HistoryList({
  initialProcesses,
}: {
  initialProcesses: ProcessSummary[];
}) {
  const [processes, setProcesses] = useState(initialProcesses);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/processes?busca=${encodeURIComponent(search)}`,
        { cache: "no-store" },
      );
      const result = (await response.json()) as {
        processes?: ProcessSummary[];
        error?: string;
      };
      if (!response.ok || !result.processes) {
        throw new Error(result.error || "Não foi possível consultar o histórico.");
      }
      setProcesses(result.processes);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível consultar o histórico.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form className="history-search" onSubmit={submitSearch}>
        <Search size={18} />
        <input
          aria-label="Buscar no histórico"
          placeholder="Buscar por posseiro, endereço, quadra ou lote"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button className="button primary compact" disabled={loading}>
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </form>

      {error && <div className="admin-message error">{error}</div>}

      <div className="history-card">
        {processes.length === 0 ? (
          <div className="empty-state">
            <FileClock size={34} />
            <strong>Nenhum processo encontrado</strong>
            <span>As análises realizadas aparecerão aqui.</span>
          </div>
        ) : (
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Posseiro e imóvel</th>
                  <th>Quadra / lote</th>
                  <th>Responsável</th>
                  <th>Situação</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {processes.map((process) => (
                  <tr key={process.id}>
                    <td>
                      <strong>{process.claimantName}</strong>
                      <small>{process.propertyAddress}</small>
                    </td>
                    <td>
                      Q. {process.blockNumber || "—"} / L.{" "}
                      {process.lotNumber || "—"}
                    </td>
                    <td>
                      {process.createdByName}
                      {process.createdByEmail && (
                        <small>{process.createdByEmail}</small>
                      )}
                    </td>
                    <td>
                      <span
                        className={`status-badge ${process.status === "completed" ? "completed" : "review"}`}
                      >
                        {process.status === "completed" ? (
                          <CheckCircle2 size={13} />
                        ) : (
                          <Clock3 size={13} />
                        )}
                        {process.status === "completed"
                          ? "PDF gerado"
                          : "Em revisão"}
                      </span>
                    </td>
                    <td>{formatDate(process.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
