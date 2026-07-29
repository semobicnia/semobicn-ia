"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  LoaderCircle,
  MapPinned,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/app-header";
import type {
  ProcessEvent,
  ProcessStatus,
} from "@/lib/database";
import {
  boundaryLabels,
  defaultSexOptions,
  defaultTechnicalResponsible,
  defaultWorksInspector,
  sampleTopographicData,
  type SexCode,
  type SexOption,
  type StaffMember,
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

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
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

type CurrentUser = {
  name: string;
  email: string;
  role: "admin" | "operator" | "reviewer";
};

type InitialProcess = {
  id: string;
  status: ProcessStatus;
  data: TopographicData;
  sourceAvailable: boolean;
  events: ProcessEvent[];
};

const statusLabels: Record<ProcessStatus, string> = {
  review: "Em revisão",
  approved: "Aprovado",
  completed: "PDF gerado",
  cancelled: "Cancelado",
  archived: "Arquivado",
};

export function Workspace({
  currentUser,
  initialProcess,
}: {
  currentUser: CurrentUser;
  initialProcess?: InitialProcess;
}) {
  const [step, setStep] = useState<Step>(
    initialProcess ? "review" : "upload",
  );
  const [file, setFile] = useState<File | null>(null);
  const [supplementaryMessage, setSupplementaryMessage] = useState("");
  const [data, setData] = useState<TopographicData>(
    initialProcess?.data ?? sampleTopographicData,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [generatedName, setGeneratedName] = useState("");
  const [processId, setProcessId] = useState<string | null>(
    initialProcess?.id ?? null,
  );
  const [processStatus, setProcessStatus] = useState<ProcessStatus>(
    initialProcess?.status ?? "review",
  );
  const [savedMessage, setSavedMessage] = useState("");
  const [sexOptions, setSexOptions] =
    useState<SexOption[]>(defaultSexOptions);
  const [staff, setStaff] = useState<StaffMember[]>([
    defaultTechnicalResponsible,
    defaultWorksInspector,
  ]);

  useEffect(() => {
    let active = true;
    fetch("/api/reference-data", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as {
          sexOptions: SexOption[];
          staff: StaffMember[];
        };
      })
      .then((referenceData) => {
        if (!active || !referenceData) return;
        setSexOptions(referenceData.sexOptions);
        setStaff(referenceData.staff);
        const technicalResponsible = referenceData.staff.find(
          (member) => member.role === "technical_responsible",
        );
        const worksInspector = referenceData.staff.find(
          (member) => member.role === "works_inspector",
        );
        setData((current) => ({
          ...current,
          technicalResponsible:
            technicalResponsible ?? current.technicalResponsible,
          worksInspector: worksInspector ?? current.worksInspector,
        }));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

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
        processId?: string | null;
        error?: string;
      };
      if (!response.ok || !result.data) {
        throw new Error(result.error || "Não foi possível analisar o croqui.");
      }
      setData(result.data);
      setProcessId(result.processId || null);
      setProcessStatus("review");
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
    setProcessId(null);
    setProcessStatus("review");
    setError("");
    setStep("review");
  }

  async function persistProcess(nextStatus: ProcessStatus) {
    if (!processId) return;
    const response = await fetch(`/api/processes/${processId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data, status: nextStatus }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(result.error || "Não foi possível salvar o processo.");
    }
    setProcessStatus(nextStatus);
  }

  async function saveChanges() {
    setLoading(true);
    setError("");
    setSavedMessage("");
    try {
      await persistProcess(processStatus);
      setSavedMessage("Alterações salvas no histórico do processo.");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível salvar o processo.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function generatePdf() {
    setLoading(true);
    setError("");
    setSavedMessage("");
    try {
      if (processId) await persistProcess("completed");
      const response = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, processId }),
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
    if (initialProcess) {
      window.location.href = "/";
      return;
    }
    setStep("upload");
    setFile(null);
    setSupplementaryMessage("");
    setError("");
    setGeneratedName("");
    setProcessId(null);
    setProcessStatus("review");
  }

  return (
    <main className="min-h-screen">
      <AppHeader currentUser={currentUser} />

      <div className="page-shell">
        <section className="intro">
          <div>
            <p className="eyebrow">
              <Sparkles size={15} /> Assistente topográfico
            </p>
            <h1>
              {initialProcess
                ? "Revise e atualize o processo."
                : "Do croqui ao documento, com revisão humana."}
            </h1>
            <p>
              {initialProcess
                ? "Confira os dados salvos, altere a situação e gere novamente o PDF quando necessário."
                : "Envie o desenho do imóvel, confira cada informação extraída e gere o PDF no padrão oficial da SEMOBI."}
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

        {initialProcess && (
          <section className="process-toolbar">
            <div>
              <span>Situação do processo</span>
              <select
                value={processStatus}
                onChange={(event) =>
                  setProcessStatus(event.target.value as ProcessStatus)
                }
              >
                {(currentUser.role === "operator"
                  ? (["review", "completed"] as ProcessStatus[])
                  : ([
                      "review",
                      "approved",
                      "completed",
                      "cancelled",
                      "archived",
                    ] as ProcessStatus[])
                ).map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </select>
            </div>
            <div className="process-toolbar-actions">
              {initialProcess.sourceAvailable && (
                <a
                  className="button secondary"
                  href={`/api/processes/${initialProcess.id}/source`}
                  rel="noreferrer"
                  target="_blank"
                >
                  <ExternalLink size={16} />
                  Abrir croqui original
                </a>
              )}
              <button
                className="button primary"
                disabled={loading}
                onClick={saveChanges}
                type="button"
              >
                <Save size={16} />
                Salvar alterações
              </button>
            </div>
          </section>
        )}

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
                {savedMessage && (
                  <p className="success-message">{savedMessage}</p>
                )}

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
                    <SelectField
                      label="Sexo do posseiro"
                      value={data.claimantSex}
                      options={sexOptions.map((option) => ({
                        value: option.code,
                        label: option.label,
                      }))}
                      onChange={(value) =>
                        update("claimantSex", value as SexCode)
                      }
                    />
                    <Field
                      label="CPF/CNPJ"
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

                <Section
                  number="05"
                  title="Responsáveis pelo documento"
                  description="Servidores, sexo e registros exibidos nas assinaturas."
                >
                  <div className="form-grid three">
                    <SelectField
                      label="Responsável técnico"
                      value={
                        data.technicalResponsible.id ??
                        data.technicalResponsible.fullName
                      }
                      options={staff
                        .filter(
                          (member) =>
                            member.role === "technical_responsible",
                        )
                        .map((member) => ({
                          value: member.id ?? member.fullName,
                          label: member.fullName,
                        }))}
                      onChange={(value) => {
                        const selected = staff.find(
                          (member) =>
                            member.role === "technical_responsible" &&
                            (member.id ?? member.fullName) === value,
                        );
                        if (selected) update("technicalResponsible", selected);
                      }}
                    />
                    <SelectField
                      label="Sexo do responsável técnico"
                      value={data.technicalResponsible.sex}
                      options={sexOptions.map((option) => ({
                        value: option.code,
                        label: option.label,
                      }))}
                      onChange={(value) =>
                        update("technicalResponsible", {
                          ...data.technicalResponsible,
                          sex: value as SexCode,
                        })
                      }
                    />
                    <Field
                      label="Registro do responsável técnico"
                      value={data.technicalResponsible.registration}
                      onChange={(value) =>
                        update("technicalResponsible", {
                          ...data.technicalResponsible,
                          registration: value,
                        })
                      }
                    />
                    <SelectField
                      label="Fiscal de obras"
                      value={
                        data.worksInspector.id ?? data.worksInspector.fullName
                      }
                      options={staff
                        .filter(
                          (member) => member.role === "works_inspector",
                        )
                        .map((member) => ({
                          value: member.id ?? member.fullName,
                          label: member.fullName,
                        }))}
                      onChange={(value) => {
                        const selected = staff.find(
                          (member) =>
                            member.role === "works_inspector" &&
                            (member.id ?? member.fullName) === value,
                        );
                        if (selected) update("worksInspector", selected);
                      }}
                    />
                    <SelectField
                      label="Sexo do fiscal de obras"
                      value={data.worksInspector.sex}
                      options={sexOptions.map((option) => ({
                        value: option.code,
                        label: option.label,
                      }))}
                      onChange={(value) =>
                        update("worksInspector", {
                          ...data.worksInspector,
                          sex: value as SexCode,
                        })
                      }
                    />
                    <Field
                      label="Matrícula do fiscal"
                      value={data.worksInspector.registration}
                      onChange={(value) =>
                        update("worksInspector", {
                          ...data.worksInspector,
                          registration: value,
                        })
                      }
                    />
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
                    onClick={() =>
                      initialProcess
                        ? (window.location.href = "/historico")
                        : setStep("upload")
                    }
                  >
                    <ArrowLeft size={17} />
                    {initialProcess ? "Voltar ao histórico" : "Voltar"}
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
                    {file?.name ||
                      (initialProcess
                        ? "Processo cadastrado"
                        : "Croqui ainda não selecionado")}
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

            {initialProcess && (
              <div className="side-card audit-card">
                <p className="eyebrow">Registro de alterações</p>
                {initialProcess.events.length === 0 ? (
                  <small>Nenhuma ação registrada.</small>
                ) : (
                  <ul>
                    {initialProcess.events.slice(0, 8).map((event) => (
                      <li key={event.id}>
                        <strong>{event.description}</strong>
                        <span>{event.userName}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

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
