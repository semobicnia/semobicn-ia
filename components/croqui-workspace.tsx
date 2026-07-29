"use client";

import {
  Download,
  FileDown,
  ImagePlus,
  LoaderCircle,
  RotateCcw,
  Save,
} from "lucide-react";
import Link from "next/link";
import { PDFDocument } from "pdf-lib";
import { useEffect, useMemo, useState } from "react";
import { AppHeader, type HeaderUser } from "./app-header";
import {
  buildSketchGeometry,
  defaultUrbanSketchSettings,
  formatMeasurement,
  getSketchConfrontant,
  getSketchMeasurements,
  type UrbanSketchSettings,
} from "@/lib/croqui";
import type { TopographicData } from "@/lib/topographic";

type Props = {
  currentUser: HeaderUser;
  processId?: string;
  data: TopographicData;
  initialSettings?: UrbanSketchSettings | null;
  initialLocationImageUrl?: string;
};

function svgToDownload(svg: SVGSVGElement, filename: string) {
  const source = new XMLSerializer().serializeToString(svg);
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

export function CroquiWorkspace({
  currentUser,
  processId,
  data,
  initialSettings,
  initialLocationImageUrl,
}: Props) {
  const [settings, setSettings] = useState<UrbanSketchSettings>(
    initialSettings ?? defaultUrbanSketchSettings,
  );
  const [locationImage, setLocationImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [message, setMessage] = useState("");
  const geometry = useMemo(
    () => buildSketchGeometry(data, settings),
    [data, settings],
  );
  const measurements = getSketchMeasurements(data);
  const [bottomLeft, bottomRight, topRight, topLeft] = geometry.points;
  const polygon = geometry.points.map((point) => `${point.x},${point.y}`).join(" ");
  const claimant = data.claimantName.toUpperCase();
  const description = [
    "CROQUI DE TERRENO URBANO SITUADO NA",
    data.propertyAddress,
    data.neighborhood ? `BAIRRO ${data.neighborhood}` : "",
    data.block ? `QUADRA ${data.block}` : "",
    data.lot ? `LOTE ${data.lot}` : "",
    `${data.city} - ${data.state}`,
  ]
    .filter(Boolean)
    .join(", ")
    .toUpperCase();
  const descriptionLines = wrapText(description, 62, 2);

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
      const source = new XMLSerializer().serializeToString(svg);
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
              onClick={() => setSettings(defaultUrbanSketchSettings)}
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
                width="8"
                height="8"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="2" cy="2" r="0.7" fill="#99a1a7" />
              </pattern>
              <clipPath id="mapClip">
                <rect x="18" y="18" width="360" height="228" />
              </clipPath>
            </defs>
            <rect width="595" height="842" fill="white" />
            <rect x="18" y="18" width="559" height="806" fill="none" stroke="#111" />

            <rect x="18" y="18" width="360" height="228" fill="#edf1f2" stroke="#111" />
            {locationImage ? (
              <image
                href={locationImage}
                x="18"
                y="18"
                width="360"
                height="228"
                preserveAspectRatio="xMidYMid slice"
                clipPath="url(#mapClip)"
              />
            ) : (
              <>
                <path d="M45 218 L140 75 L218 185 L350 55" fill="none" stroke="#c4cdd2" strokeWidth="14" />
                <path d="M28 106 L122 165 L206 65 L365 155" fill="none" stroke="#d7dee2" strokeWidth="9" />
                <text x="198" y="128" textAnchor="middle" fontSize="12" fill="#72808a">
                  INSIRA A IMAGEM DE LOCALIZAÇÃO
                </text>
                <rect x="171" y="78" width="62" height="105" fill="#39a87855" stroke="#158754" strokeWidth="2" />
              </>
            )}
            <text x="27" y="32" fontSize="8" fontWeight="700">MAPA DE LOCALIZAÇÃO</text>

            <rect x="378" y="18" width="199" height="228" fill="white" stroke="#111" />
            <g transform={`translate(478 124) rotate(${settings.northAngle})`}>
              <text x="0" y="-48" textAnchor="middle" fontSize="22" fontWeight="900">N</text>
              <path d="M0 -37 L-15 13 L0 4 L15 13 Z" fill="#111" />
            </g>

            <line x1="18" y1="246" x2="577" y2="246" stroke="#111" />
            <text x="102" y="268" fontSize="17">Layout de Localização</text>
            <line x1="102" y1="273" x2="254" y2="273" stroke="#111" />
            <text x="112" y="288" fontSize="12">(Vista Parcial do Bairro)</text>

            <polygon points={polygon} fill="url(#dotPattern)" stroke="#111" strokeWidth="3" />
            {settings.showBuilding && data.builtArea && data.builtArea > 0 ? (
              <rect
                x={(bottomLeft.x + bottomRight.x) / 2 - 54}
                y={bottomLeft.y - 112}
                width="108"
                height="100"
                fill="white"
                stroke="#91999e"
              />
            ) : null}

            <line x1={bottomLeft.x} y1={bottomLeft.y + 19} x2={bottomRight.x} y2={bottomRight.y + 19} stroke="#111" />
            <text x={(bottomLeft.x + bottomRight.x) / 2} y={bottomLeft.y + 34} textAnchor="middle" fontSize="11">
              {formatMeasurement(measurements.front)}
            </text>
            <line x1={topLeft.x} y1={topLeft.y - 8} x2={topRight.x} y2={topRight.y - 8} stroke="#111" />
            <text x={(topLeft.x + topRight.x) / 2} y={topLeft.y - 12} textAnchor="middle" fontSize="10">
              {formatMeasurement(measurements.back)}
            </text>
            <text
              x={bottomRight.x + 12}
              y={(bottomRight.y + topRight.y) / 2}
              fontSize="11"
              transform={`rotate(75 ${bottomRight.x + 12} ${(bottomRight.y + topRight.y) / 2})`}
            >
              {formatMeasurement(measurements.right)}
            </text>
            <text
              x={bottomLeft.x - 8}
              y={(bottomLeft.y + topLeft.y) / 2}
              fontSize="11"
              transform={`rotate(75 ${bottomLeft.x - 8} ${(bottomLeft.y + topLeft.y) / 2})`}
            >
              {formatMeasurement(measurements.left)}
            </text>

            <text x="300" y={topLeft.y + 15} textAnchor="middle" fontSize="9">
              {getSketchConfrontant(data, "back").toUpperCase()}
            </text>
            <text x={topRight.x + 50} y={(topRight.y + bottomRight.y) / 2} fontSize="10" transform={`rotate(75 ${topRight.x + 50} ${(topRight.y + bottomRight.y) / 2})`}>
              {getSketchConfrontant(data, "right").toUpperCase()}
            </text>
            <text x={topLeft.x - 42} y={(topLeft.y + bottomLeft.y) / 2} textAnchor="middle" fontSize="10" transform={`rotate(75 ${topLeft.x - 42} ${(topLeft.y + bottomLeft.y) / 2})`}>
              {getSketchConfrontant(data, "left").toUpperCase()}
            </text>

            <path d={`M65 ${bottomLeft.y + 48} Q300 ${bottomLeft.y + 16} 540 ${bottomRight.y + 42}`} fill="none" stroke="#111" strokeWidth="2" />
            <path d={`M65 ${bottomLeft.y + 84} Q300 ${bottomLeft.y + 52} 540 ${bottomRight.y + 78}`} fill="none" stroke="#111" strokeWidth="2" />
            <text x="300" y={bottomLeft.y + 72} textAnchor="middle" fontSize="12">
              {getSketchConfrontant(data, "front").toUpperCase()}
            </text>
            <text x="35" y="682" fontSize="12">Escala: {settings.scale}</text>

            {settings.approximationNotice && (
              <text x="300" y="702" textAnchor="middle" fontSize="7" fill="#606b72">
                REPRESENTAÇÃO GRÁFICA APROXIMADA COM BASE NAS MEDIDAS INFORMADAS
              </text>
            )}

            <rect x="18" y="712" width="559" height="112" fill="white" stroke="#111" />
            <line x1="180" y1="712" x2="180" y2="824" stroke="#111" />
            <line x1="460" y1="712" x2="460" y2="824" stroke="#111" />
            <line x1="180" y1="764" x2="460" y2="764" stroke="#111" />
            <text x="99" y="753" textAnchor="middle" fontSize="20" fontWeight="900" fill="#0874bd">COELHO NETO</text>
            <text x="99" y="777" textAnchor="middle" fontSize="16" fontWeight="900" fill="#0874bd">SEMOBI</text>
            <text x="99" y="794" textAnchor="middle" fontSize="4.7" fontWeight="700">SECRETARIA MUNICIPAL DE OBRAS E INFRAESTRUTURA</text>
            <text x="188" y="727" fontSize="9" fontWeight="700">CROQUI DE TERRENO URBANO</text>
            {descriptionLines.map((line, index) => (
              <text key={line} x="188" y={740 + index * 10} fontSize="6.5">
                {line}
              </text>
            ))}
            <text x="188" y="779" fontSize="7">POSSEIRO(A):</text>
            <text x="188" y="794" fontSize="9" fontWeight="800">{claimant.slice(0, 42)}</text>
            <text x="188" y="810" fontSize="8">CPF/CNPJ: {data.cpf || "NÃO INFORMADO"}</text>
            <text x="468" y="731" fontSize="8.5">Terreno: {formatMeasurement(data.landArea)} m²</text>
            <text x="468" y="749" fontSize="7">Quadra: {data.block || "-"}</text>
            <text x="468" y="762" fontSize="7">Lote: {data.lot || "-"}</text>
            <text x="468" y="791" fontSize="7">{data.technicalResponsible.fullName.slice(0, 23)}</text>
            <text x="468" y="804" fontSize="6">RESPONSÁVEL TÉCNICO</text>
          </svg>
        </section>
      </div>
    </main>
  );
}
