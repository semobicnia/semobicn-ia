import type {
  BoundarySide,
  PlotEdge,
  TopographicData,
} from "./topographic";
import { areaInWords } from "./area-calculation";

export type UrbanSketchBoundaryOverride = {
  side: BoundarySide;
  label: string;
  measurement: number | null;
};

export type UrbanSketchDataOverrides = {
  requestNumber: string;
  claimantName: string;
  propertyAddress: string;
  block: string;
  lot: string;
  landArea: number | null;
  builtArea: number | null;
  boundaries: UrbanSketchBoundaryOverride[];
  edges: PlotEdge[];
  vertices: Array<{
    coordinateX: string;
    coordinateY: string;
  }>;
};

export type UrbanSketchLayoutOffsets = {
  plot: SketchPoint;
  table: SketchPoint;
  buildings: SketchPoint[];
  measurementTexts: SketchPoint[];
  confrontantTexts: SketchPoint[];
  streetTexts: SketchPoint[];
  /** Posição antiga, mantida somente para carregar croquis já salvos. */
  edgeTexts?: SketchPoint[];
};

export type UrbanSketchTextRotations = {
  measurementTexts: number[];
  confrontantTexts: number[];
  streetTexts: number[];
};

export type UrbanSketchSettings = {
  northAngle: number;
  scale: string;
  inclination: number;
  bci: string;
  sketchNumber: string;
  claimantDocument: string;
  dataReviewConfirmed: boolean;
  dataOverrides?: UrbanSketchDataOverrides;
  showBuilding: boolean;
  approximationNotice: boolean;
  vertexOffsets: SketchPoint[];
  buildingVertexOffsets: SketchPoint[][];
  layoutOffsets: UrbanSketchLayoutOffsets;
  textRotations: UrbanSketchTextRotations;
  hiddenElements: string[];
};

const emptyVertexOffsets: UrbanSketchSettings["vertexOffsets"] = [
  { x: 0, y: 0 },
  { x: 0, y: 0 },
  { x: 0, y: 0 },
  { x: 0, y: 0 },
];

const zeroPoint = () => ({ x: 0, y: 0 });

export function createDefaultLayoutOffsets(data: TopographicData) {
  const edgeCount =
    data.plotGeometry.edges.length >= 3 ? data.plotGeometry.edges.length : 4;
  const buildingCount = Math.max(data.plotGeometry.buildings.length, 1);
  return {
    plot: zeroPoint(),
    table: zeroPoint(),
    buildings: Array.from({ length: buildingCount }, zeroPoint),
    measurementTexts: Array.from({ length: edgeCount }, zeroPoint),
    confrontantTexts: Array.from({ length: edgeCount }, zeroPoint),
    streetTexts: Array.from({ length: edgeCount }, zeroPoint),
  } satisfies UrbanSketchLayoutOffsets;
}

export function normalizeLayoutOffsets(
  data: TopographicData,
  saved?: Partial<UrbanSketchLayoutOffsets>,
) {
  const defaults = createDefaultLayoutOffsets(data);
  const point = (value: SketchPoint | undefined) => ({
    x: Number.isFinite(value?.x) ? value!.x : 0,
    y: Number.isFinite(value?.y) ? value!.y : 0,
  });
  return {
    plot: point(saved?.plot),
    table: point(saved?.table),
    buildings: defaults.buildings.map((_, index) =>
      point(saved?.buildings?.[index]),
    ),
    measurementTexts: defaults.measurementTexts.map((_, index) =>
      point(saved?.measurementTexts?.[index] ?? saved?.edgeTexts?.[index]),
    ),
    confrontantTexts: defaults.confrontantTexts.map((_, index) =>
      point(saved?.confrontantTexts?.[index] ?? saved?.edgeTexts?.[index]),
    ),
    streetTexts: defaults.streetTexts.map((_, index) =>
      point(saved?.streetTexts?.[index]),
    ),
  } satisfies UrbanSketchLayoutOffsets;
}

export function createDefaultTextRotations(data: TopographicData) {
  const edgeCount =
    data.plotGeometry.edges.length >= 3 ? data.plotGeometry.edges.length : 4;
  return {
    measurementTexts: Array.from({ length: edgeCount }, () => 0),
    confrontantTexts: Array.from({ length: edgeCount }, () => 0),
    streetTexts: Array.from({ length: edgeCount }, () => 0),
  } satisfies UrbanSketchTextRotations;
}

export function normalizeTextRotations(
  data: TopographicData,
  saved?: Partial<UrbanSketchTextRotations>,
) {
  const defaults = createDefaultTextRotations(data);
  const angle = (value: number | undefined) =>
    Number.isFinite(value) ? Math.max(-180, Math.min(180, value!)) : 0;
  return {
    measurementTexts: defaults.measurementTexts.map((_, index) =>
      angle(saved?.measurementTexts?.[index]),
    ),
    confrontantTexts: defaults.confrontantTexts.map((_, index) =>
      angle(saved?.confrontantTexts?.[index]),
    ),
    streetTexts: defaults.streetTexts.map((_, index) =>
      angle(saved?.streetTexts?.[index]),
    ),
  } satisfies UrbanSketchTextRotations;
}

export const defaultUrbanSketchSettings: UrbanSketchSettings = {
  northAngle: 0,
  scale: "1:200",
  inclination: 0,
  bci: "",
  sketchNumber: "001",
  claimantDocument: "",
  dataReviewConfirmed: false,
  showBuilding: true,
  approximationNotice: true,
  vertexOffsets: emptyVertexOffsets,
  buildingVertexOffsets: [],
  layoutOffsets: {
    plot: { x: 0, y: 0 },
    table: { x: 0, y: 0 },
    buildings: [{ x: 0, y: 0 }],
    measurementTexts: Array.from({ length: 4 }, zeroPoint),
    confrontantTexts: Array.from({ length: 4 }, zeroPoint),
    streetTexts: Array.from({ length: 4 }, zeroPoint),
  },
  textRotations: {
    measurementTexts: Array.from({ length: 4 }, () => 0),
    confrontantTexts: Array.from({ length: 4 }, () => 0),
    streetTexts: Array.from({ length: 4 }, () => 0),
  },
  hiddenElements: [],
};

export function createSketchDataOverrides(
  data: TopographicData,
  saved?: UrbanSketchDataOverrides,
): UrbanSketchDataOverrides {
  const boundaries = data.boundaries.map((boundary, index) => {
    const stored =
      saved?.boundaries[index] ??
      saved?.boundaries.find((item) => item.side === boundary.side);
    return {
      side: stored?.side ?? boundary.side,
      label: stored?.label ?? boundary.label,
      measurement: stored ? stored.measurement : boundary.measurement,
    };
  });
  if (saved?.boundaries.length && saved.boundaries.length > boundaries.length) {
    boundaries.push(
      ...saved.boundaries.slice(boundaries.length, 12).map((boundary) => ({
        ...boundary,
      })),
    );
  }
  return {
    requestNumber: saved?.requestNumber ?? data.requestNumber,
    claimantName: saved?.claimantName ?? data.claimantName,
    propertyAddress: saved?.propertyAddress ?? data.propertyAddress,
    block: saved?.block ?? data.block,
    lot: saved?.lot ?? data.lot,
    landArea: saved ? saved.landArea : data.landArea,
    builtArea: saved ? saved.builtArea : data.builtArea,
    vertices: data.plotGeometry.vertices.map((vertex, index) => ({
      coordinateX:
        saved?.vertices?.[index]?.coordinateX ?? vertex.coordinateX,
      coordinateY:
        saved?.vertices?.[index]?.coordinateY ?? vertex.coordinateY,
    })),
    edges: data.plotGeometry.edges.map((edge, index) => ({
      ...edge,
      ...(saved?.edges?.[index] ?? {}),
      fromVertex: edge.fromVertex,
      toVertex: edge.toVertex,
    })),
    boundaries,
  };
}

export function applySketchDataOverrides(
  data: TopographicData,
  overrides?: UrbanSketchDataOverrides,
): TopographicData {
  if (!overrides) return data;
  return {
    ...data,
    requestNumber: overrides.requestNumber,
    claimantName: overrides.claimantName,
    propertyAddress: overrides.propertyAddress,
    block: overrides.block,
    lot: overrides.lot,
    landArea: overrides.landArea,
    landAreaInWords: areaInWords(overrides.landArea),
    builtArea: overrides.builtArea,
    builtAreaInWords: areaInWords(overrides.builtArea),
    plotGeometry: {
      ...data.plotGeometry,
      vertices: data.plotGeometry.vertices.map((vertex, index) => ({
        ...vertex,
        coordinateX:
          overrides.vertices[index]?.coordinateX ?? vertex.coordinateX,
        coordinateY:
          overrides.vertices[index]?.coordinateY ?? vertex.coordinateY,
      })),
      edges: data.plotGeometry.edges.map((edge, index) => ({
        ...edge,
        ...(overrides.edges[index] ?? {}),
        fromVertex: edge.fromVertex,
        toVertex: edge.toVertex,
      })),
    },
    boundaries: overrides.boundaries.map((corrected, index) => ({
      ...(data.boundaries[index] ?? {
        side: corrected.side,
        label: "",
        measurement: null,
        measurementInWords: "",
      }),
      side: corrected.side,
      label: corrected.label,
      measurement: corrected.measurement,
    })),
  };
}

export type SketchPoint = {
  x: number;
  y: number;
};

export type SketchGeometry = {
  points: SketchPoint[];
  edges: PlotEdge[];
  buildings: SketchPoint[][];
  sourceBased: boolean;
  width: number;
  height: number;
};

export function sketchVertexCount(data: TopographicData) {
  return data.plotGeometry.vertices.length >= 3
    ? data.plotGeometry.vertices.length
    : 4;
}

export function createEmptyVertexOffsets(data: TopographicData) {
  return Array.from({ length: sketchVertexCount(data) }, () => ({ x: 0, y: 0 }));
}

export function createEmptyBuildingVertexOffsets(data: TopographicData) {
  return data.plotGeometry.buildings.map((building) =>
    building.vertices.map(() => zeroPoint()),
  );
}

export function normalizeBuildingVertexOffsets(
  data: TopographicData,
  saved?: SketchPoint[][],
) {
  return data.plotGeometry.buildings.map((building, buildingIndex) =>
    building.vertices.map((_, vertexIndex) => {
      const point = saved?.[buildingIndex]?.[vertexIndex];
      return {
        x: Number.isFinite(point?.x) ? point!.x : 0,
        y: Number.isFinite(point?.y) ? point!.y : 0,
      };
    }),
  );
}

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
  const sourceBased =
    data.plotGeometry.vertices.length >= 3 &&
    data.plotGeometry.edges.length >= 3;
  if (sourceBased) {
    const sourcePoints = data.plotGeometry.vertices;
    const minX = Math.min(...sourcePoints.map((point) => point.x));
    const maxX = Math.max(...sourcePoints.map((point) => point.x));
    const minY = Math.min(...sourcePoints.map((point) => point.y));
    const maxY = Math.max(...sourcePoints.map((point) => point.y));
    const sourceWidth = Math.max(maxX - minX, 1);
    const sourceHeight = Math.max(maxY - minY, 1);
    const reservePerimeterTable = sourcePoints.length > 4;
    const scale = Math.min(
      (reservePerimeterTable ? 300 : 405) / sourceWidth,
      300 / sourceHeight,
    );
    const centerX = reservePerimeterTable ? 220 : 315;
    const centerY = 430;
    const rotation = (Math.max(-50, Math.min(50, settings.inclination)) * Math.PI) / 180;
    const mapPoint = (point: SketchPoint) => {
      const unrotated = {
        x: centerX + (point.x - (minX + maxX) / 2) * scale,
        y: centerY + (point.y - (minY + maxY) / 2) * scale,
      };
      const dx = unrotated.x - centerX;
      const dy = unrotated.y - centerY;
      return {
        x: centerX + dx * Math.cos(rotation) - dy * Math.sin(rotation),
        y: centerY + dx * Math.sin(rotation) + dy * Math.cos(rotation),
      };
    };
    const basePoints = sourcePoints.map(mapPoint);
    const offsets =
      Array.isArray(settings.vertexOffsets) &&
      settings.vertexOffsets.length === basePoints.length
        ? settings.vertexOffsets
        : createEmptyVertexOffsets(data);
    const points = basePoints.map((point, index) => ({
      x: Math.max(45, Math.min(565, point.x + (offsets[index]?.x || 0))) +
        (settings.layoutOffsets?.plot?.x || 0),
      y: Math.max(210, Math.min(590, point.y + (offsets[index]?.y || 0))) +
        (settings.layoutOffsets?.plot?.y || 0),
    }));
    const plotOffset = settings.layoutOffsets?.plot || zeroPoint();
    const buildingOffsets = settings.layoutOffsets?.buildings || [];
    const buildingVertexOffsets = settings.buildingVertexOffsets || [];
    return {
      points,
      edges: data.plotGeometry.edges,
      buildings: data.plotGeometry.buildings.map((building, buildingIndex) =>
        building.vertices.map((point, vertexIndex) => {
          const mapped = mapPoint(point);
          const offset = buildingOffsets[buildingIndex] || zeroPoint();
          const vertexOffset =
            buildingVertexOffsets[buildingIndex]?.[vertexIndex] || zeroPoint();
          return {
            x: mapped.x + plotOffset.x + offset.x + vertexOffset.x,
            y: mapped.y + plotOffset.y + offset.y + vertexOffset.y,
          };
        }),
      ),
      sourceBased: true,
      width: sourceWidth * scale,
      height: sourceHeight * scale,
    };
  }

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
  const basePoints: SketchPoint[] = [
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
      x: Math.max(limit.minX, Math.min(limit.maxX, x)) +
        (settings.layoutOffsets?.plot?.x || 0),
      y: Math.max(limit.minY, Math.min(limit.maxY, y)) +
        (settings.layoutOffsets?.plot?.y || 0),
    };
  });

  const front = data.boundaries.find((boundary) => boundary.side === "front");
  const right = data.boundaries.find((boundary) => boundary.side === "right");
  const left = data.boundaries.find((boundary) => boundary.side === "left");
  const back = data.boundaries.find((boundary) => boundary.side === "back");
  const edge = (
    fromVertex: number,
    toVertex: number,
    boundary: typeof front,
    isStreet = false,
  ): PlotEdge => ({
    fromVertex,
    toVertex,
    label: boundary?.label || "NÃO INFORMADO",
    measurement: boundary?.measurement ?? null,
    isStreet,
    streetName: isStreet ? boundary?.label || "RUA" : "",
    curved: false,
    curveBulge: 0,
  });

  return {
    points,
    edges: [
      edge(0, 1, front, true),
      edge(1, 2, left),
      edge(2, 3, back),
      edge(3, 0, right),
    ],
    buildings: [],
    sourceBased: false,
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
