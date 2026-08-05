import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth";
import { saveUrbanSketch } from "@/lib/database";
import {
  defaultUrbanSketchSettings,
  type UrbanSketchSettings,
} from "@/lib/croqui";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validVertexOffsets(value: unknown) {
  return (
    Array.isArray(value) &&
    value.length >= 3 &&
    value.length <= 12 &&
    value.every(
      (point) =>
        point &&
        typeof point === "object" &&
        typeof (point as { x?: unknown }).x === "number" &&
        Number.isFinite((point as { x: number }).x) &&
        typeof (point as { y?: unknown }).y === "number" &&
        Number.isFinite((point as { y: number }).y),
    )
  );
}

function validLayoutPoint(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const point = value as { x?: unknown; y?: unknown };
  return (
    typeof point.x === "number" &&
    Number.isFinite(point.x) &&
    Math.abs(point.x) <= 1000 &&
    typeof point.y === "number" &&
    Number.isFinite(point.y) &&
    Math.abs(point.y) <= 1000
  );
}

function validLayoutOffsets(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const offsets = value as Record<string, unknown>;
  const validArray = (item: unknown, maximum: number) =>
    Array.isArray(item) &&
    item.length >= 1 &&
    item.length <= maximum &&
    item.every(validLayoutPoint);
  return (
    validLayoutPoint(offsets.plot) &&
    validLayoutPoint(offsets.table) &&
    validArray(offsets.buildings, 5) &&
    validArray(offsets.measurementTexts, 12) &&
    validArray(offsets.confrontantTexts, 12) &&
    validArray(offsets.streetTexts, 12)
  );
}

function validDataOverrides(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const overrides = value as Record<string, unknown>;
  const validArea = (area: unknown) =>
    area === null ||
    (typeof area === "number" && Number.isFinite(area) && area >= 0);
  const validSides = new Set(["front", "right", "left", "back"]);
  return (
    typeof overrides.requestNumber === "string" &&
    typeof overrides.claimantName === "string" &&
    typeof overrides.propertyAddress === "string" &&
    typeof overrides.block === "string" &&
    typeof overrides.lot === "string" &&
    validArea(overrides.landArea) &&
    validArea(overrides.builtArea) &&
    Array.isArray(overrides.vertices) &&
    overrides.vertices.length <= 12 &&
    overrides.vertices.every((vertex) => {
      if (!vertex || typeof vertex !== "object") return false;
      const item = vertex as Record<string, unknown>;
      return (
        typeof item.coordinateX === "string" &&
        typeof item.coordinateY === "string"
      );
    }) &&
    Array.isArray(overrides.edges) &&
    overrides.edges.length <= 12 &&
    overrides.edges.every((edge) => {
      if (!edge || typeof edge !== "object") return false;
      const item = edge as Record<string, unknown>;
      return (
        Number.isInteger(item.fromVertex) &&
        Number.isInteger(item.toVertex) &&
        typeof item.label === "string" &&
        validArea(item.measurement) &&
        typeof item.isStreet === "boolean" &&
        typeof item.streetName === "string" &&
        typeof item.curved === "boolean" &&
        typeof item.curveBulge === "number" &&
        Number.isFinite(item.curveBulge) &&
        Math.abs(item.curveBulge) <= 1
      );
    }) &&
    Array.isArray(overrides.boundaries) &&
    overrides.boundaries.length === 4 &&
    new Set(
      overrides.boundaries.map((boundary) =>
        boundary && typeof boundary === "object"
          ? (boundary as { side?: unknown }).side
          : null,
      ),
    ).size === 4 &&
    overrides.boundaries.every((boundary) => {
      if (!boundary || typeof boundary !== "object") return false;
      const item = boundary as Record<string, unknown>;
      return (
        typeof item.side === "string" &&
        validSides.has(item.side) &&
        typeof item.label === "string" &&
        validArea(item.measurement)
      );
    })
  );
}

export async function POST(request: Request) {
  const session = await getAuthenticatedSession();
  if (!session || !session.user.role) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      processId?: string;
      settings?: Partial<UrbanSketchSettings>;
      finalize?: boolean;
    };
    const settings: UrbanSketchSettings = {
      ...defaultUrbanSketchSettings,
      ...body.settings,
    };
    if (
      !body.processId ||
      !uuidPattern.test(body.processId) ||
      !body.settings ||
      typeof settings.northAngle !== "number" ||
      typeof settings.inclination !== "number" ||
      typeof settings.scale !== "string" ||
      typeof settings.bci !== "string" ||
      typeof settings.sketchNumber !== "string" ||
      typeof settings.claimantDocument !== "string" ||
      (settings.dataOverrides !== undefined &&
        !validDataOverrides(settings.dataOverrides)) ||
      typeof settings.showBuilding !== "boolean" ||
      typeof settings.approximationNotice !== "boolean" ||
      !Array.isArray(settings.hiddenElements) ||
      settings.hiddenElements.length > 40 ||
      !settings.hiddenElements.every(
        (item) => typeof item === "string" && item.length <= 60,
      ) ||
      !validVertexOffsets(settings.vertexOffsets) ||
      !validLayoutOffsets(settings.layoutOffsets)
    ) {
      return NextResponse.json({ error: "Dados do croqui inválidos." }, { status: 400 });
    }

    const saved = await saveUrbanSketch({
      processId: body.processId,
      userId: session.user.id,
      role: session.user.role,
      settings,
      status: body.finalize ? "finalized" : "review",
    });
    if (!saved) {
      return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });
    }
    return NextResponse.json({ saved: true });
  } catch (error) {
    console.error("Falha ao salvar croqui:", error);
    return NextResponse.json(
      { error: "Não foi possível salvar o croqui." },
      { status: 500 },
    );
  }
}
