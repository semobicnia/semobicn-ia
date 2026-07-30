"use client";

import {
  Download,
  FileDown,
  ImagePlus,
  LoaderCircle,
  MoveDiagonal2,
  RotateCcw,
  Save,
} from "lucide-react";
import Link from "next/link";
import { PDFDocument } from "pdf-lib";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { AppHeader, type HeaderUser } from "./app-header";
import {
  buildSketchGeometry,
  defaultUrbanSketchSettings,
  formatMeasurement,
  getSketchConfrontant,
  getSketchMeasurements,
  type UrbanSketchSettings,
} from "@/lib/croqui";
import type {
  MunicipalSecretary,
  TopographicData,
} from "@/lib/topographic";

type Props = {
  currentUser: HeaderUser;
  processId?: string;
  data: TopographicData;
  municipalSecretary: MunicipalSecretary;
  initialSettings?: UrbanSketchSettings | null;
  initialLocationImageUrl?: string;
};

function serializeFinalSvg(svg: SVGSVGElement) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll("[data-editor-only]").forEach((element) => element.remove());
  return new XMLSerializer().serializeToString(clone);
}

function svgToDownload(svg: SVGSVGElement, filename: string) {
  const source = serializeFinalSvg(svg);
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function readFileAsDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Formato de imagem inválido."));
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(file);
  });
}

function safeFilename(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "imovel"
  );
}

function wrapText(text: string, maxLength: number, maxLines: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxLength) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    if (lines.length === maxLines - 1) {
      const remaining = [line, ...words.slice(index + 1)].join(" ");
      line =
        remaining.length > maxLength
          ? `${remaining.slice(0, maxLength - 1).trimEnd()}…`
          : remaining;
      break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

type DrawingPoint = { x: number; y: number };

function edgeLabel(
  start: DrawingPoint,
  end: DrawingPoint,
  offset: number,
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.max(Math.hypot(dx, dy), 1);
  let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  return {
    x: (start.x + end.x) / 2 + (-dy / length) * offset,
    y: (start.y + end.y) / 2 + (dx / length) * offset,
    angle,
  };
}

function formatDocumentDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value || "-";
}

export function CroquiWorkspace({
  currentUser,
  processId,
  data,
  municipalSecretary,
  initialSettings,
  initialLocationImageUrl,
}: Props) {
  const [settings, setSettings] = useState<UrbanSketchSettings>(() => ({
    ...defaultUrbanSketchSettings,
    ...initialSettings,
    claimantDocument: initialSettings?.claimantDocument || data.cpf,
  }));
  const [locationImage, setLocationImage] = useState<string | null>(null);
  const [semobiLogo, setSemobiLogo] = useState<string | null>(null);
  const [prefeituraLogo, setPrefeituraLogo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [editingVertices, setEditingVertices] = useState(false);
  const draggingVertex = useRef<number | null>(null);
  const [message, setMessage] = useState("");
  const geometry = useMemo(
    () => buildSketchGeometry(data, settings),
    [data, settings],
  );
  const baseGeometry = useMemo(
    () =>
      buildSketchGeometry(data, {
        ...settings,
        vertexOffsets: defaultUrbanSketchSettings.vertexOffsets,
      }),
    [
      data,
      settings.approximationNotice,
      settings.inclination,
      settings.northAngle,
      settings.scale,
      settings.showBuilding,
    ],
  );
  const measurements = getSketchMeasurements(data);
  const [frontUpper, frontLower, backLower, backUpper] = geometry.points;
  const polygon = geometry.points.map((point) => `${point.x},${point.y}`).join(" ");
  const claimant = data.claimantName.toUpperCase();
  const address = [
    data.propertyAddress,
    data.neighborhood,
    data.city,
    data.state,
  ]
    .filter(Boolean)
    .join(", ");
  const addressLines = wrapText(address, 82, 2);
  const frontMeasurementLabel = edgeLabel(frontUpper, frontLower, 14);
  const rightMeasurementLabel = edgeLabel(backUpper, frontUpper, 12);
  const leftMeasurementLabel = edgeLabel(frontLower, backLower, 12);
  const backMeasurementLabel = edgeLabel(backLower, backUpper, 14);
  const frontConfrontantLabel = edgeLabel(frontUpper, frontLower, 48);
  const rightConfrontantLabel = edgeLabel(backUpper, frontUpper, 37);
  const leftConfrontantLabel = edgeLabel(frontLower, backLower, 39);
  const backConfrontantLabel = edgeLabel(backLower, backUpper, 47);
  const plotCenter = geometry.points.reduce(
    (center, point) => ({
      x: center.x + point.x / 4,
      y: center.y + point.y / 4,
    }),
    { x: 0, y: 0 },
  );
  const plotAngleRadians = (rightMeasurementLabel.angle * Math.PI) / 180;
  const buildingCenter = {
    x: plotCenter.x - Math.cos(plotAngleRadians) * 72,
    y: plotCenter.y - Math.sin(plotAngleRadians) * 72,
  };

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/logo-semobi.png").then((response) => response.blob()),
      fetch("/logo-prefeitura.png").then((response) => response.blob()),
    ])
      .then(([semobi, prefeitura]) =>
        Promise.all([readFileAsDataUrl(semobi), readFileAsDataUrl(prefeitura)]),
      )
      .then(([semobi, prefeitura]) => {
        if (!active) return;
        setSemobiLogo(semobi);
        setPrefeituraLogo(prefeitura);
      })
      .catch(() => {
        if (active) setMessage("Não foi possível carregar as logos institucionais.");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!initialLocationImageUrl) return;
    let active = true;
    fetch(initialLocationImageUrl, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Imagem de localização indisponível.");
        return response.blob();
      })
      .then(readFileAsDataUrl)
      .then((dataUrl) => {
        if (active) setLocationImage(dataUrl);
      })
      .catch(() => {
        if (active) setMessage("Não foi possível carregar a imagem armazenada.");
      });
    return () => {
      active = false;
    };
  }, [initialLocationImageUrl]);

  function updateSetting<K extends keyof UrbanSketchSettings>(
    key: K,
    value: UrbanSketchSettings[K],
  ) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function selectLocationImage(file: File | null) {
    if (!file) return;
    setUploadingImage(true);
    setMessage("");
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setLocationImage(dataUrl);
      if (!processId) {
        setMessage("Imagem aplicada somente ao modelo de demonstração.");
        return;
      }
      const form = new FormData();
      form.append("processId", processId);
      form.append("file", file);
      const response = await fetch("/api/croquis/image", {
        method: "POST",
        body: form,
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || "Não foi possível armazenar a imagem.");
      }
      setMessage("Imagem de localização armazenada no processo.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível armazenar a imagem.",
      );
    } finally {
      setUploadingImage(false);
    }
  }

  async function generateA4Pdf() {
    const svg = document.querySelector<SVGSVGElement>("#urban-sketch-svg");
    if (!svg) return;
    setGeneratingPdf(true);
    setMessage("");
    let svgUrl = "";
    try {
      const source = serializeFinalSvg(svg);
      svgUrl = URL.createObjectURL(
        new Blob([source], { type: "image/svg+xml;charset=utf-8" }),
      );
      const image = new Image();
      image.src = svgUrl;
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Não foi possível renderizar o croqui."));
      });

      const canvas = document.createElement("canvas");
      canvas.width = 1190;
      canvas.height = 1684;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Não foi possível preparar o PDF.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pngBlob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (blob) =>
            blob ? resolve(blob) : reject(new Error("Falha ao montar a página A4.")),
          "image/png",
        ),
      );

      const pdf = await PDFDocument.create();
      pdf.setTitle(`Croqui urbano - ${data.claimantName}`);
      pdf.setAuthor("SEMOBI - Prefeitura de Coelho Neto");
      const page = pdf.addPage([595.28, 841.89]);
      const png = await pdf.embedPng(await pngBlob.arrayBuffer());
      page.drawImage(png, {
        x: 0,
        y: 0,
        width: page.getWidth(),
        height: page.getHeight(),
      });
      const bytes = await pdf.save();
      const url = URL.createObjectURL(
        new Blob([Uint8Array.from(bytes).buffer as ArrayBuffer], {
          type: "application/pdf",
        }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `croqui-urbano-${safeFilename(data.claimantName)}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("PDF A4 gerado com sucesso.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Não foi possível gerar o PDF.",
      );
    } finally {
      if (svgUrl) URL.revokeObjectURL(svgUrl);
      setGeneratingPdf(false);
    }
  }

  function moveVertex(
    index: number,
    event: ReactPointerEvent<SVGCircleElement>,
  ) {
    if (draggingVertex.current !== index) return;
    const svg = event.currentTarget.ownerSVGElement;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(matrix.inverse());
    const limits = [
      { minX: 85, maxX: 330, minY: 250, maxY: 500 },
      { minX: 70, maxX: 310, minY: 310, maxY: 570 },
      { minX: 330, maxX: 550, minY: 390, maxY: 650 },
      { minX: 350, maxX: 565, minY: 300, maxY: 590 },
    ];
    const limit = limits[index];
    const x = Math.max(limit.minX, Math.min(limit.maxX, local.x));
    const y = Math.max(limit.minY, Math.min(limit.maxY, local.y));
    setSettings((current) => {
      const offsets = current.vertexOffsets.map((offset) => ({ ...offset })) as
        UrbanSketchSettings["vertexOffsets"];
      offsets[index] = {
        x: x - baseGeometry.points[index].x,
        y: y - baseGeometry.points[index].y,
      };
      return { ...current, vertexOffsets: offsets };
    });
  }

  function restoreCalculatedShape() {
    updateSetting(
      "vertexOffsets",
      defaultUrbanSketchSettings.vertexOffsets.map((point) => ({ ...point })) as
        UrbanSketchSettings["vertexOffsets"],
    );
    setMessage("Formato calculado restaurado.");
  }

  async function saveSketch() {
    if (!processId) {
      setMessage("O modelo de demonstração não altera nenhum processo.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/croquis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processId, settings }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || "Não foi possível salvar o croqui.");
      }
      setMessage("Croqui salvo no processo.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Não foi possível salvar.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="croqui-page">
      <AppHeader currentUser={currentUser} />
      <div className="croqui-shell">
        <aside className="croqui-controls">
          <div>
            <p className="eyebrow">Agente de Croqui Urbano</p>
            <h1>Configurar desenho</h1>
            <p>
              O desenho usa as medidas já revisadas no processo e segue o
              padrão do croqui institucional enviado.
            </p>
          </div>

          <label className="field">
            <span>Imagem de localização</span>
            <span className="location-upload">
              <ImagePlus size={17} />
              Selecionar mapa ou imagem aérea
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) =>
                  void selectLocationImage(event.target.files?.[0] ?? null)
                }
                disabled={uploadingImage}
              />
              {uploadingImage ? " Armazenando..." : null}
            </span>
          </label>

          <label className="field">
            <span>Orientação do norte: {settings.northAngle}°</span>
            <input
              type="range"
              min="-180"
              max="180"
              value={settings.northAngle}
              onChange={(event) =>
                updateSetting("northAngle", Number(event.target.value))
              }
            />
          </label>

          <label className="field">
            <span>Inclinação do terreno: {settings.inclination}</span>
            <input
              type="range"
              min="-50"
              max="50"
              value={settings.inclination}
              onChange={(event) =>
                updateSetting("inclination", Number(event.target.value))
              }
            />
          </label>

          <label className="field">
            <span>Escala indicada</span>
            <select
              value={settings.scale}
              onChange={(event) => updateSetting("scale", event.target.value)}
            >
              <option value="1:100">1:100</option>
              <option value="1:200">1:200</option>
              <option value="1:250">1:250</option>
              <option value="1:500">1:500</option>
            </select>
          </label>

          <div className="croqui-code-fields">
            <label className="field">
              <span>BCI</span>
              <input
                value={settings.bci}
                onChange={(event) => updateSetting("bci", event.target.value)}
                placeholder="Ex.: 1029"
              />
            </label>
            <label className="field">
              <span>Número do croqui</span>
              <input
                value={settings.sketchNumber}
                onChange={(event) =>
                  updateSetting("sketchNumber", event.target.value)
                }
                placeholder="Ex.: 001"
              />
            </label>
          </div>
          <label className="field">
            <span>CPF/CNPJ do posseiro</span>
            <input
              value={settings.claimantDocument}
              onChange={(event) =>
                updateSetting("claimantDocument", event.target.value)
              }
              placeholder="Ex.: 000.000.000-00"
            />
          </label>

          <label className="check-row">
            <input
              type="checkbox"
              checked={settings.showBuilding}
              onChange={(event) =>
                updateSetting("showBuilding", event.target.checked)
              }
            />
            Mostrar área construída
          </label>

          <label className="check-row">
            <input
              type="checkbox"
              checked={settings.approximationNotice}
              onChange={(event) =>
                updateSetting("approximationNotice", event.target.checked)
              }
            />
            Exibir aviso de representação aproximada
          </label>

          <label className="check-row">
            <input
              type="checkbox"
              checked={editingVertices}
              onChange={(event) => setEditingVertices(event.target.checked)}
            />
            Ajustar vértices manualmente
          </label>
          {editingVertices && (
            <div className="vertex-editor-note">
              <MoveDiagonal2 size={16} />
              Arraste os quatro pontos azuis sobre a folha.
              <button type="button" onClick={restoreCalculatedShape}>
                Restaurar formato calculado
              </button>
            </div>
          )}

          <div className="croqui-measurements">
            <strong>Medidas utilizadas</strong>
            <span>Frente: {formatMeasurement(measurements.front)} m</span>
            <span>Direita: {formatMeasurement(measurements.right)} m</span>
            <span>Fundo: {formatMeasurement(measurements.back)} m</span>
            <span>Esquerda: {formatMeasurement(measurements.left)} m</span>
          </div>

          <div className="croqui-actions">
            <button className="button primary" onClick={saveSketch} disabled={saving}>
              <Save size={17} />
              {saving ? "Salvando..." : "Salvar croqui"}
            </button>
            <button
              className="button secondary"
              onClick={() => void generateA4Pdf()}
              type="button"
              disabled={generatingPdf}
            >
              {generatingPdf ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <FileDown size={17} />
              )}
              {generatingPdf ? "Gerando PDF..." : "Gerar PDF A4"}
            </button>
            <button
              className="button secondary"
              onClick={() => {
                const svg = document.querySelector<SVGSVGElement>(
                  "#urban-sketch-svg",
                );
                if (svg) {
                  svgToDownload(
                    svg,
                    `croqui-${claimant.toLowerCase().replaceAll(" ", "-")}.svg`,
                  );
                }
              }}
              type="button"
            >
              <Download size={17} />
              Baixar SVG
            </button>
            <button
              className="button ghost"
              onClick={() =>
                setSettings({
                  ...defaultUrbanSketchSettings,
                  claimantDocument: data.cpf,
                })
              }
              type="button"
            >
              <RotateCcw size={16} />
              Restaurar
            </button>
          </div>
          {message && <p className="croqui-message">{message}</p>}
          <Link
            className="back-process-link"
            href={processId ? `/processos/${processId}` : "/croquis"}
          >
            {processId
              ? "Voltar às informações topográficas"
              : "Voltar à lista de croquis"}
          </Link>
        </aside>

        <section className="croqui-preview">
          <svg
            id="urban-sketch-svg"
            viewBox="0 0 595 842"
            role="img"
            aria-label={`Croqui urbano de ${data.claimantName}`}
          >
            <defs>
              <pattern
                id="dotPattern"
                width="7"
                height="7"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="2" cy="2" r="0.45" fill="#b5babd" />
              </pattern>
              <pattern
                id="buildingHatch"
                width="6"
                height="6"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(25)"
              >
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="6"
                  stroke="#aeb4b8"
                  strokeWidth="1"
                />
              </pattern>
              <clipPath id="mapClip">
                <rect x="28" y="34" width="230" height="150" />
              </clipPath>
            </defs>
            <rect width="595" height="842" fill="white" />
            <rect
              x="6"
              y="6"
              width="583"
              height="830"
              fill="none"
              stroke="#111"
              strokeWidth="2.4"
            />

            <text x="143" y="27" textAnchor="middle" fontSize="13" fontWeight="700">
              Croqui de localização
            </text>
            <rect x="28" y="34" width="230" height="150" fill="#edf1f2" />
            {locationImage ? (
              <image
                href={locationImage}
                x="28"
                y="34"
                width="230"
                height="150"
                preserveAspectRatio="xMidYMid slice"
                clipPath="url(#mapClip)"
              />
            ) : (
              <g clipPath="url(#mapClip)">
                <rect x="28" y="34" width="230" height="150" fill="#bfccba" />
                <path
                  d="M20 154 L101 62 L157 159 L274 56"
                  fill="none"
                  stroke="#e6dfca"
                  strokeWidth="17"
                />
                <path
                  d="M16 76 L90 127 L154 53 L270 124"
                  fill="none"
                  stroke="#d7d8cb"
                  strokeWidth="11"
                />
                <text x="143" y="111" textAnchor="middle" fontSize="9" fill="#65746a">
                  IMAGEM DE LOCALIZAÇÃO
                </text>
                <rect
                  x="121"
                  y="73"
                  width="42"
                  height="75"
                  fill="#39a87855"
                  stroke="#158754"
                  strokeWidth="1.5"
                />
              </g>
            )}
            <g transform={`translate(500 106) rotate(${settings.northAngle})`}>
              <text x="0" y="-58" textAnchor="middle" fontSize="20" fontWeight="900">
                N
              </text>
              <path d="M0 -45 L-19 23 L0 10 L19 23 Z" fill="#111" />
              <path d="M0 -45 L0 10 L19 23 Z" fill="white" stroke="#111" strokeWidth="1" />
            </g>

            <line x1="8" y1="520" x2="190" y2="220" stroke="#111" strokeWidth="1.6" />
            <line x1="78" y1="590" x2="250" y2="300" stroke="#111" strokeWidth="1.6" />
            <text
              x={frontConfrontantLabel.x - 95}
              y={frontConfrontantLabel.y + 75}
              textAnchor="middle"
              fontSize="9"
              fontWeight="700"
              transform={`rotate(-59 ${frontConfrontantLabel.x - 95} ${frontConfrontantLabel.y + 75})`}
            >
              {getSketchConfrontant(data, "front").toUpperCase()}
            </text>

            <polygon
              points={polygon}
              fill="url(#dotPattern)"
              stroke="#111"
              strokeWidth="2.2"
            />
            {settings.showBuilding && data.builtArea && data.builtArea > 0 ? (
              <rect
                x={buildingCenter.x - 70}
                y={buildingCenter.y - 27}
                width="140"
                height="54"
                fill="url(#buildingHatch)"
                stroke="#7b8388"
                transform={`rotate(${rightMeasurementLabel.angle} ${buildingCenter.x} ${buildingCenter.y})`}
              />
            ) : null}

            {[
              [frontMeasurementLabel, measurements.front],
              [rightMeasurementLabel, measurements.right],
              [leftMeasurementLabel, measurements.left],
              [backMeasurementLabel, measurements.back],
            ].map(([placement, measurement], index) => {
              const label = placement as ReturnType<typeof edgeLabel>;
              return (
                <text
                  key={`measurement-${index}`}
                  x={label.x}
                  y={label.y}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="700"
                  transform={`rotate(${label.angle} ${label.x} ${label.y})`}
                >
                  {formatMeasurement(measurement as number)} m
                </text>
              );
            })}
            {[
              [rightConfrontantLabel, getSketchConfrontant(data, "right")],
              [leftConfrontantLabel, getSketchConfrontant(data, "left")],
              [backConfrontantLabel, getSketchConfrontant(data, "back")],
            ].map(([placement, confrontant], index) => {
              const label = placement as ReturnType<typeof edgeLabel>;
              return (
                <text
                  key={`confrontant-${index}`}
                  x={label.x}
                  y={label.y}
                  textAnchor="middle"
                  fontSize="8.2"
                  fontWeight="700"
                  transform={`rotate(${label.angle} ${label.x} ${label.y})`}
                >
                  {String(confrontant).toUpperCase()}
                </text>
              );
            })}

            {editingVertices &&
              geometry.points.map((point, index) => (
                <circle
                  key={`vertex-${index}`}
                  data-editor-only="true"
                  cx={point.x}
                  cy={point.y}
                  r="7"
                  fill="#1769e0"
                  stroke="white"
                  strokeWidth="2"
                  style={{ cursor: "move", touchAction: "none" }}
                  onPointerDown={(event) => {
                    draggingVertex.current = index;
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                  onPointerMove={(event) => moveVertex(index, event)}
                  onPointerUp={(event) => {
                    draggingVertex.current = null;
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }}
                  onPointerCancel={() => {
                    draggingVertex.current = null;
                  }}
                />
              ))}

            {settings.approximationNotice && (
              <text x="298" y="648" textAnchor="middle" fontSize="5.2" fill="#606b72">
                REPRESENTAÇÃO GRÁFICA APROXIMADA COM BASE NAS MEDIDAS INFORMADAS
              </text>
            )}

            {semobiLogo ? (
              <image
                href={semobiLogo}
                x="244"
                y="600"
                width="108"
                height="31"
                preserveAspectRatio="xMidYMid meet"
              />
            ) : (
              <text
                x="298"
                y="625"
                textAnchor="middle"
                fontSize="22"
                fontWeight="900"
                fill="#0b59ad"
              >
                SEMOBI
              </text>
            )}
            <text x="298" y="640" textAnchor="middle" fontSize="8.5" fontWeight="700">
              Secretaria Municipal de Obras e Infraestrutura
            </text>

            <rect x="10" y="652" width="575" height="27" rx="8" fill="white" stroke="#111" />
            <text x="297.5" y="671" textAnchor="middle" fontSize="14" fontWeight="800">
              PLANTA DE LOCALIZAÇÃO DE TERRENO
            </text>

            <rect x="10" y="683" width="575" height="61" rx="8" fill="white" stroke="#111" />
            <text x="18" y="700" fontSize="8.2">
              <tspan fontWeight="800">POSSEIRO:</tspan>
              <tspan dx="5" fontWeight="800">{claimant.slice(0, 52)}</tspan>
              <tspan dx="8" fontWeight="800">CPF/CNPJ:</tspan>
              <tspan dx="4">{settings.claimantDocument || "NÃO INFORMADO"}</tspan>
            </text>
            <text x="18" y="718" fontSize="8">
              <tspan fontWeight="700">BCI:</tspan> {settings.bci || "-"}
              <tspan dx="35" fontWeight="700">QUADRA:</tspan> {data.block || "-"}
              <tspan dx="35" fontWeight="700">LOTE:</tspan> {data.lot || "-"}
            </text>
            {addressLines.map((line, index) => (
              <text key={line} x="18" y={734 + index * 8} fontSize="7.5">
                {index === 0 ? "LOCALIZADO NA: " : ""}
                {line.toUpperCase()}
              </text>
            ))}

            <rect x="10" y="748" width="286" height="63" rx="7" fill="white" stroke="#111" />
            <line
              x1="153"
              y1="755"
              x2="153"
              y2="806"
              stroke="#c7ccd0"
              strokeWidth="0.8"
            />
            <line x1="27" y1="780" x2="136" y2="780" stroke="#444" strokeWidth="0.8" />
            <line x1="170" y1="780" x2="279" y2="780" stroke="#444" strokeWidth="0.8" />
            <text x="81.5" y="788" textAnchor="middle" fontSize="6.2">
              {municipalSecretary.fullName.slice(0, 34)}
            </text>
            <text x="81.5" y="796" textAnchor="middle" fontSize="5.4">
              {municipalSecretary.title}
            </text>
            <text x="81.5" y="805" textAnchor="middle" fontSize="5.4">
              {municipalSecretary.appointment}
            </text>
            <text x="224.5" y="788" textAnchor="middle" fontSize="6.2">
              {data.technicalResponsible.fullName.slice(0, 34)}
            </text>
            <text x="224.5" y="796" textAnchor="middle" fontSize="5.4">
              Responsável Técnico
            </text>
            <text x="224.5" y="805" textAnchor="middle" fontSize="5.4">
              {data.technicalResponsible.registration || ""}
            </text>

            <rect x="300" y="748" width="168" height="63" rx="7" fill="white" stroke="#111" />
            {prefeituraLogo ? (
              <image
                href={prefeituraLogo}
                x="331"
                y="750"
                width="106"
                height="27"
                preserveAspectRatio="xMidYMid meet"
              />
            ) : (
              <text x="384" y="769" textAnchor="middle" fontSize="11" fontWeight="900" fill="#0874bd">
                COELHO NETO
              </text>
            )}
            <text x="309" y="789" fontSize="6.8" fontWeight="800">
              MUNICÍPIO / UF:
            </text>
            <text x="384" y="803" textAnchor="middle" fontSize="9">
              COELHO NETO / MARANHÃO
            </text>

            <rect x="472" y="748" width="113" height="86" rx="7" fill="white" stroke="#111" />
            <text x="480" y="761" fontSize="6.3">ÁREA DO TERRENO:</text>
            <text x="528.5" y="781" textAnchor="middle" fontSize="12" fontWeight="800">
              {formatMeasurement(data.landArea)} m²
            </text>
            <text x="480" y="800" fontSize="6.3">ÁREA DA CONSTRUÇÃO:</text>
            <text x="528.5" y="824" textAnchor="middle" fontSize="12" fontWeight="800">
              {formatMeasurement(data.builtArea || 0)} m²
            </text>

            <rect x="10" y="815" width="91" height="19" rx="5" fill="white" stroke="#111" />
            <text x="17" y="823" fontSize="5.2" fontWeight="700">DATA:</text>
            <text x="55.5" y="831" textAnchor="middle" fontSize="6.8">
              {formatDocumentDate(data.documentDate)}
            </text>
            <rect x="105" y="815" width="91" height="19" rx="5" fill="white" stroke="#111" />
            <text x="112" y="823" fontSize="5.2" fontWeight="700">NÚMERO DO CROQUI:</text>
            <text x="150.5" y="831" textAnchor="middle" fontSize="6.8">{settings.sketchNumber || "001"}</text>
            <rect x="200" y="815" width="96" height="19" rx="5" fill="white" stroke="#111" />
            <text x="207" y="823" fontSize="5.2" fontWeight="700">ESCALA:</text>
            <text x="248" y="831" textAnchor="middle" fontSize="6.8">{settings.scale}</text>
            <rect x="300" y="815" width="168" height="19" rx="5" fill="white" stroke="#111" />
            <text x="307" y="823" fontSize="5.2" fontWeight="700">DESENHO:</text>
            <text x="384" y="831" textAnchor="middle" fontSize="6.6">
              {currentUser.name.slice(0, 36).toUpperCase() || "-"}
            </text>
          </svg>
        </section>
      </div>
    </main>
  );
}
