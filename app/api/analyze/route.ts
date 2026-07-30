import { NextResponse } from "next/server";
import {
  getSignedPrivateSourceUrl,
  storePrivateSource,
} from "@/lib/cloudinary";
import { saveProcess } from "@/lib/database";
import { extractTopographicData } from "@/lib/openai-extraction";
import { getAuthenticatedSession } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const acceptedTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export async function POST(request: Request) {
  try {
    const session = await getAuthenticatedSession();
    if (!session) {
      return NextResponse.json(
        { error: "Sua sessão expirou. Entre novamente." },
        { status: 401 },
      );
    }

    const contentType = request.headers.get("content-type") ?? "";
    let filename = "";
    let mimeType = "";
    let bytes: Uint8Array;
    let supplementaryMessage = "";
    let stored: Awaited<ReturnType<typeof storePrivateSource>> = null;

    if (contentType.includes("application/json")) {
      const body = (await request.json()) as {
        filename?: unknown;
        mimeType?: unknown;
        supplementaryMessage?: unknown;
        source?: {
          publicId?: unknown;
          url?: unknown;
        };
      };
      filename = String(body.filename ?? "").slice(0, 255);
      mimeType = String(body.mimeType ?? "");
      supplementaryMessage = String(
        body.supplementaryMessage ?? "",
      ).slice(0, 4000);
      const publicId = String(body.source?.publicId ?? "");

      if (
        !filename ||
        !acceptedTypes.has(mimeType) ||
        !publicId.startsWith("semobicn/croquis/")
      ) {
        return NextResponse.json(
          { error: "Selecione um PDF ou uma foto válida (JPG, PNG ou WebP)." },
          { status: 400 },
        );
      }

      const signedUrl = getSignedPrivateSourceUrl(publicId);
      if (!signedUrl) {
        return NextResponse.json(
          { error: "Não foi possível acessar o arquivo enviado." },
          { status: 400 },
        );
      }

      const sourceResponse = await fetch(signedUrl, { cache: "no-store" });
      if (!sourceResponse.ok) {
        return NextResponse.json(
          { error: "Não foi possível acessar o arquivo enviado." },
          { status: 400 },
        );
      }
      bytes = new Uint8Array(await sourceResponse.arrayBuffer());
      stored = { url: signedUrl, publicId };
    } else {
      const form = await request.formData();
      const file = form.get("file");
      supplementaryMessage = String(
        form.get("supplementaryMessage") ?? "",
      ).slice(0, 4000);

      if (!(file instanceof File) || !acceptedTypes.has(file.type)) {
        return NextResponse.json(
          { error: "Selecione um PDF ou uma foto válida (JPG, PNG ou WebP)." },
          { status: 400 },
        );
      }

      filename = file.name;
      mimeType = file.type;
      bytes = new Uint8Array(await file.arrayBuffer());

      try {
        stored = await storePrivateSource(file, bytes);
      } catch {
        stored = null;
      }
    }

    const maxSize = Number(
      process.env.MAX_SOURCE_FILE_SIZE_BYTES ||
        process.env.MAX_PDF_SIZE_BYTES ||
        10_485_760,
    );
    if (bytes.byteLength > maxSize) {
      return NextResponse.json(
        { error: "O arquivo ultrapassa o limite de 10 MB." },
        { status: 413 },
      );
    }

    const data = await extractTopographicData(
      filename,
      mimeType,
      bytes,
      supplementaryMessage,
    );

    if (!stored) {
      data.reviewNotes.push(
        "O croqui foi analisado, mas não foi armazenado no Cloudinary.",
      );
    }

    const processId = await saveProcess({
      data,
      createdByUserId: session.user.id,
      sourceUrl: stored?.url,
      sourcePublicId: stored?.publicId,
      supplementaryMessage,
    }).catch(() => null);

    return NextResponse.json({ data, processId });
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
        : "Não foi possível analisar o croqui.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
