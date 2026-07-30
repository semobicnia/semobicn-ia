import type { BoundarySide, TopographicData } from "./topographic";

export type UrbanSketchSettings = {
  northAngle: number;
  scale: string;
  inclination: number;
  bci: string;
  sketchNumber: string;
  claimantDocument: string;
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
  scale: "1:200",
  inclination: 8,
  bci: "",
  sketchNumber: "001",
  claimantDocument: "",
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
  const maxDepth = Math.max(measurements.left, measurements.right, 1);
  const maxWidth = Math.max(measurements.front, measurements.back, 1);
  const length = Math.min(365, Math.max(285, (averageDepth / maxDepth) * 345));
  const frontWidth = Math.min(
    115,
    Math.max(62, (measurements.front / maxWidth) * 94),
  );
  const backWidth = Math.min(
    115,
    Math.max(62, (measurements.back / maxWidth) * 94),
  );
  const angle = ((25 + Math.max(-50, Math.min(50, settings.inclination)) * 0.35) *
    Math.PI) /
    180;
  const axisX = Math.cos(angle);
  const axisY = Math.sin(angle);
  const normalX = -axisY;
  const normalY = axisX;
  const centerX = 330;
  const centerY = 430;
  const frontCenter = {
    x: centerX - (axisX * length) / 2,
    y: centerY - (axisY * length) / 2,
  };
  const backCenter = {
    x: centerX + (axisX * length) / 2,
    y: centerY + (axisY * length) / 2,
  };
  const basePoints: SketchGeometry["points"] = [
    {
      x: frontCenter.x - (normalX * frontWidth) / 2,
      y: frontCenter.y - (normalY * frontWidth) / 2,
    },
    {
      x: frontCenter.x + (normalX * frontWidth) / 2,
      y: frontCenter.y + (normalY * frontWidth) / 2,
    },
    {
      x: backCenter.x + (normalX * backWidth) / 2,
      y: backCenter.y + (normalY * backWidth) / 2,
    },
    {
      x: backCenter.x - (normalX * backWidth) / 2,
      y: backCenter.y - (normalY * backWidth) / 2,
    },
  ];
  const offsets =
    Array.isArray(settings.vertexOffsets) && settings.vertexOffsets.length === 4
      ? settings.vertexOffsets
      : emptyVertexOffsets;
  const limits = [
    { minX: 85, maxX: 330, minY: 250, maxY: 500 },
    { minX: 70, maxX: 310, minY: 310, maxY: 570 },
    { minX: 330, maxX: 550, minY: 390, maxY: 650 },
    { minX: 350, maxX: 565, minY: 300, maxY: 590 },
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
    width: length,
    height: Math.max(frontWidth, backWidth),
  };
}

export function formatMeasurement(value: number | null | undefined) {
  if (typeof value !== "number") return "-";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
