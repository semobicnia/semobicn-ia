import type { PlotEdge, PlotVertex } from "./topographic";

type Point = { x: number; y: number };

export type AreaCalculationResult = {
  landArea: number | null;
  builtArea: number | null;
  method:
    | "coordinates"
    | "measured_geometry"
    | "opposite_sides"
    | "unavailable";
  approximate: boolean;
};

function polygonArea(points: Point[]) {
  if (points.length < 3) return 0;
  return Math.abs(
    points.reduce((sum, point, index) => {
      const next = points[(index + 1) % points.length];
      return sum + point.x * next.y - next.x * point.y;
    }, 0) / 2,
  );
}

function parseCoordinate(value: string) {
  const normalized = value
    .trim()
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundArea(value: number) {
  return Math.round(value * 100) / 100;
}

function integerInWords(value: number): string {
  const units = [
    "zero", "um", "dois", "três", "quatro",
    "cinco", "seis", "sete", "oito", "nove",
  ];
  const teens = [
    "dez", "onze", "doze", "treze", "quatorze",
    "quinze", "dezesseis", "dezessete", "dezoito", "dezenove",
  ];
  const tens = [
    "", "", "vinte", "trinta", "quarenta",
    "cinquenta", "sessenta", "setenta", "oitenta", "noventa",
  ];
  const hundreds = [
    "", "cento", "duzentos", "trezentos", "quatrocentos",
    "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos",
  ];
  const underThousand = (number: number) => {
    if (number === 100) return "cem";
    const parts: string[] = [];
    const hundred = Math.floor(number / 100);
    const remainder = number % 100;
    if (hundred) parts.push(hundreds[hundred]);
    if (remainder >= 10 && remainder < 20) {
      parts.push(teens[remainder - 10]);
    } else {
      const ten = Math.floor(remainder / 10);
      const unit = remainder % 10;
      if (ten) parts.push(tens[ten]);
      if (unit) parts.push(units[unit]);
    }
    return parts.join(" e ") || units[0];
  };

  if (value < 1000) return underThousand(value);
  if (value < 1_000_000) {
    const thousands = Math.floor(value / 1000);
    const remainder = value % 1000;
    const prefix =
      thousands === 1 ? "mil" : underThousand(thousands) + " mil";
    return remainder ? prefix + " e " + underThousand(remainder) : prefix;
  }
  const millions = Math.floor(value / 1_000_000);
  const remainder = value % 1_000_000;
  const prefix =
    millions === 1
      ? "um milhão"
      : integerInWords(millions) + " milhões";
  return remainder ? prefix + " e " + integerInWords(remainder) : prefix;
}

export function areaInWords(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return "";
  }
  const rounded = roundArea(value);
  const integer = Math.floor(rounded);
  const fraction = rounded.toFixed(2).split(".")[1].replace(/0+$/, "");
  const amount = fraction
    ? integerInWords(integer) + " vírgula " + integerInWords(Number(fraction))
    : integerInWords(integer);
  return (
    amount + (rounded === 1 ? " metro quadrado" : " metros quadrados")
  );
}

function scaleFromMeasuredEdges(points: Point[], edges: PlotEdge[]) {
  let weightedMeasurements = 0;
  let squaredDrawingLengths = 0;

  edges.forEach((edge) => {
    if (!edge.measurement || edge.measurement <= 0) return;
    const start = points[edge.fromVertex];
    const end = points[edge.toVertex];
    if (!start || !end) return;
    const drawingLength = Math.hypot(end.x - start.x, end.y - start.y);
    if (drawingLength <= 0) return;
    weightedMeasurements += drawingLength * edge.measurement;
    squaredDrawingLengths += drawingLength * drawingLength;
  });

  return squaredDrawingLengths > 0
    ? weightedMeasurements / squaredDrawingLengths
    : null;
}

function calculateBuildingArea(
  buildings: Point[][],
  drawingLandArea: number,
  landArea: number,
  scale: number | null,
) {
  const drawingBuiltArea = buildings.reduce(
    (sum, building) => sum + polygonArea(building),
    0,
  );
  if (drawingBuiltArea <= 0) return null;
  if (scale && scale > 0) return roundArea(drawingBuiltArea * scale * scale);
  if (drawingLandArea > 0 && landArea > 0) {
    return roundArea((drawingBuiltArea / drawingLandArea) * landArea);
  }
  return null;
}

export function calculateSketchAreas({
  vertices,
  drawingPoints,
  edges,
  buildings,
  oppositeSides,
}: {
  vertices: PlotVertex[];
  drawingPoints?: Point[];
  edges: PlotEdge[];
  buildings: Point[][];
  oppositeSides?: {
    front: number | null;
    right: number | null;
    back: number | null;
    left: number | null;
  };
}): AreaCalculationResult {
  const coordinatePoints = vertices.map((vertex) => ({
    x: parseCoordinate(vertex.coordinateX),
    y: parseCoordinate(vertex.coordinateY),
  }));
  const hasCoordinates =
    coordinatePoints.length >= 3 &&
    coordinatePoints.every(
      (point) => typeof point.x === "number" && typeof point.y === "number",
    );

  const plotPoints =
    drawingPoints && drawingPoints.length >= 3
      ? drawingPoints
      : vertices.map(({ x, y }) => ({ x, y }));
  const drawingLandArea = polygonArea(plotPoints);

  if (hasCoordinates) {
    const landArea = roundArea(
      polygonArea(
        coordinatePoints.map((point) => ({ x: point.x!, y: point.y! })),
      ),
    );
    return {
      landArea,
      builtArea: calculateBuildingArea(
        buildings,
        drawingLandArea,
        landArea,
        null,
      ),
      method: "coordinates",
      approximate: false,
    };
  }

  const scale = scaleFromMeasuredEdges(plotPoints, edges);
  if (drawingLandArea > 0 && scale && scale > 0) {
    const landArea = roundArea(drawingLandArea * scale * scale);
    return {
      landArea,
      builtArea: calculateBuildingArea(
        buildings,
        drawingLandArea,
        landArea,
        scale,
      ),
      method: "measured_geometry",
      approximate: true,
    };
  }

  if (oppositeSides) {
    const widths = [oppositeSides.front, oppositeSides.back].filter(
      (value): value is number => typeof value === "number" && value > 0,
    );
    const depths = [oppositeSides.left, oppositeSides.right].filter(
      (value): value is number => typeof value === "number" && value > 0,
    );
    if (widths.length > 0 && depths.length > 0) {
      const width = widths.reduce((sum, value) => sum + value, 0) / widths.length;
      const depth = depths.reduce((sum, value) => sum + value, 0) / depths.length;
      const landArea = roundArea(width * depth);
      return {
        landArea,
        builtArea: calculateBuildingArea(
          buildings,
          drawingLandArea,
          landArea,
          null,
        ),
        method: "opposite_sides",
        approximate: true,
      };
    }
  }

  return {
    landArea: null,
    builtArea: null,
    method: "unavailable",
    approximate: true,
  };
}
