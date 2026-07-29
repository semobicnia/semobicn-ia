import { NextResponse } from "next/server";
import { storePrivatePdf } from "@/lib/cloudinary";
import { saveProcess } from "@/lib/database";
import { extractTopographicData } from "@/lib/openai-extraction";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const supplementaryMessage = String(
      form.get("supplementaryMessage") ?? "",
    ).slice(0, 4000);

    if (!(file instanceof File) || file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Selecione um arquivo PDF válido." },
        { status: 400 },
      );
    }

    const maxSize = Number(process.env.MAX_PDF_SIZE_BYTES || 10_485_760);
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "O PDF ultrapassa o limite de 10 MB." },
        { status: 413 },
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const data = await extractTopographicData(
      file.name,
      bytes,
      supplementaryMessage,
    );

    let stored: Awaited<ReturnType<typeof storePrivatePdf>> = null;
    try {
      stored = await storePrivatePdf(file, bytes);
    } catch {
      data.reviewNotes.push(
        "O croqui foi analisado, mas não foi armazenado no Cloudinary.",
      );
    }

    const processId = await saveProcess({
      data,
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
        : "Não foi possível analisar o PDF.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
