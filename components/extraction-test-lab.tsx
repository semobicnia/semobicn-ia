"use client";

import {
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  LoaderCircle,
  Play,
  UploadCloud,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  boundaryLabels,
  type TopographicData,
} from "@/lib/topographic";

type TestStatus = "pending" | "running" | "completed" | "error";

type TestItem = {
  id: string;
  file: File;
  status: TestStatus;
  data?: TopographicData;
  elapsedMs?: number;
  error?: string;
};

const maxFileSize = 3_800_000;

function formatNumber(value: number | null) {
  if (value === null) return "Não informado";
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(value);
}

export function ExtractionTestLab() {
  const [items, setItems] = useState<TestItem[]>([]);
  const [supplementaryMessage, setSupplementaryMessage] = useState("");
  const running = items.some((item) => item.status === "running");
  const summary = useMemo(
    () => ({
      completed: items.filter((item) => item.status === "completed").length,
      errors: items.filter((item) => item.status === "error").length,
    }),
    [items],
  );

  function selectFiles(files: FileList | null) {
    if (!files) return;
    setItems(
      Array.from(files).map((file, index) => ({
        id: `${file.name}-${file.lastModified}-${index}`,
        file,
        status: "pending",
        error:
          file.size > maxFileSize
            ? "Arquivo maior que 3,8 MB."
            : undefined,
      })),
    );
  }

  async function runTests() {
    for (const item of items) {
      if (item.file.size > maxFileSize) {
        setItems((current) =>
          current.map((candidate) =>
            candidate.id === item.id
              ? { ...candidate, status: "error" }
              : candidate,
          ),
        );
        continue;
      }

      setItems((current) =>
        current.map((candidate) =>
          candidate.id === item.id
            ? { ...candidate, status: "running", error: undefined }
            : candidate,
        ),
      );
      try {
        const form = new FormData();
        form.append("file", item.file);
        form.append("supplementaryMessage", supplementaryMessage);
        const response = await fetch("/api/test-analyze", {
          method: "POST",
          body: form,
        });
        const responseText = await response.text();
        let result: {
          data?: TopographicData;
          elapsedMs?: number;
          error?: string;
        };
        try {
          result = JSON.parse(responseText) as typeof result;
        } catch {
          throw new Error(
            response.status === 413
              ? "Arquivo maior que o limite aceito pelo servidor."
              : "O servidor não conseguiu concluir este teste.",
          );
        }
        if (!response.ok || !result.data) {
          throw new Error(result.error || "Teste não concluído.");
        }
        setItems((current) =>
          current.map((candidate) =>
            candidate.id === item.id
              ? {
                  ...candidate,
                  status: "completed",
                  data: result.data,
                  elapsedMs: result.elapsedMs,
                }
              : candidate,
          ),
        );
      } catch (error) {
        setItems((current) =>
          current.map((candidate) =>
            candidate.id === item.id
              ? {
                  ...candidate,
                  status: "error",
                  error:
                    error instanceof Error
                      ? error.message
                      : "Teste não concluído.",
                }
              : candidate,
          ),
        );
      }
    }
  }

  return (
    <div className="test-lab">
      <section className="admin-card test-lab-setup">
        <div className="admin-card-heading">
          <span><UploadCloud size={19} /></span>
          <div>
            <h2>Arquivos de teste</h2>
            <p>PDF, JPG, PNG ou WebP. Até 3,8 MB por arquivo.</p>
          </div>
        </div>
        <label className="test-file-picker">
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            multiple
            onChange={(event) => selectFiles(event.target.files)}
          />
          <UploadCloud size={24} />
          <strong>Selecionar vários croquis</strong>
          <span>Os testes não criam processos e não gravam arquivos.</span>
        </label>
        <label className="message-field">
          <span>Mensagem complementar para todos os testes</span>
          <textarea
            value={supplementaryMessage}
            onChange={(event) => setSupplementaryMessage(event.target.value)}
            placeholder="Opcional. Use somente quando o desenho depender de uma informação externa."
          />
        </label>
        <div className="test-lab-actions">
          <span>
            {items.length} arquivo(s) · {summary.completed} concluído(s) ·{" "}
            {summary.errors} erro(s)
          </span>
          <button
            className="button primary"
            disabled={items.length === 0 || running}
            onClick={() => void runTests()}
            type="button"
          >
            {running ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <Play size={17} />
            )}
            {running ? "Executando testes..." : "Executar testes"}
          </button>
        </div>
      </section>

      <section className="test-results">
        {items.length === 0 ? (
          <div className="empty-state">
            <FlaskConical size={38} />
            <strong>Nenhum modelo selecionado</strong>
            <span>Escolha croquis diferentes para comparar a leitura.</span>
          </div>
        ) : (
          items.map((item) => (
            <article className="admin-card test-result-card" key={item.id}>
              <header>
                <div>
                  <strong>{item.file.name}</strong>
                  <small>
                    {(item.file.size / 1024 / 1024).toFixed(2)} MB
                    {item.elapsedMs
                      ? ` · ${(item.elapsedMs / 1000).toFixed(1)} s`
                      : ""}
                  </small>
                </div>
                <span className={`test-status ${item.status}`}>
                  {item.status === "running" && (
                    <LoaderCircle className="spin" size={14} />
                  )}
                  {item.status === "completed" && <CheckCircle2 size={14} />}
                  {item.status === "error" && <AlertTriangle size={14} />}
                  {item.status === "pending" ? "Aguardando" : null}
                  {item.status === "running" ? "Analisando" : null}
                  {item.status === "completed" ? "Concluído" : null}
                  {item.status === "error" ? "Erro" : null}
                </span>
              </header>
              {item.error && <p className="error-message">{item.error}</p>}
              {item.data && (
                <>
                  <div className="test-data-grid">
                    <span><small>Posseiro</small><b>{item.data.claimantName || "—"}</b></span>
                    <span><small>CPF/CNPJ</small><b>{item.data.cpf || "—"}</b></span>
                    <span><small>BCI</small><b>{item.data.bci || "—"}</b></span>
                    <span><small>Quadra / lote</small><b>{item.data.block || "—"} / {item.data.lot || "—"}</b></span>
                    <span><small>Área do terreno</small><b>{formatNumber(item.data.landArea)} m²</b></span>
                    <span><small>Área construída</small><b>{formatNumber(item.data.builtArea)} m²</b></span>
                    <span className="wide"><small>Endereço</small><b>{item.data.propertyAddress || "—"} · {item.data.neighborhood || "—"}</b></span>
                  </div>
                  <div className="test-boundaries">
                    {item.data.boundaries.map((boundary) => (
                      <span key={boundary.side}>
                        <small>{boundaryLabels[boundary.side]}</small>
                        <b>{boundary.label || "—"}</b>
                        <em>{formatNumber(boundary.measurement)} m</em>
                      </span>
                    ))}
                  </div>
                  <footer>
                    <span>
                      Confiança: {Math.round(item.data.confidence * 100)}%
                    </span>
                    {item.data.reviewNotes.length > 0 && (
                      <ul>
                        {item.data.reviewNotes.map((note) => (
                          <li key={note}>{note}</li>
                        ))}
                      </ul>
                    )}
                  </footer>
                </>
              )}
            </article>
          ))
        )}
      </section>
    </div>
  );
}
