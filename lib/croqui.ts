import type { BoundarySide, TopographicData } from "./topographic";

export type UrbanSketchSettings = {
  northAngle: number;
  scale: string;
  inclination: number;
  showBuilding: boolean;
  approximationNotice: boolean;
};

export const defaultUrbanSketchSettings: UrbanSketchSettings = {
  northAngle: 0,
  scale: "1:250",
  inclination: 8,
  showBuilding: true,
  approximationNotice: true,
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
  const height = Math.min(420, Math.max(235, (averageDepth / maxWidth) * 175));
  const frontWidth = (measurements.front / maxWidth) * width;
  const backWidth = (measurements.back / maxWidth) * width;
  const inclination = Math.max(-50, Math.min(50, settings.inclination));
  const centerX = 300;
  const bottomY = 590;
  const topY = bottomY - height;

  return {
    points: [
      { x: centerX - frontWidth / 2, y: bottomY },
      { x: centerX + frontWidth / 2, y: bottomY },
      { x: centerX + inclination + backWidth / 2, y: topY },
      { x: centerX + inclination - backWidth / 2, y: topY },
    ],
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

