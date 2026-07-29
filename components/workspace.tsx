"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  FileCheck2,
  FileText,
  LoaderCircle,
  MapPinned,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  boundaryLabels,
  sampleTopographicData,
  type TopographicData,
} from "@/lib/topographic";

type Step = "upload" | "review" | "document";

const steps: Array<{ id: Step; label: string; hint: string }> = [
  { id: "upload", label: "Croqui", hint: "Enviar o PDF" },
  { id: "review", label: "Revisão", hint: "Conferir os dados" },
  { id: "document", label: "Documento", hint: "Gerar o PDF" },
];

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Section({
  number,
  title,
  description,
  children,
}: {
  number: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="form-section">
      <div className="section-heading">
        <span>{number}</span>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export function Workspace() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [supplementaryMessage, setSupplementaryMessage] = useState("");
  const [data, setData] = useState<TopographicData>(sampleTopographicData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [generatedName, setGeneratedName] = useState("");

  const currentIndex = steps.findIndex((item) => item.id === step);
  const completeness = useMemo(() => {
    const checks = [
      data.claimantName,
      data.propertyAddress,
      data.block,
      data.landArea,
      ...data.boundaries.map((boundary) => boundary.measurement),
    ];
    return Math.round(
      (checks.filter((value) => value !== "" && value !== null).length /
        checks.length) *
        100,
    );
  }, [data]);

  function update<K extends keyof TopographicData>(
    key: K,
    value: TopographicData[K],
  ) {
    setData((current) => ({ ...current, [key]: value }));
  }

  async function analyze() {
    if (!file) {
      setError("Selecione o croqui em PDF para iniciar a análise.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("supplementaryMessage", supplementaryMessage);
      const response = await fetch("/api/analyze", { method: "POST", body });
      const result = (await response.json()) as {
        data?: TopographicData;
        error?: string;
      };
      if (!response.ok || !result.data) {
        throw new Error(result.error || "Não foi possível analisar o croqui.");
      }
      setData(result.data);
      setStep("review");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível analisar o croqui.",
      );
    } finally {
      setLoading(false);
    }
  }

  function useExample() {
    setData(sampleTopographicData);
    setError("");
    setStep("review");
  }

  async function generatePdf() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error || "Não foi possível gerar o PDF.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const filename =
        disposition.match(/filename="([^"]+)"/)?.[1] ??
        "informacoes-topograficas.pdf";
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      setGeneratedName(filename);
      setStep("document");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível gerar o PDF.",
      );
    } finally {
      setLoading(false);
    }
  }

  function restart() {
    setStep("upload");
    setFile(null);
    setSupplementaryMessage("");
    setError("");
    setGeneratedName("");
  }

  return (
    <main className="min-h-screen">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">S</div>
          <div>
            <strong>SEMOBICN IA</strong>
            <span>Prefeitura de Coelho Neto</span>
          </div>
        </div>
        <div className="topbar-status">
          <ShieldCheck size={17} />
          Ambiente interno
        </div>
      </header>

      <div className="page-shell">
        <section className="intro">
          <div>
            <p className="eyebrow">
              <Sparkles size={15} /> Assistente topográfico
            </p>
            <h1>Do croqui ao documento, com revisão humana.</h1>
            <p>
              Envie o desenho do imóvel, confira cada informação extraída e
              gere o PDF no padrão oficial da SEMOBI.
            </p>
          </div>
          <div className="intro-badge">
            <MapPinned size={22} />
            <span>
              Fluxo padronizado
              <small>Coelho Neto - MA</small>
            </span>
          </div>
        </section>

        <nav className="stepper" aria-label="Etapas do processo">
          {steps.map((item, index) => {
            const complete = index < currentIndex;
            const active = item.id === step;
            return (
              <div
                className={`step ${active ? "active" : ""} ${complete ? "complete" : ""}`}
                key={item.id}
              >
                <span className="step-number">
                  {complete ? <Check size={16} /> : index + 1}
                </span>
                <div>
                  <strong>{item.label}</strong>
                  <small>{item.hint}</small>
                </div>
              </div>
            );
          })}
        </nav>

        <div className="workspace-grid">
          <div className="main-panel">
            {step === "upload" && (
              <div className="upload-view">
                <div className="panel-heading">
                  <span className="icon-box">
                    <UploadCloud size={23} />
                  </span>
                  <div>
                    <p className="eyebrow">Nova análise</p>
                    <h2>Envie o croqui do imóvel</h2>
                    <p>
                      O arquivo será lido visualmente para identificar medidas,
                      confrontantes, áreas e dados do posseiro.
                    </p>
                  </div>
                </div>

                <label className={`dropzone ${file ? "has-file" : ""}`}>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(event) => {
                      setFile(event.target.files?.[0] ?? null);
                      setError("");
                    }}
                  />
                  {file ? (
                    <>
                      <FileCheck2 size={36} />
                      <strong>{file.name}</strong>
                      <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                      <small>Clique para trocar o arquivo</small>
                    </>
                  ) : (
                    <>
                      <UploadCloud size={36} />
                      <strong>Selecione o croqui em PDF</strong>
                      <span>ou arraste o arquivo para esta área</span>
                      <small>Somente PDF, com até 10 MB</small>
                    </>
                  )}
                </label>

                <label className="message-field">
                  <span>Ficha mensagem complementar</span>
                  <textarea
                    value={supplementaryMessage}
                    onChange={(event) =>
                      setSupplementaryMessage(event.target.value)
                    }
                    placeholder="Ex.: posseiro estrangeiro; residência diferente do imóvel; delimitação ou benfeitoria fora do padrão..."
                  />
                  <small>
                    Use apenas para informações que alterem as regras padrão.
                  </small>
                </label>

                {error && <p className="error-message">{error}</p>}

                <div className="panel-actions">
                  <button className="button secondary" onClick={useExample}>
                    <FileText size={17} />
                    Usar exemplo
                  </button>
                  <button
                    className="button primary"
                    onClick={analyze}
                    disabled={loading}
                  >
                    {loading ? (
                      <LoaderCircle className="spin" size={18} />
                    ) : (
                      <Sparkles size={18} />
                    )}
                    {loading ? "Analisando o croqui..." : "Analisar croqui"}
                  </button>
                </div>
              </div>
            )}

            {step === "review" && (
              <div className="review-view">
                <div className="panel-heading review-heading">
                  <span className="icon-box">
                    <FileCheck2 size={23} />
                  </span>
                  <div>
                    <p className="eyebrow">Revisão obrigatória</p>
                    <h2>Confira as informações extraídas</h2>
                    <p>
                      A IA organiza os dados, mas o servidor responsável
                      confirma o conteúdo antes da emissão.
                    </p>
                  </div>
                  <div className="confidence">
                    <strong>{Math.round(data.confidence * 100)}%</strong>
                    <span>confiança da leitura</span>
                  </div>
                </div>

                <Section
                  number="01"
                  title="Posseiro"
                  description="Identificação e endereço de residência."
                >
                  <div className="form-grid two">
                    <Field
                      label="Nome completo"
                      value={data.claimantName}
                      onChange={(value) => update("claimantName", value)}
                    />
                    <Field
                      label="CPF"
                      value={data.cpf}
                      onChange={(value) => update("cpf", value)}
                    />
                    <Field
                      label="Nacionalidade"
                      value={data.nationality}
                      onChange={(value) => update("nationality", value)}
                    />
                    <Field
                      label="Residência"
                      value={data.residence}
                      onChange={(value) => update("residence", value)}
                    />
                  </div>
                </Section>

                <Section
                  number="02"
                  title="Imóvel"
                  description="Localização, quadra, lote e áreas."
                >
                  <div className="form-grid three">
                    <div className="span-two">
                      <Field
                        label="Endereço do imóvel"
                        value={data.propertyAddress}
                        onChange={(value) => update("propertyAddress", value)}
                      />
                    </div>
                    <Field
                      label="Bairro"
                      value={data.neighborhood}
                      onChange={(value) => update("neighborhood", value)}
                    />
                    <Field
                      label="Quadra"
                      value={data.block}
                      onChange={(value) => update("block", value)}
                    />
                    <Field
                      label="Lote"
                      value={data.lot}
                      onChange={(value) => update("lot", value)}
                    />
                    <Field
                      label="Data do croqui"
                      type="date"
                      value={data.documentDate}
                      onChange={(value) => update("documentDate", value)}
                    />
                    <Field
                      label="Área do terreno (m²)"
                      type="number"
                      value={data.landArea ?? ""}
                      onChange={(value) =>
                        update("landArea", value ? Number(value) : null)
                      }
                    />
                    <div className="span-two">
                      <Field
                        label="Área do terreno por extenso"
                        value={data.landAreaInWords}
                        onChange={(value) =>
                          update("landAreaInWords", value)
                        }
                      />
                    </div>
                    <Field
                      label="Área construída (m²)"
                      type="number"
                      value={data.builtArea ?? ""}
                      onChange={(value) =>
                        update("builtArea", value ? Number(value) : 0)
                      }
                    />
                    {data.builtArea !== null && data.builtArea > 0 && (
                      <div className="span-two">
                        <Field
                          label="Área construída por extenso"
                          value={data.builtAreaInWords}
                          onChange={(value) =>
                            update("builtAreaInWords", value)
                          }
                        />
                      </div>
                    )}
                  </div>
                </Section>

                <Section
                  number="03"
                  title="Limites e confrontantes"
                  description="Nome da rua ou vizinho e medida de cada lado."
                >
                  <div className="boundary-list">
                    {data.boundaries.map((boundary, index) => (
                      <div className="boundary-row" key={boundary.side}>
                        <strong>{boundaryLabels[boundary.side]}</strong>
                        <input
                          aria-label={`Confrontante - ${boundaryLabels[boundary.side]}`}
                          value={boundary.label}
                          placeholder="TERRENOS DE TERCEIROS"
                          onChange={(event) => {
                            const boundaries = [...data.boundaries];
                            boundaries[index] = {
                              ...boundary,
                              label: event.target.value,
                            };
                            update("boundaries", boundaries);
                          }}
                        />
                        <div className="measure-input">
                          <input
                            type="number"
                            step="0.01"
                            aria-label={`Medida - ${boundaryLabels[boundary.side]}`}
                            value={boundary.measurement ?? ""}
                            onChange={(event) => {
                              const boundaries = [...data.boundaries];
                              boundaries[index] = {
                                ...boundary,
                                measurement: event.target.value
                                  ? Number(event.target.value)
                                  : null,
                              };
                              update("boundaries", boundaries);
                            }}
                          />
                          <span>m</span>
                        </div>
                        <input
                          aria-label={`Medida por extenso - ${boundaryLabels[boundary.side]}`}
                          value={boundary.measurementInWords}
                          placeholder="Medida por extenso"
                          onChange={(event) => {
                            const boundaries = [...data.boundaries];
                            boundaries[index] = {
                              ...boundary,
                              measurementInWords: event.target.value,
                            };
                            update("boundaries", boundaries);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </Section>

                <Section
                  number="04"
                  title="Utilização"
                  description="Características usadas no documento final."
                >
                  <div className="form-grid two">
                    <Field
                      label="Uso do imóvel"
                      value={data.propertyUse}
                      onChange={(value) => update("propertyUse", value)}
                    />
                    <Field
                      label="Delimitação"
                      value={data.delimitation}
                      onChange={(value) => update("delimitation", value)}
                    />
                    <div className="span-two">
                      <Field
                        label="Outras benfeitorias"
                        value={data.improvements.join(", ")}
                        onChange={(value) =>
                          update(
                            "improvements",
                            value
                              .split(",")
                              .map((item) => item.trim())
                              .filter(Boolean),
                          )
                        }
                      />
                    </div>
                  </div>
                </Section>

                {data.reviewNotes.length > 0 && (
                  <div className="review-notes">
                    <strong>Pontos sinalizados pela análise</strong>
                    <ul>
                      {data.reviewNotes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {error && <p className="error-message">{error}</p>}

                <div className="panel-actions sticky-actions">
                  <button
                    className="button secondary"
                    onClick={() => setStep("upload")}
                  >
                    <ArrowLeft size={17} />
                    Voltar
                  </button>
                  <button
                    className="button primary"
                    onClick={generatePdf}
                    disabled={loading}
                  >
                    {loading ? (
                      <LoaderCircle className="spin" size={18} />
                    ) : (
                      <Download size={18} />
                    )}
                    {loading ? "Gerando documento..." : "Aprovar e gerar PDF"}
                  </button>
                </div>
              </div>
            )}

            {step === "document" && (
              <div className="success-view">
                <span className="success-icon">
                  <CheckCircle2 size={48} />
                </span>
                <p className="eyebrow">Documento concluído</p>
                <h2>Informações Topográficas geradas</h2>
                <p>
                  O PDF foi baixado e está pronto para a conferência final e
                  assinatura digital.
                </p>
                <div className="file-result">
                  <FileText size={24} />
                  <span>
                    <strong>{generatedName}</strong>
                    <small>Documento PDF padronizado</small>
                  </span>
                  <Check size={20} />
                </div>
                <div className="panel-actions centered">
                  <button
                    className="button secondary"
                    onClick={() => setStep("review")}
                  >
                    <ArrowLeft size={17} />
                    Revisar novamente
                  </button>
                  <button className="button primary" onClick={restart}>
                    <RotateCcw size={17} />
                    Novo processo
                  </button>
                </div>
              </div>
            )}
          </div>

          <aside className="side-panel">
            <div className="side-card">
              <p className="eyebrow">Processo atual</p>
              <div className="process-title">
                <FileText size={20} />
                <span>
                  <strong>
                    {step === "upload"
                      ? "Novo documento"
                      : data.claimantName || "Sem identificação"}
                  </strong>
                  <small>
                    {file?.name || "Croqui ainda não selecionado"}
                  </small>
                </span>
              </div>
              <div className="progress-label">
                <span>Dados preenchidos</span>
                <strong>{step === "upload" ? 0 : completeness}%</strong>
              </div>
              <div className="progress-track">
                <span
                  style={{ width: `${step === "upload" ? 0 : completeness}%` }}
                />
              </div>
            </div>

            <div className="side-card rules-card">
              <p className="eyebrow">Regras automáticas</p>
              <ul>
                <li>
                  <Check size={15} /> Nacionalidade brasileira
                </li>
                <li>
                  <Check size={15} /> Residência igual ao imóvel
                </li>
                <li>
                  <Check size={15} /> Limite sem nome = terceiros
                </li>
                <li>
                  <Check size={15} /> Área numérica e por extenso
                </li>
              </ul>
            </div>

            <div className="privacy-note">
              <ShieldCheck size={18} />
              <p>
                <strong>Tratamento protegido</strong>
                Croquis privados, revisão humana e acesso restrito aos
                servidores autorizados.
              </p>
            </div>

            {step === "review" && (
              <button
                className="side-next"
                onClick={generatePdf}
                disabled={loading}
              >
                Gerar documento
                <ArrowRight size={17} />
              </button>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
