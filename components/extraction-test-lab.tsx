"use client";

import {
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  LoaderCircle,
  Play,
  UploadCloud,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  boundaryLabels,
  type PlotEdge,
  type PlotGeometry,
  type PlotVertex,
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
  previewUrl: string;
};

const maxFileSize = 10_485_760;
const directUploadLimit = 3_800_000;

const shapeLabels: Record<PlotGeometry["shapeType"], string> = {
  square: "Quadrado",
  rectangle: "Retângulo",
  trapezoid: "Trapézio",
  irregular: "Polígono irregular",
  unknown: "Formato não identificado",
};

function formatNumber(value: number | null) {
  if (value === null) return "Não informado";
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(value);
}

function scaledVertices(vertices: PlotVertex[]) {
  const minX = Math.min(...vertices.map((point) => point.x));
  const maxX = Math.max(...vertices.map((point) => point.x));
  const minY = Math.min(...vertices.map((point) => point.y));
  const maxY = Math.max(...vertices.map((point) => point.y));
  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);
  const scale = Math.min(220 / width, 160 / height);
  return vertices.map((point) => ({
    x: 50 + (point.x - minX) * scale + (220 - width * scale) / 2,
    y: 38 + (point.y - minY) * scale + (160 - height * scale) / 2,
  }));
}

function edgeControl(
  start: PlotVertex,
  end: PlotVertex,
  centroid: PlotVertex,
  edge?: PlotEdge,
) {
  const middle = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const towardCenter = {
    x: centroid.x - middle.x,
    y: centroid.y - middle.y,
  };
  const centerLength = Math.max(
    Math.hypot(towardCenter.x, towardCenter.y),
    1,
  );
  const edgeLength = Math.max(Math.hypot(end.x - start.x, end.y - start.y), 1);
  const bulge = edge?.curved
    ? edge.curveBulge === 0
      ? 0.18
      : edge.curveBulge
    : 0;
  return {
    x:
      middle.x +
      (towardCenter.x / centerLength) * edgeLength * 0.42 * bulge,
    y:
      middle.y +
      (towardCenter.y / centerLength) * edgeLength * 0.42 * bulge,
  };
}

function SketchGeometryPreview({ geometry }: { geometry: PlotGeometry }) {
  if (geometry.vertices.length < 3) {
    return (
      <div className="test-sketch-empty">
        <AlertTriangle size={22} />
        O contorno não pôde ser reconstruído.
      </div>
    );
  }
  const points = scaledVertices(geometry.vertices);
  const centroid = points.reduce(
    (total, point) => ({
      x: total.x + point.x / points.length,
      y: total.y + point.y / points.length,
    }),
    { x: 0, y: 0 },
  );
  const edgeFor = (index: number) =>
    geometry.edges.find(
      (edge) =>
        edge.fromVertex === index &&
        edge.toVertex === (index + 1) % points.length,
    );
  let plotPath = `M ${points[0].x} ${points[0].y}`;
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    const edge = edgeFor(index);
    if (edge?.curved) {
      const control = edgeControl(point, next, centroid, edge);
      plotPath += ` Q ${control.x} ${control.y} ${next.x} ${next.y}`;
    } else {
      plotPath += ` L ${next.x} ${next.y}`;
    }
  });
  plotPath += " Z";

  return (
    <div className="test-sketch">
      <div className="test-sketch-heading">
        <strong>{shapeLabels[geometry.shapeType]}</strong>
        <span>
          {points.length} faces · confiança{" "}
          {Math.round(geometry.confidence * 100)}%
        </span>
      </div>
      <svg
        viewBox="0 0 320 245"
        role="img"
        aria-label={`Representação aproximada do terreno em formato ${shapeLabels[geometry.shapeType]}`}
      >
        <rect width="320" height="245" rx="10" fill="#fbfcfd" />
        {geometry.edges
          .filter(
            (edge) =>
              edge.isStreet &&
              points[edge.fromVertex] &&
              points[edge.toVertex],
          )
          .map((edge, index) => {
            const start = points[edge.fromVertex];
            const end = points[edge.toVertex];
            const middle = {
              x: (start.x + end.x) / 2,
              y: (start.y + end.y) / 2,
            };
            const away = {
              x: middle.x - centroid.x,
              y: middle.y - centroid.y,
            };
            const awayLength = Math.max(Math.hypot(away.x, away.y), 1);
            const normal = {
              x: away.x / awayLength,
              y: away.y / awayLength,
            };
            const roadStart = {
              x: start.x + normal.x * 13,
              y: start.y + normal.y * 13,
            };
            const roadEnd = {
              x: end.x + normal.x * 13,
              y: end.y + normal.y * 13,
            };
            const control = edgeControl(start, end, centroid, edge);
            const roadControl = {
              x: control.x + normal.x * 13,
              y: control.y + normal.y * 13,
            };
            const roadPath = edge.curved
              ? `M ${roadStart.x} ${roadStart.y} Q ${roadControl.x} ${roadControl.y} ${roadEnd.x} ${roadEnd.y}`
              : `M ${roadStart.x} ${roadStart.y} L ${roadEnd.x} ${roadEnd.y}`;
            let angle =
              (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI;
            if (angle > 90) angle -= 180;
            if (angle < -90) angle += 180;
            const label = edge.streetName || edge.label || "RUA";
            const labelPoint = {
              x: middle.x + normal.x * 28,
              y: middle.y + normal.y * 28,
            };
            return (
              <g key={`${edge.fromVertex}-${edge.toVertex}-${index}`}>
                <path
                  d={roadPath}
                  fill="none"
                  stroke="#c9d1d7"
                  strokeWidth="18"
                />
                <path
                  d={roadPath}
                  fill="none"
                  stroke="#53687b"
                  strokeWidth="1.2"
                />
                <text
                  x={labelPoint.x}
                  y={labelPoint.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="7"
                  fontWeight="800"
                  transform={`rotate(${angle} ${labelPoint.x} ${labelPoint.y})`}
                >
                  {label.toUpperCase().slice(0, 34)}
                </text>
              </g>
            );
          })}
        <path
          d={plotPath}
          fill="#dcecff"
          fillOpacity="0.76"
          stroke="#172b3a"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        {points.map((point, index) => (
          <g key={`plot-point-${index}`}>
            <circle cx={point.x} cy={point.y} r="3" fill="#1769e0" />
            <text
              x={point.x + 6}
              y={point.y - 5}
              fontSize="7"
              fontWeight="800"
              fill="#1769e0"
            >
              V{index + 1}
            </text>
          </g>
        ))}
        {geometry.edges.map((edge, index) => {
          const start = points[edge.fromVertex];
          const end = points[edge.toVertex];
          if (!start || !end) return null;
          const middle = {
            x: (start.x + end.x) / 2,
            y: (start.y + end.y) / 2,
          };
          return edge.measurement === null ? null : (
            <text
              key={`edge-measurement-${index}`}
              x={middle.x}
              y={middle.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="7.5"
              fontWeight="800"
              paintOrder="stroke"
              stroke="white"
              strokeWidth="3"
            >
              {formatNumber(edge.measurement)} m
            </text>
          );
        })}
      </svg>
      <small>
        Reconstrução aproximada para revisão; ruas e curvas seguem a leitura do
        desenho original.
      </small>
    </div>
  );
}

function SourcePreview({ item }: { item: TestItem }) {
  return (
    <div className="test-source-preview">
      <strong>Desenho enviado</strong>
      {item.file.type === "application/pdf" ? (
        <object
          data={item.previewUrl}
          type="application/pdf"
          aria-label={`PDF original ${item.file.name}`}
        >
          <span>O navegador não exibiu a prévia deste PDF.</span>
        </object>
      ) : (
        // The local object URL is used only for side-by-side visual review.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.previewUrl} alt={`Desenho original ${item.file.name}`} />
      )}
    </div>
  );
}

export function ExtractionTestLab() {
  const [items, setItems] = useState<TestItem[]>([]);
  const previewUrls = useRef<string[]>([]);
  const [supplementaryMessage, setSupplementaryMessage] = useState("");
  const running = items.some((item) => item.status === "running");
  const summary = useMemo(
    () => ({
      completed: items.filter((item) => item.status === "completed").length,
      errors: items.filter((item) => item.status === "error").length,
    }),
    [items],
  );

  useEffect(
    () => () => {
      previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  function selectFiles(files: FileList | null) {
    if (!files) return;
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current = [];
    setItems(
      Array.from(files).map((file, index) => {
        const previewUrl = URL.createObjectURL(file);
        previewUrls.current.push(previewUrl);
        return {
          id: `${file.name}-${file.lastModified}-${index}`,
          file,
          previewUrl,
          status: "pending",
          error:
            file.size > maxFileSize
              ? "Arquivo maior que 10 MB."
              : undefined,
        };
      }),
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
        const signatureResponse = await fetch("/api/uploads/source", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: item.file.name, purpose: "test" }),
        });
        const signatureText = await signatureResponse.text();
        let signature: {
          cloudName?: string;
          apiKey?: string;
          timestamp?: string;
          publicId?: string;
          type?: string;
          signature?: string;
          error?: string;
        } = {};
        try {
          signature = JSON.parse(signatureText) as typeof signature;
        } catch {
          throw new Error("Não foi possível preparar o arquivo de teste.");
        }

        let response: Response;
        if (
          signatureResponse.ok &&
          signature.cloudName &&
          signature.apiKey &&
          signature.timestamp &&
          signature.publicId &&
          signature.type &&
          signature.signature
        ) {
          const upload = new FormData();
          upload.append("file", item.file);
          upload.append("api_key", signature.apiKey);
          upload.append("timestamp", signature.timestamp);
          upload.append("public_id", signature.publicId);
          upload.append("type", signature.type);
          upload.append("signature", signature.signature);
          const uploadResponse = await fetch(
            `https://api.cloudinary.com/v1_1/${encodeURIComponent(signature.cloudName)}/raw/upload`,
            { method: "POST", body: upload },
          );
          const uploadedText = await uploadResponse.text();
          let uploaded: {
            public_id?: string;
            error?: { message?: string };
          } = {};
          try {
            uploaded = JSON.parse(uploadedText) as typeof uploaded;
          } catch {
            throw new Error("O armazenamento recusou o arquivo de teste.");
          }
          if (!uploadResponse.ok || !uploaded.public_id) {
            throw new Error(
              uploaded.error?.message ||
                "Não foi possível enviar o arquivo de teste.",
            );
          }
          response = await fetch("/api/test-analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filename: item.file.name,
              mimeType: item.file.type,
              supplementaryMessage,
              source: { publicId: uploaded.public_id },
            }),
          });
        } else if (
          signatureResponse.status === 503 &&
          item.file.size <= directUploadLimit
        ) {
          const form = new FormData();
          form.append("file", item.file);
          form.append("supplementaryMessage", supplementaryMessage);
          response = await fetch("/api/test-analyze", {
            method: "POST",
            body: form,
          });
        } else {
          throw new Error(
            signature.error ||
              "O armazenamento temporário não está disponível para este arquivo.",
          );
        }
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
            <p>PDF, JPG, PNG ou WebP. Até 10 MB por arquivo.</p>
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
                  <div className="test-visual-comparison">
                    <SourcePreview item={item} />
                    <SketchGeometryPreview geometry={item.data.plotGeometry} />
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
                    {item.data.plotGeometry.reviewNotes.length > 0 && (
                      <ul>
                        {item.data.plotGeometry.reviewNotes.map((note) => (
                          <li key={`geometry-${note}`}>{note}</li>
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
