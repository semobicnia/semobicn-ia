import {
  normalizeTopographicData,
  type TopographicData,
} from "./topographic";

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    claimantName: { type: "string" },
    cpf: { type: "string" },
    nationality: { type: "string" },
    residence: { type: "string" },
    propertyAddress: { type: "string" },
    neighborhood: { type: "string" },
    city: { type: "string" },
    state: { type: "string" },
    block: { type: "string" },
    lot: { type: "string" },
    landArea: { type: ["number", "null"] },
    landAreaInWords: { type: "string" },
    builtArea: { type: ["number", "null"] },
    builtAreaInWords: { type: "string" },
    propertyUse: { type: "string" },
    delimitation: { type: "string" },
    improvements: { type: "array", items: { type: "string" } },
    documentDate: { type: "string" },
    boundaries: {
      type: "array",
      minItems: 4,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          side: { type: "string", enum: ["front", "right", "left", "back"] },
          label: { type: "string" },
          measurement: { type: ["number", "null"] },
          measurementInWords: { type: "string" },
        },
        required: ["side", "label", "measurement", "measurementInWords"],
      },
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    reviewNotes: { type: "array", items: { type: "string" } },
  },
  required: [
    "claimantName",
    "cpf",
    "nationality",
    "residence",
    "propertyAddress",
    "neighborhood",
    "city",
    "state",
    "block",
    "lot",
    "landArea",
    "landAreaInWords",
    "builtArea",
    "builtAreaInWords",
    "propertyUse",
    "delimitation",
    "improvements",
    "documentDate",
    "boundaries",
    "confidence",
    "reviewNotes",
  ],
};

function extractOutputText(response: {
  output_text?: string;
  output?: Array<{
    content?: Array<{ type?: string; text?: string }>;
  }>;
}) {
  if (response.output_text) return response.output_text;
  return (
    response.output
      ?.flatMap((item) => item.content ?? [])
      .find((item) => item.type === "output_text")?.text ?? ""
  );
}

export async function extractTopographicData(
  filename: string,
  bytes: Uint8Array,
  supplementaryMessage: string,
): Promise<TopographicData> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "A chave da OpenAI ainda não foi configurada. Use o exemplo para testar a interface.",
    );
  }

  const prompt = `Analise visualmente o croqui imobiliário em PDF e extraia os dados para um documento de Informações Topográficas da SEMOBI de Coelho Neto - MA.

Regras obrigatórias:
- Não invente dados ilegíveis; use string vazia ou null e registre a dúvida em reviewNotes.
- A nacionalidade padrão é "brasileira", exceto quando a mensagem complementar disser outra.
- A residência é o mesmo endereço do imóvel, exceto quando a mensagem complementar informar outro endereço.
- Em qualquer limite sem nome de vizinho ou rua, use exatamente "TERRENOS DE TERCEIROS".
- Delimitação padrão: "Muro de alvenaria".
- Benfeitorias padrão: Pavimentação asfáltica, Iluminação pública e Rede de abastecimento de água.
- Se a área construída estiver ausente, marcada com traço ou zero, use 0 e deixe builtAreaInWords vazio.
- Escreva landAreaInWords e builtAreaInWords por extenso em português, incluindo "metros quadrados".
- Escreva cada medida linear por extenso em measurementInWords, convertendo a parte decimal para centímetros.
- Use a data que aparece no croqui, em YYYY-MM-DD.
- Retorne exatamente quatro limites: front, right, left e back.

Mensagem complementar fornecida pelo servidor:
${supplementaryMessage.trim() || "Nenhuma."}`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5.6-terra",
      reasoning: { effort: "medium" },
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            {
              type: "input_file",
              filename,
              file_data: `data:application/pdf;base64,${Buffer.from(bytes).toString("base64")}`,
              detail: "high",
            },
          ],
        },
      ],
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "topographic_information",
          strict: true,
          schema,
        },
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      detail.includes("invalid_api_key")
        ? "A chave da OpenAI não foi aceita."
        : "Não foi possível analisar o croqui neste momento.",
    );
  }

  const payload = (await response.json()) as Parameters<
    typeof extractOutputText
  >[0];
  const outputText = extractOutputText(payload);
  if (!outputText) throw new Error("A análise não retornou dados estruturados.");
  return normalizeTopographicData(
    JSON.parse(outputText) as Partial<TopographicData>,
  );
}
