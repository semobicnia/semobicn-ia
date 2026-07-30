import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth";
import { extractTopographicData } from "@/lib/openai-extraction";

export const runtime = "nodejs";
export const maxDuration = 60;

const acceptedTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const maxTestFileSize = 3_800_000;

export async function POST(request: Request) {
  try {
    const session = await getAuthenticatedSession();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Apenas administradores podem executar testes do agente." },
        { status: 403 },
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    const supplementaryMessage = String(
      form.get("supplementaryMessage") ?? "",
    ).slice(0, 4000);

    if (!(file instanceof File) || !acceptedTypes.has(file.type)) {
      return NextResponse.json(
        { error: "Selecione um PDF ou uma imagem válida." },
        { status: 400 },
      );
    }
    if (file.size > maxTestFileSize) {
      return NextResponse.json(
        {
          error:
            "No laboratório, cada arquivo deve ter menos de 3,8 MB.",
        },
        { status: 413 },
      );
    }

    const startedAt = Date.now();
    const data = await extractTopographicData(
      file.name,
      file.type,
      new Uint8Array(await file.arrayBuffer()),
      supplementaryMessage,
    );

    return NextResponse.json({
      data,
      elapsedMs: Date.now() - startedAt,
      persisted: false,
    });
  } catch (error) {
    const safeMessages = new Set([
      "A chave da OpenAI ainda não foi configurada. Use o exemplo para testar a interface.",
      "A chave da OpenAI não foi aceita.",
      "Não foi possível analisar o croqui neste momento.",
      "A análise não retornou dados estruturados.",
    ]);
    const message =
      error instanceof Error && safeMessages.has(error.message)
        ? error.message
        : "Não foi possível executar o teste.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
