"use client";

import {
  ArrowRight,
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
  applySketchDataOverrides,
  buildSketchGeometry,
  createEmptyVertexOffsets,
  createSketchDataOverrides,
  defaultUrbanSketchSettings,
  formatMeasurement,
  type UrbanSketchBoundaryOverride,
  type UrbanSketchDataOverrides,
  type UrbanSketchSettings,
} from "@/lib/croqui";
import type {
  BoundarySide,
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

const sketchBoundaryLabels: Record<BoundarySide, string> = {
  front: "Frente / rua",
  right: "Flanco direito",
  left: "Flanco esquerdo",
  back: "Fundo",
};

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

function outwardEdgeLabel(
  start: DrawingPoint,
  end: DrawingPoint,
  center: DrawingPoint,
  offset: number,
) {
  const middle = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const away = { x: middle.x - center.x, y: middle.y - center.y };
  const length = Math.max(Math.hypot(away.x, away.y), 1);
  const placement = edgeLabel(start, end, 0);
  return {
    x: middle.x + (away.x / length) * offset,
    y: middle.y + (away.y / length) * offset,
    angle: placement.angle,
    normalX: away.x / length,
    normalY: away.y / length,
  };
}

function curveControl(
  start: DrawingPoint,
  end: DrawingPoint,
  center: DrawingPoint,
  curved: boolean,
  bulge: number,
) {
  const middle = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const toward = { x: center.x - middle.x, y: center.y - middle.y };
  const centerLength = Math.max(Math.hypot(toward.x, toward.y), 1);
  const edgeLength = Math.max(Math.hypot(end.x - start.x, end.y - start.y), 1);
  const amount = curved ? (bulge === 0 ? 0.18 : bulge) : 0;
  return {
    x: middle.x + (toward.x / centerLength) * edgeLength * 0.42 * amount,
    y: middle.y + (toward.y / centerLength) * edgeLength * 0.42 * amount,
  };
}

function streetLabelFontSize(label: string) {
  if (label.length > 38) return 6.6;
  if (label.length > 30) return 7.2;
  if (label.length > 22) return 8;
  return 9;
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
  const [settings, setSettings] = useState<UrbanSketchSettings>(() => {
    const emptyOffsets = createEmptyVertexOffsets(data);
    const savedOffsets = initialSettings?.vertexOffsets;
    return {
      ...defaultUrbanSketchSettings,
      ...initialSettings,
      northAngle:
        initialSettings?.northAngle ?? data.plotGeometry.northAngle ?? 0,
      inclination: initialSettings?.inclination ?? 0,
      bci: initialSettings?.bci || data.bci,
      claimantDocument: initialSettings?.claimantDocument || data.cpf,
      vertexOffsets:
        Array.isArray(savedOffsets) && savedOffsets.length === emptyOffsets.length
          ? savedOffsets
          : emptyOffsets,
      dataOverrides: createSketchDataOverrides(
        data,
        initialSettings?.dataOverrides,
      ),
    };
  });
  const [locationImage, setLocationImage] = useState<string | null>(null);
  const [semobiLogo, setSemobiLogo] = useState<string | null>(null);
  const [prefeituraLogo, setPrefeituraLogo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [editingVertices, setEditingVertices] = useState(false);
  const draggingVertex = useRef<number | null>(null);
  const [message, setMessage] = useState("");
  const dataOverrides = useMemo(
    () => createSketchDataOverrides(data, settings.dataOverrides),
    [data, settings.dataOverrides],
  );
  const effectiveData = useMemo(
    () => applySketchDataOverrides(data, dataOverrides),
    [data, dataOverrides],
  );
  const geometry = useMemo(
    () => buildSketchGeometry(effectiveData, settings),
    [effectiveData, settings],
  );
  const baseGeometry = useMemo(
    () =>
      buildSketchGeometry(effectiveData, {
        ...settings,
        vertexOffsets: createEmptyVertexOffsets(effectiveData),
      }),
    [
      effectiveData,
      settings.approximationNotice,
      settings.inclination,
      settings.northAngle,
      settings.scale,
      settings.showBuilding,
    ],
  );
  const claimant = effectiveData.claimantName.toUpperCase();
  const address = [
    effectiveData.propertyAddress,
    effectiveData.neighborhood,
    effectiveData.city,
    effectiveData.state,
  ]
    .filter(Boolean)
    .join(", ");
  const addressLines = wrapText(address, 82, 2);
  const plotCenter = geometry.points.reduce(
    (center, point) => ({
      x: center.x + point.x / geometry.points.length,
      y: center.y + point.y / geometry.points.length,
    }),
    { x: 0, y: 0 },
  );
  let plotPath = geometry.points.length
    ? `M ${geometry.points[0].x} ${geometry.points[0].y}`
    : "";
  geometry.points.forEach((point, index) => {
    const next = geometry.points[(index + 1) % geometry.points.length];
    const edge = geometry.edges.find(
      (candidate) =>
        candidate.fromVertex === index &&
        candidate.toVertex === (index + 1) % geometry.points.length,
    );
    if (edge?.curved) {
      const control = curveControl(
        point,
        next,
        plotCenter,
        edge.curved,
        edge.curveBulge,
      );
      plotPath += ` Q ${control.x} ${control.y} ${next.x} ${next.y}`;
    } else {
      plotPath += ` L ${next.x} ${next.y}`;
    }
  });
  plotPath += " Z";
  const fallbackBuildingAngle = geometry.points[0] && geometry.points[1]
    ? edgeLabel(geometry.points[0], geometry.points[1], 0).angle
    : 0;
  const plotAngleRadians = (fallbackBuildingAngle * Math.PI) / 180;
  const buildingCenter = {
    x: plotCenter.x - Math.cos(plotAngleRadians) * 72,
    y: plotCenter.y - Math.sin(plotAngleRadians) * 72,
  };
  const perimeterRows = geometry.points.map((_, index) => ({
    from: index,
    to: (index + 1) % geometry.points.length,
    edge: geometry.edges.find(
      (candidate) =>
        candidate.fromVertex === index &&
        candidate.toVertex === (index + 1) % geometry.points.length,
    ),
    coordinateX: effectiveData.plotGeometry.vertices[index]?.coordinateX || "",
    coordinateY: effectiveData.plotGeometry.vertices[index]?.coordinateY || "",
  }));
  const hasVertexCoordinates =
    perimeterRows.length > 0 &&
    perimeterRows.every((row) => row.coordinateX && row.coordinateY);
  const perimeterTable = {
    x: hasVertexCoordinates ? 388 : 470,
    y: 198,
    width: hasVertexCoordinates ? 197 : 110,
    headerHeight: 17,
    rowHeight: 14,
  };
  const perimeterTableHeight =
    perimeterTable.headerHeight + perimeterRows.length * perimeterTable.rowHeight;

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

  function updateDataOverride<
    K extends keyof Omit<UrbanSketchDataOverrides, "boundaries">,
  >(
    key: K,
    value: UrbanSketchDataOverrides[K],
  ) {
    setSettings((current) => ({
      ...current,
      dataOverrides: {
        ...createSketchDataOverrides(data, current.dataOverrides),
        [key]: value,
      },
    }));
  }

  function updateBoundaryOverride(
    side: BoundarySide,
    key: keyof Omit<UrbanSketchBoundaryOverride, "side">,
    value: string | number | null,
  ) {
    setSettings((current) => {
      const overrides = createSketchDataOverrides(data, current.dataOverrides);
      return {
        ...current,
        dataOverrides: {
          ...overrides,
          boundaries: overrides.boundaries.map((boundary) =>
            boundary.side === side
              ? { ...boundary, [key]: value }
              : boundary,
          ),
        },
      };
    });
  }

  function updateVertexCoordinate(
    index: number,
    key: "coordinateX" | "coordinateY",
    value: string,
  ) {
    setSettings((current) => {
      const overrides = createSketchDataOverrides(data, current.dataOverrides);
      return {
        ...current,
        dataOverrides: {
          ...overrides,
          vertices: overrides.vertices.map((vertex, vertexIndex) =>
            vertexIndex === index ? { ...vertex, [key]: value } : vertex,
          ),
        },
      };
    });
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
    if (!svg) return false;
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
      pdf.setTitle(`Croqui urbano - ${effectiveData.claimantName}`);
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
      anchor.download = `croqui-urbano-${safeFilename(effectiveData.claimantName)}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("PDF A4 gerado com sucesso.");
      return true;
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Não foi possível gerar o PDF.",
      );
      return false;
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
    const x = Math.max(45, Math.min(565, local.x));
    const y = Math.max(210, Math.min(590, local.y));
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
      createEmptyVertexOffsets(effectiveData),
    );
    setMessage("Formato calculado restaurado.");
  }

  async function saveSketch(finalize = false) {
    if (!processId) {
      setMessage("O modelo de demonstração não altera nenhum processo.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      if (finalize) {
        const documentData = {
          ...effectiveData,
          bci: settings.bci.trim(),
          cpf: settings.claimantDocument.trim() || effectiveData.cpf,
        };
        const processResponse = await fetch(`/api/processes/${processId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: documentData, status: "review" }),
        });
        const processResult = (await processResponse.json()) as {
          error?: string;
        };
        if (!processResponse.ok) {
          throw new Error(
            processResult.error ||
              "Não foi possível preparar as Informações Topográficas.",
          );
        }
        const generated = await generateA4Pdf();
        if (!generated) {
          throw new Error(
            "O croqui precisa ser gerado antes das Informações Topográficas.",
          );
        }
      }
      const response = await fetch("/api/croquis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processId, settings, finalize }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || "Não foi possível salvar o croqui.");
      }
      if (finalize) {
        window.location.href = `/processos/${processId}`;
        return;
      }
      setMessage("Rascunho do croqui salvo no processo.");
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
            <h1>Revisar e concluir croqui</h1>
            <p>
              A análise inicial preenche o desenho. Confira e corrija os dados
              antes de avançar para as Informações Topográficas.
            </p>
          </div>
          <div className="croqui-flow-stage">
            <span>Etapa 2 de 3</span>
            <strong>Croqui urbano</strong>
            <small>Próxima: Informações Topográficas</small>
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

          <section className="croqui-correction-panel">
            <div>
              <strong>Correção dos dados interpretados</strong>
              <p>
                Edite qualquer informação que não corresponda ao desenho
                original.
              </p>
            </div>
            <label className="field">
              <span>Número do requerimento</span>
              <input
                value={dataOverrides.requestNumber}
                onChange={(event) =>
                  updateDataOverride("requestNumber", event.target.value)
                }
              />
            </label>
            <label className="field">
              <span>Nome do posseiro</span>
              <input
                value={dataOverrides.claimantName}
                onChange={(event) =>
                  updateDataOverride("claimantName", event.target.value)
                }
              />
            </label>
            <label className="field">
              <span>Localização / endereço</span>
              <input
                value={dataOverrides.propertyAddress}
                onChange={(event) =>
                  updateDataOverride("propertyAddress", event.target.value)
                }
              />
            </label>
            <div className="croqui-code-fields">
              <label className="field">
                <span>Quadra</span>
                <input
                  value={dataOverrides.block}
                  onChange={(event) =>
                    updateDataOverride("block", event.target.value)
                  }
                />
              </label>
              <label className="field">
                <span>Lote</span>
                <input
                  value={dataOverrides.lot}
                  onChange={(event) =>
                    updateDataOverride("lot", event.target.value)
                  }
                />
              </label>
            </div>
            <div className="croqui-code-fields">
              <label className="field">
                <span>Área do terreno (m²)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={dataOverrides.landArea ?? ""}
                  onChange={(event) =>
                    updateDataOverride(
                      "landArea",
                      event.target.value === ""
                        ? null
                        : Number(event.target.value),
                    )
                  }
                />
              </label>
              <label className="field">
                <span>Área da construção (m²)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={dataOverrides.builtArea ?? ""}
                  onChange={(event) =>
                    updateDataOverride(
                      "builtArea",
                      event.target.value === ""
                        ? null
                        : Number(event.target.value),
                    )
                  }
                />
              </label>
            </div>
            <div className="croqui-boundary-corrections">
              <strong>Rua, limites e medidas</strong>
              {dataOverrides.boundaries.map((boundary) => (
                <div className="croqui-boundary-correction" key={boundary.side}>
                  <label className="field">
                    <span>{sketchBoundaryLabels[boundary.side]}</span>
                    <input
                      value={boundary.label}
                      onChange={(event) =>
                        updateBoundaryOverride(
                          boundary.side,
                          "label",
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Medida (m)</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={boundary.measurement ?? ""}
                      onChange={(event) =>
                        updateBoundaryOverride(
                          boundary.side,
                          "measurement",
                          event.target.value === ""
                            ? null
                            : Number(event.target.value),
                        )
                      }
                    />
                  </label>
                </div>
              ))}
            </div>
            {dataOverrides.vertices.length > 0 && (
              <div className="croqui-boundary-corrections">
                <strong>Coordenadas dos vértices</strong>
                {dataOverrides.vertices.map((vertex, index) => (
                  <div className="croqui-boundary-correction" key={`vertex-coordinate-${index}`}>
                    <label className="field">
                      <span>P{index + 1} - Coord. X</span>
                      <input
                        value={vertex.coordinateX}
                        onChange={(event) =>
                          updateVertexCoordinate(index, "coordinateX", event.target.value)
                        }
                        placeholder="Não informada"
                      />
                    </label>
                    <label className="field">
                      <span>P{index + 1} - Coord. Y</span>
                      <input
                        value={vertex.coordinateY}
                        onChange={(event) =>
                          updateVertexCoordinate(index, "coordinateY", event.target.value)
                        }
                        placeholder="Não informada"
                      />
                    </label>
                  </div>
                ))}
              </div>
            )}
          </section>

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
              Arraste os {geometry.points.length} pontos azuis sobre a folha.
              <button type="button" onClick={restoreCalculatedShape}>
                Restaurar formato calculado
              </button>
            </div>
          )}

          <div className="croqui-measurements">
            <strong>Medidas utilizadas</strong>
            {geometry.edges.map((edge, index) => (
              <span key={`used-measurement-${index}`}>
                P{edge.fromVertex + 1} - P{edge.toVertex + 1}: {formatMeasurement(edge.measurement)} m
              </span>
            ))}
          </div>

          <div className="croqui-actions">
            {processId && (
              <button
                className="button primary"
                onClick={() => void saveSketch(true)}
                disabled={saving}
                type="button"
              >
                <ArrowRight size={17} />
                {saving
                  ? "Gerando e concluindo croqui..."
                  : "Gerar croqui e continuar"}
              </button>
            )}
            <button
              className="button secondary"
              onClick={() => void saveSketch(false)}
              disabled={saving}
              type="button"
            >
              <Save size={17} />
              {saving ? "Salvando..." : "Salvar rascunho"}
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
                  northAngle: data.plotGeometry.northAngle ?? 0,
                  claimantDocument: data.cpf,
                  bci: data.bci,
                  vertexOffsets: createEmptyVertexOffsets(data),
                  dataOverrides: createSketchDataOverrides(data),
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
            href="/croquis"
          >
            Voltar à lista de croquis
          </Link>
        </aside>

        <section className="croqui-preview">
          <svg
            id="urban-sketch-svg"
            viewBox="0 0 595 842"
            role="img"
            aria-label={`Croqui urbano de ${effectiveData.claimantName}`}
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

            {geometry.edges
              .filter(
                (edge) =>
                  edge.isStreet &&
                  geometry.points[edge.fromVertex] &&
                  geometry.points[edge.toVertex],
              )
              .map((edge, index) => {
                const start = geometry.points[edge.fromVertex];
                const end = geometry.points[edge.toVertex];
                const placement = outwardEdgeLabel(start, end, plotCenter, 0);
                const edgeLength = Math.max(Math.hypot(end.x - start.x, end.y - start.y), 1);
                const tangentX = (end.x - start.x) / edgeLength;
                const tangentY = (end.y - start.y) / edgeLength;
                const extension = edge.curved ? 0 : Math.min(70, edgeLength * 0.45);
                const control = curveControl(start, end, plotCenter, edge.curved, edge.curveBulge);
                const pathAt = (offset: number) => {
                  const startX = start.x + placement.normalX * offset - tangentX * extension;
                  const startY = start.y + placement.normalY * offset - tangentY * extension;
                  const endX = end.x + placement.normalX * offset + tangentX * extension;
                  const endY = end.y + placement.normalY * offset + tangentY * extension;
                  return edge.curved
                    ? `M ${startX} ${startY} Q ${control.x + placement.normalX * offset} ${control.y + placement.normalY * offset} ${endX} ${endY}`
                    : `M ${startX} ${startY} L ${endX} ${endY}`;
                };
                const streetName = (edge.streetName || edge.label || "RUA").toUpperCase();
                const name = outwardEdgeLabel(start, end, plotCenter, 20);
                return (
                  <g key={`street-${edge.fromVertex}-${edge.toVertex}-${index}`}>
                    <path d={pathAt(11)} fill="none" stroke="#111" strokeWidth="1" />
                    <path d={pathAt(44)} fill="none" stroke="#111" strokeWidth="1" />
                    <text
                      x={name.x}
                      y={name.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={streetLabelFontSize(streetName)}
                      fontWeight="400"
                      transform={`rotate(${name.angle} ${name.x} ${name.y})`}
                    >
                      {streetName.slice(0, 38)}
                    </text>
                  </g>
                );
              })}

            <path
              d={plotPath}
              fill="url(#dotPattern)"
              stroke="#111"
              strokeWidth="2.2"
            />
            {settings.showBuilding && geometry.buildings.length > 0
              ? geometry.buildings.map((building, index) => (
                  <polygon
                    key={`building-shape-${index}`}
                    points={building.map((point) => `${point.x},${point.y}`).join(" ")}
                    fill="url(#buildingHatch)"
                    stroke="#7b8388"
                    strokeWidth="1"
                  />
                ))
              : null}
            {settings.showBuilding &&
            geometry.buildings.length === 0 &&
            effectiveData.builtArea &&
            effectiveData.builtArea > 0 ? (
              <rect
                x={buildingCenter.x - 70}
                y={buildingCenter.y - 27}
                width="140"
                height="54"
                fill="url(#buildingHatch)"
                stroke="#7b8388"
                transform={`rotate(${fallbackBuildingAngle} ${buildingCenter.x} ${buildingCenter.y})`}
              />
            ) : null}

            {geometry.edges.map((edge, index) => {
              const start = geometry.points[edge.fromVertex];
              const end = geometry.points[edge.toVertex];
              if (!start || !end) return null;
              const measurement = outwardEdgeLabel(
                start,
                end,
                plotCenter,
                edge.isStreet ? -13 : 13,
              );
              const confrontant = outwardEdgeLabel(start, end, plotCenter, 34);
              return (
                <g key={`edge-details-${index}`}>
                  {edge.measurement !== null && (
                    <text
                      x={measurement.x}
                      y={measurement.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="9"
                      fontWeight="700"
                      paintOrder="stroke"
                      stroke="white"
                      strokeWidth="3"
                      transform={`rotate(${measurement.angle} ${measurement.x} ${measurement.y})`}
                    >
                      {formatMeasurement(edge.measurement)} m
                    </text>
                  )}
                  {!edge.isStreet && edge.label && (
                    <text
                      x={confrontant.x}
                      y={confrontant.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="8.2"
                      fontWeight="400"
                      paintOrder="stroke"
                      stroke="white"
                      strokeWidth="3"
                      transform={`rotate(${confrontant.angle} ${confrontant.x} ${confrontant.y})`}
                    >
                      {edge.label.toUpperCase().slice(0, 38)}
                    </text>
                  )}
                </g>
              );
            })}

            {geometry.points.map((point, index) => {
              const touchesStreet = geometry.edges.some(
                (edge) => edge.isStreet &&
                  (edge.fromVertex === index || edge.toVertex === index),
              );
              const horizontalDirection = point.x < plotCenter.x ? -1 : 1;
              const awayX = point.x - plotCenter.x;
              const awayY = point.y - plotCenter.y;
              const awayLength = Math.max(Math.hypot(awayX, awayY), 1);
              const labelX = touchesStreet
                ? point.x + horizontalDirection * 5
                : point.x + (awayX / awayLength) * 9;
              const labelY = touchesStreet
                ? point.y
                : point.y + (awayY / awayLength) * 9;
              return (
                <g key={`permanent-vertex-${index}`}>
                  <circle cx={point.x} cy={point.y} r="1.6" fill="#111" />
                  <text
                    x={labelX}
                    y={labelY}
                    textAnchor={touchesStreet ? (horizontalDirection < 0 ? "end" : "start") : "middle"}
                    dominantBaseline="middle"
                    fontSize="7.5"
                    fontWeight="700"
                    paintOrder="stroke"
                    stroke="white"
                    strokeWidth="2.5"
                  >
                    P{index + 1}
                  </text>
                </g>
              );
            })}

            <g aria-label="Tabela de pontos e perímetro">
              <rect
                x={perimeterTable.x}
                y={perimeterTable.y}
                width={perimeterTable.width}
                height={perimeterTableHeight}
                fill="white"
                fillOpacity="0.97"
                stroke="#111"
                strokeWidth="0.6"
              />
              <line
                x1={perimeterTable.x}
                y1={perimeterTable.y + perimeterTable.headerHeight}
                x2={perimeterTable.x + perimeterTable.width}
                y2={perimeterTable.y + perimeterTable.headerHeight}
                stroke="#111"
                strokeWidth="0.5"
              />
              {(hasVertexCoordinates ? [36, 98, 160] : [44]).map((offset) => (
                <line
                  key={`perimeter-column-${offset}`}
                  x1={perimeterTable.x + offset}
                  y1={perimeterTable.y}
                  x2={perimeterTable.x + offset}
                  y2={perimeterTable.y + perimeterTableHeight}
                  stroke="#111"
                  strokeWidth="0.5"
                />
              ))}
              <text
                x={perimeterTable.x + (hasVertexCoordinates ? 18 : 22)}
                y={perimeterTable.y + 11.5}
                textAnchor="middle"
                fontSize="6.5"
                fontWeight="500"
              >
                PONTO
              </text>
              {hasVertexCoordinates && (
                <>
                  <text x={perimeterTable.x + 67} y={perimeterTable.y + 11.5} textAnchor="middle" fontSize="6.5">
                    COORD. X
                  </text>
                  <text x={perimeterTable.x + 129} y={perimeterTable.y + 11.5} textAnchor="middle" fontSize="6.5">
                    COORD. Y
                  </text>
                </>
              )}
              <text
                x={perimeterTable.x + (hasVertexCoordinates ? 178.5 : 77)}
                y={perimeterTable.y + 11.5}
                textAnchor="middle"
                fontSize="6.5"
              >
                DIST.
              </text>
              {perimeterRows.map((row, index) => {
                const rowY =
                  perimeterTable.y +
                  perimeterTable.headerHeight +
                  index * perimeterTable.rowHeight;
                return (
                  <g key={`perimeter-row-${row.from}-${row.to}`}>
                    {index > 0 && (
                      <line
                        x1={perimeterTable.x}
                        y1={rowY}
                        x2={perimeterTable.x + perimeterTable.width}
                        y2={rowY}
                        stroke="#777"
                        strokeWidth="0.45"
                      />
                    )}
                    <text
                      x={perimeterTable.x + (hasVertexCoordinates ? 18 : 22)}
                      y={rowY + 9.5}
                      textAnchor="middle"
                      fontSize="6.7"
                    >
                      P{row.from + 1}
                    </text>
                    {hasVertexCoordinates && (
                      <>
                        <text x={perimeterTable.x + 67} y={rowY + 9.5} textAnchor="middle" fontSize="6.4">
                          {row.coordinateX}
                        </text>
                        <text x={perimeterTable.x + 129} y={rowY + 9.5} textAnchor="middle" fontSize="6.4">
                          {row.coordinateY}
                        </text>
                      </>
                    )}
                    <text
                      x={perimeterTable.x + (hasVertexCoordinates ? 178.5 : 77)}
                      y={rowY + 9.5}
                      textAnchor="middle"
                      fontSize="6.7"
                    >
                      {row.edge?.measurement === null || row.edge?.measurement === undefined
                        ? "-"
                        : formatMeasurement(row.edge.measurement)}
                    </text>
                  </g>
                );
              })}
            </g>

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
              <tspan dx="35" fontWeight="700">QUADRA:</tspan>{" "}
              {effectiveData.block || "-"}
              <tspan dx="35" fontWeight="700">LOTE:</tspan>{" "}
              {effectiveData.lot || "-"}
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
              {formatMeasurement(effectiveData.landArea)} m²
            </text>
            <text x="480" y="800" fontSize="6.3">ÁREA DA CONSTRUÇÃO:</text>
            <text x="528.5" y="824" textAnchor="middle" fontSize="12" fontWeight="800">
              {formatMeasurement(effectiveData.builtArea || 0)} m²
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
