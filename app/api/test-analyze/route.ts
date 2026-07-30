import { NextResponse } from "next/server";
import { getAuthenticatedSession } from "@/lib/auth";
import {
  deletePrivateSource,
  getSignedPrivateSourceUrl,
} from "@/lib/cloudinary";
import { extractTopographicData } from "@/lib/openai-extraction";

export const runtime = "nodejs";
export const maxDuration = 60;

const acceptedTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const maxTestFileSize = 10_485_760;

export async function POST(request: Request) {
  let temporaryPublicId = "";
  try {
    const session = await getAuthenticatedSession();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Apenas administradores podem executar testes do agente." },
        { status: 403 },
      );
    }

    const contentType = request.headers.get("content-type") ?? "";
    let filename = "";
    let mimeType = "";
    let bytes: Uint8Array;
    let supplementaryMessage = "";

    if (contentType.includes("application/json")) {
      const body = (await request.json()) as {
        filename?: unknown;
        mimeType?: unknown;
        supplementaryMessage?: unknown;
        source?: { publicId?: unknown };
      };
      filename = String(body.filename ?? "").slice(0, 255);
      mimeType = String(body.mimeType ?? "");
      supplementaryMessage = String(
        body.supplementaryMessage ?? "",
      ).slice(0, 4000);
      temporaryPublicId = String(body.source?.publicId ?? "");
      if (
        !filename ||
        !acceptedTypes.has(mimeType) ||
        !temporaryPublicId.startsWith("semobicn/tests/")
      ) {
        return NextResponse.json(
          { error: "Selecione um PDF ou uma imagem válida." },
          { status: 400 },
        );
      }
      const signedUrl = getSignedPrivateSourceUrl(temporaryPublicId);
      if (!signedUrl) {
        return NextResponse.json(
          { error: "Não foi possível acessar o arquivo temporário." },
          { status: 400 },
        );
      }
      const sourceResponse = await fetch(signedUrl, { cache: "no-store" });
      if (!sourceResponse.ok) {
        return NextResponse.json(
          { error: "Não foi possível acessar o arquivo temporário." },
          { status: 400 },
        );
      }
      bytes = new Uint8Array(await sourceResponse.arrayBuffer());
    } else {
      const form = await request.formData();
      const file = form.get("file");
      supplementaryMessage = String(
        form.get("supplementaryMessage") ?? "",
      ).slice(0, 4000);
      if (!(file instanceof File) || !acceptedTypes.has(file.type)) {
        return NextResponse.json(
          { error: "Selecione um PDF ou uma imagem válida." },
          { status: 400 },
        );
      }
      filename = file.name;
      mimeType = file.type;
      bytes = new Uint8Array(await file.arrayBuffer());
    }

    if (bytes.byteLength > maxTestFileSize) {
      return NextResponse.json(
        {
          error: "No laboratório, cada arquivo deve ter no máximo 10 MB.",
        },
        { status: 413 },
      );
    }

    const startedAt = Date.now();
    const data = await extractTopographicData(
      filename,
      mimeType,
      bytes,
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
  } finally {
    if (temporaryPublicId.startsWith("semobicn/tests/")) {
      await deletePrivateSource(temporaryPublicId).catch(() => false);
    }
  }
}
