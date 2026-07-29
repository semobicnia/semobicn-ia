import type { BoundarySide, TopographicData } from "./topographic";

export type UrbanSketchSettings = {
  northAngle: number;
  scale: string;
  inclination: number;
  showBuilding: boolean;
  approximationNotice: boolean;
  vertexOffsets: [
    SketchPoint,
    SketchPoint,
    SketchPoint,
    SketchPoint,
  ];
};

const emptyVertexOffsets: UrbanSketchSettings["vertexOffsets"] = [
  { x: 0, y: 0 },
  { x: 0, y: 0 },
  { x: 0, y: 0 },
  { x: 0, y: 0 },
];

export const defaultUrbanSketchSettings: UrbanSketchSettings = {
  northAngle: 0,
  scale: "1:250",
  inclination: 8,
  showBuilding: true,
  approximationNotice: true,
  vertexOffsets: emptyVertexOffsets,
};

export type SketchPoint = {
  x: number;
  y: number;
};

export type SketchGeometry = {
  points: [SketchPoint, SketchPoint, SketchPoint, SketchPoint];
  width: number;
  height: number;
};

function boundaryMeasurement(data: TopographicData, side: BoundarySide) {
  return data.boundaries.find((boundary) => boundary.side === side)?.measurement;
}

export function getSketchMeasurements(data: TopographicData) {
  return {
    front: boundaryMeasurement(data, "front") || 1,
    right: boundaryMeasurement(data, "right") || 1,
    back: boundaryMeasurement(data, "back") || 1,
    left: boundaryMeasurement(data, "left") || 1,
  };
}

export function getSketchConfrontant(
  data: TopographicData,
  side: BoundarySide,
) {
  return (
    data.boundaries.find((boundary) => boundary.side === side)?.label ||
    "NÃO INFORMADO"
  );
}

export function buildSketchGeometry(
  data: TopographicData,
  settings: UrbanSketchSettings,
): SketchGeometry {
  const measurements = getSketchMeasurements(data);
  const averageDepth = Math.max((measurements.left + measurements.right) / 2, 1);
  const maxWidth = Math.max(measurements.front, measurements.back, 1);
  const width = 300;
  // Reserva a faixa superior para o mapa, a rosa dos ventos e o título.
  // Terrenos muito compridos continuam proporcionais sem invadir o cabeçalho.
  const height = Math.min(270, Math.max(205, (averageDepth / maxWidth) * 100));
  const frontWidth = (measurements.front / maxWidth) * width;
  const backWidth = (measurements.back / maxWidth) * width;
  const inclination = Math.max(-50, Math.min(50, settings.inclination));
  const centerX = 300;
  const bottomY = 575;
  const topY = bottomY - height;
  const basePoints: SketchGeometry["points"] = [
    { x: centerX - frontWidth / 2, y: bottomY },
    { x: centerX + frontWidth / 2, y: bottomY },
    { x: centerX + inclination + backWidth / 2, y: topY },
    { x: centerX + inclination - backWidth / 2, y: topY },
  ];
  const offsets =
    Array.isArray(settings.vertexOffsets) && settings.vertexOffsets.length === 4
      ? settings.vertexOffsets
      : emptyVertexOffsets;
  const limits = [
    { minX: 90, maxX: 295, minY: 430, maxY: 620 },
    { minX: 305, maxX: 510, minY: 430, maxY: 620 },
    { minX: 305, maxX: 510, minY: 295, maxY: 450 },
    { minX: 90, maxX: 295, minY: 295, maxY: 450 },
  ];
  const points = basePoints.map((point, index) => {
    const offset = offsets[index];
    const limit = limits[index];
    const x = point.x + (Number.isFinite(offset?.x) ? offset.x : 0);
    const y = point.y + (Number.isFinite(offset?.y) ? offset.y : 0);
    return {
      x: Math.max(limit.minX, Math.min(limit.maxX, x)),
      y: Math.max(limit.minY, Math.min(limit.maxY, y)),
    };
  }) as SketchGeometry["points"];

  return {
    points,
    width,
    height,
  };
}

export function formatMeasurement(value: number | null | undefined) {
  if (typeof value !== "number") return "-";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
