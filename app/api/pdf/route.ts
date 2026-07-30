import { NextResponse } from "next/server";
import { createTopographicPdf } from "@/lib/pdf-document";
import {
  isTopographicData,
  normalizeTopographicData,
  type TopographicData,
} from "@/lib/topographic";
import { getAuthenticatedSession } from "@/lib/auth";
import {
  getProcessDetail,
  getUrbanSketch,
  markProcessCompleted,
} from "@/lib/database";

export const runtime = "nodejs";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function createPdfResponse(data: TopographicData) {
  const bytes = await createTopographicPdf(data);
  const safeName =
    data.claimantName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "imovel";

  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="informacoes-topograficas-${safeName}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request) {
  try {
    const session = await getAuthenticatedSession();
    if (!session || !session.user.role) {
      return NextResponse.json(
        { error: "Sua sessão expirou. Entre novamente." },
        { status: 401 },
      );
    }

    const processId = new URL(request.url).searchParams.get("processId") || "";
    if (!uuidPattern.test(processId)) {
      return NextResponse.json(
        { error: "Processo inválido." },
        { status: 400 },
      );
    }

    const [process, sketch] = await Promise.all([
      getProcessDetail({
        processId,
        userId: session.user.id,
        role: session.user.role,
      }),
      getUrbanSketch(processId),
    ]);
    if (!process) {
      return NextResponse.json(
        { error: "Processo não encontrado ou acesso não autorizado." },
        { status: 404 },
      );
    }
    if (process.status !== "completed") {
      return NextResponse.json(
        { error: "O PDF deste processo ainda não foi gerado." },
        { status: 409 },
      );
    }
    if (!sketch || sketch.status !== "finalized") {
      return NextResponse.json(
        { error: "O croqui deste processo ainda não foi concluído." },
        { status: 409 },
      );
    }

    return createPdfResponse(
      normalizeTopographicData({
        ...process.data,
        bci: sketch.settings.bci || process.data.bci,
        cpf: sketch.settings.claimantDocument || process.data.cpf,
      }),
    );
  } catch (error) {
    console.error("Falha ao recuperar o PDF de informações topográficas:", error);
    return NextResponse.json(
      { error: "Não foi possível recuperar o PDF." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getAuthenticatedSession();
    if (!session || !session.user.role) {
      return NextResponse.json(
        { error: "Sua sessão expirou. Entre novamente." },
        { status: 401 },
      );
    }

    const body: unknown = await request.json();
    const payload =
      body && typeof body === "object" && "data" in body
        ? (body as { data: unknown; processId?: unknown })
        : { data: body, processId: undefined };
    if (!isTopographicData(payload.data)) {
      return NextResponse.json(
        { error: "Os dados do documento estão incompletos." },
        { status: 400 },
      );
    }
    if (
      typeof payload.processId !== "string" ||
      !uuidPattern.test(payload.processId)
    ) {
      return NextResponse.json(
        {
          error:
            "Conclua o croqui antes de gerar as Informações Topográficas.",
        },
        { status: 409 },
      );
    }
    const [process, sketch] = await Promise.all([
      getProcessDetail({
        processId: payload.processId,
        userId: session.user.id,
        role: session.user.role,
      }),
      getUrbanSketch(payload.processId),
    ]);
    if (!process) {
      return NextResponse.json(
        { error: "Processo não encontrado ou acesso não autorizado." },
        { status: 404 },
      );
    }
    if (!sketch || sketch.status !== "finalized") {
      return NextResponse.json(
        {
          error:
            "Conclua o croqui antes de gerar as Informações Topográficas.",
        },
        { status: 409 },
      );
    }

    const data = normalizeTopographicData(payload.data);
    await markProcessCompleted(payload.processId, session.user.id).catch(
      () => undefined,
    );
    return createPdfResponse(data);
  } catch (error) {
    console.error("Falha ao gerar o PDF de informações topográficas:", error);
    return NextResponse.json(
      { error: "Não foi possível gerar o PDF." },
      { status: 500 },
    );
  }
}
