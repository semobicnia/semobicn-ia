import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth";
import { saveUrbanSketch } from "@/lib/database";
import type { UrbanSketchSettings } from "@/lib/croqui";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

function validVertexOffsets(value: unknown) {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
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

function validDataOverrides(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const overrides = value as Record<string, unknown>;
  const validArea = (area: unknown) =>
    area === null ||
    (typeof area === "number" && Number.isFinite(area) && area >= 0);
  const validSides = new Set(["front", "right", "left", "back"]);
  return (
    typeof overrides.claimantName === "string" &&
    typeof overrides.propertyAddress === "string" &&
    typeof overrides.block === "string" &&
    typeof overrides.lot === "string" &&
    validArea(overrides.landArea) &&
    validArea(overrides.builtArea) &&
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
      settings?: UrbanSketchSettings;
    };
    if (
      !body.processId ||
      !uuidPattern.test(body.processId) ||
      !body.settings ||
      typeof body.settings.northAngle !== "number" ||
      typeof body.settings.inclination !== "number" ||
      typeof body.settings.scale !== "string" ||
      typeof body.settings.bci !== "string" ||
      typeof body.settings.sketchNumber !== "string" ||
      typeof body.settings.claimantDocument !== "string" ||
      !validDataOverrides(body.settings.dataOverrides) ||
      typeof body.settings.showBuilding !== "boolean" ||
      typeof body.settings.approximationNotice !== "boolean" ||
      !validVertexOffsets(body.settings.vertexOffsets)
    ) {
      return NextResponse.json({ error: "Dados do croqui inválidos." }, { status: 400 });
    }

    const saved = await saveUrbanSketch({
      processId: body.processId,
      userId: session.user.id,
      role: session.user.role,
      settings: body.settings,
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
