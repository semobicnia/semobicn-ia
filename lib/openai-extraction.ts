import {
  normalizeTopographicData,
  type TopographicData,
} from "./topographic";

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    sourceLayout: {
      type: "string",
      enum: ["free_sketch", "structured_form"],
    },
    requestNumber: { type: "string" },
    bci: { type: "string" },
    claimantName: { type: "string" },
    claimantSex: {
      type: "string",
      enum: ["female", "male", "not_informed"],
    },
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
    plotGeometry: {
      type: "object",
      additionalProperties: false,
      properties: {
        shapeType: {
          type: "string",
          enum: ["square", "rectangle", "trapezoid", "irregular", "unknown"],
        },
        vertices: {
          type: "array",
          minItems: 0,
          maxItems: 12,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              x: { type: "number", minimum: 0, maximum: 1000 },
              y: { type: "number", minimum: 0, maximum: 1000 },
              coordinateX: { type: "string" },
              coordinateY: { type: "string" },
            },
            required: ["x", "y", "coordinateX", "coordinateY"],
          },
        },
        edges: {
          type: "array",
          minItems: 0,
          maxItems: 12,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              fromVertex: { type: "integer", minimum: 0, maximum: 11 },
              toVertex: { type: "integer", minimum: 0, maximum: 11 },
              label: { type: "string" },
              measurement: { type: ["number", "null"] },
              isStreet: { type: "boolean" },
              streetName: { type: "string" },
              curved: { type: "boolean" },
              curveBulge: { type: "number", minimum: -1, maximum: 1 },
            },
            required: [
              "fromVertex",
              "toVertex",
              "label",
              "measurement",
              "isStreet",
              "streetName",
              "curved",
              "curveBulge",
            ],
          },
        },
        buildings: {
          type: "array",
          maxItems: 5,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              vertices: {
                type: "array",
                minItems: 3,
                maxItems: 12,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    x: { type: "number", minimum: 0, maximum: 1000 },
                    y: { type: "number", minimum: 0, maximum: 1000 },
                  },
                  required: ["x", "y"],
                },
              },
            },
            required: ["vertices"],
          },
        },
        northAngle: {
          type: ["number", "null"],
          minimum: -180,
          maximum: 180,
        },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        reviewNotes: { type: "array", items: { type: "string" } },
      },
      required: [
        "shapeType",
        "vertices",
        "edges",
        "buildings",
        "northAngle",
        "confidence",
        "reviewNotes",
      ],
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    reviewNotes: { type: "array", items: { type: "string" } },
  },
  required: [
    "sourceLayout",
    "requestNumber",
    "bci",
    "claimantName",
    "claimantSex",
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
    "plotGeometry",
    "confidence",
    "reviewNotes",
  ],
};

const safeExtractionMessages = new Set([
  "A chave da OpenAI ainda não foi configurada. Use o exemplo para testar a interface.",
  "A chave da OpenAI não foi aceita.",
  "O modelo de análise configurado não está disponível para esta conta.",
  "Os créditos da OpenAI estão insuficientes. Verifique o faturamento da API.",
  "O limite temporário da OpenAI foi atingido. Aguarde alguns segundos e tente novamente.",
  "A análise demorou além do limite. Tente novamente; se persistir, envie uma foto mais nítida.",
  "A OpenAI não conseguiu processar este arquivo. Tente convertê-lo para JPG ou PDF.",
  "A análise foi interrompida antes de concluir todos os campos. Tente novamente.",
  "A análise não retornou dados estruturados.",
  "Não foi possível analisar o croqui neste momento.",
]);

export function isSafeExtractionMessage(message: string) {
  return safeExtractionMessages.has(message);
}

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

function parseConfidenceThreshold(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0.6;
}

function extractionConfidence(data: TopographicData) {
  return Math.min(data.confidence, data.plotGeometry.confidence);
}

export async function extractTopographicData(
  filename: string,
  mimeType: string,
  bytes: Uint8Array,
  supplementaryMessage: string,
): Promise<TopographicData> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "A chave da OpenAI ainda não foi configurada. Use o exemplo para testar a interface.",
    );
  }

  const prompt = `Analise visualmente o croqui imobiliário enviado como foto ou PDF e extraia os dados para um documento de Informações Topográficas da SEMOBI de Coelho Neto - MA.

Regras obrigatórias:
- Use sourceLayout="structured_form" quando o arquivo utilizar o gabarito SEMOBI IA com campos e caixas impressas; nos demais croquis, use sourceLayout="free_sketch".
- O croqui pode estar manuscrito a caneta ou lápis, com letra cursiva, traço fraco, rasuras, sombras, perspectiva, rotação ou baixa nitidez. Examine toda a imagem ou todas as páginas antes de extrair.
- O arquivo também pode usar o gabarito estruturado SEMOBI IA. Nesse gabarito, leia os campos NÚM. REQUERIMENTO, BCI, LOTE, QUADRA, POSSEIRO, sexo, CPF/CNPJ e ENDEREÇO somente quando estiverem preenchidos. Extraia NÚM. REQUERIMENTO em requestNumber.
- No gabarito, as molduras dos campos, o grande retângulo da área de desenho e o logotipo SEMOBI IA são elementos fixos. Nunca os interprete como limites do terreno, edificação ou rua.
- As caixas EDIFICAÇÃO e NORTE são áreas de preenchimento válidas. Leia números, hachuras, setas e anotações feitos à mão dentro delas. Ignore somente os exemplos impressos: as pequenas linhas claras acompanhadas da palavra LINHAS e a pequena seta impressa acompanhada da palavra SETA.
- Se houver uma metragem manuscrita na caixa EDIFICAÇÃO, extraia-a em builtArea mesmo que a edificação também esteja desenhada e hachurada na área principal.
- Se houver uma seta manuscrita na caixa NORTE, use-a para northAngle. A seta impressa pequena de exemplo não conta.
- Se a área grande do gabarito estiver sem um desenho real do terreno, use shapeType="unknown", retorne vertices e edges vazios e registre em plotGeometry.reviewNotes que o croqui não foi desenhado. Não invente um polígono a partir da borda do formulário.
- Nos campos MASCULINO e FEMININO, considere selecionada apenas a opção cuja caixa tenha X, visto, preenchimento ou outra marca manuscrita inequívoca. Caixas vazias não indicam sexo.
- Na seção UTILIZAÇÃO, considere somente caixas realmente marcadas. Mapeie EDIFIC. DE ALVENARIA ou EDIFIC. DE TAIPA/ADOBE para propertyUse; MURO ALVENARIA ou CERCA DE MADEIRA para delimitation; e os serviços/pavimentos marcados para improvements. Não inclua opções com caixas vazias.
- Diferencie as linhas do terreno de setas, cotas, textos, carimbos e outros traços auxiliares.
- Faça duas leituras visuais antes de responder: primeiro os campos e caixas do formulário; depois somente a área grande do desenho para reconstruir terreno, ruas, confrontantes, medidas e edificações.
- Em desenhos irregulares, percorra visualmente o contorno do terreno vértice por vértice. Não confunda as duas linhas paralelas de uma rua com duas faces do terreno.
- Um contorno manuscrito pode terminar visualmente encostado em uma rua, margem ou outro segmento sem fechar perfeitamente por causa do traço da caneta. Quando a continuidade do lote for inequívoca, feche o polígono de forma aproximada e registre essa inferência em plotGeometry.reviewNotes, em vez de descartar toda a geometria.
- Associe cada nome de rua, vizinho e medida ao lado mais próximo do desenho. Confira vírgulas e pontos decimais e confronte as medidas com a área indicada.
- Quando houver mais de uma leitura plausível, não escolha silenciosamente: use o valor mais legível e registre a alternativa ou a dúvida em reviewNotes para correção humana.
- Não invente dados ilegíveis; use string vazia ou null e registre a dúvida em reviewNotes.
- Extraia em bci o número do BCI, cadastro imobiliário ou inscrição imobiliária quando aparecer no desenho.
- Extraia no campo cpf o CPF ou o CNPJ informado no croqui.
- Para claimantSex, use female ou male somente quando o croqui ou a mensagem complementar indicarem claramente o sexo; caso contrário, use not_informed para revisão humana.
- A nacionalidade padrão é "brasileira", exceto quando a mensagem complementar disser outra.
- A residência é o mesmo endereço do imóvel, exceto quando a mensagem complementar informar outro endereço.
- Em qualquer limite sem nome de vizinho ou rua, use exatamente "TERRENOS DE TERCEIROS".
- Em croqui livre, a delimitação padrão é "Muro de alvenaria" e as benfeitorias padrão são Pavimentação asfáltica, Iluminação pública e Rede de abastecimento de água. No gabarito estruturado, não aplique esses padrões: use somente as opções efetivamente marcadas e deixe delimitation vazio ou improvements como lista vazia quando nada estiver assinalado.
- Se a área construída estiver ausente, marcada com traço ou zero e não houver edificação desenhada nem opção de edificação marcada, use 0, deixe builtAreaInWords vazio e preencha propertyUse com "Sem edificação". Se houver edificação indicada mas sua área não estiver informada, use null em builtArea, preserve o tipo em propertyUse e registre a ausência da metragem em reviewNotes.
- Escreva landAreaInWords e builtAreaInWords por extenso em português, incluindo "metros quadrados".
- Escreva cada medida linear por extenso em measurementInWords, convertendo a parte decimal para centímetros.
- Use a data que aparece no croqui, em YYYY-MM-DD. Quando não houver data, retorne string vazia; o sistema usará a data de criação.
- Retorne exatamente quatro limites: front, right, left e back.
- Além dos quatro limites textuais, reconstrua a geometria visual em plotGeometry. Ela deve representar o contorno real do terreno, inclusive quando possuir 3, 5 ou mais faces.
- Em plotGeometry.vertices, informe os vértices do terreno em ordem horária, usando coordenadas normalizadas de 0 a 1000 conforme a posição no desenho original (x cresce para a direita e y para baixo). Não inclua vértices de cotas, setas ou construções.
- Quando o documento fornecer coordenadas topográficas ou geográficas reais para um ponto, preserve-as como texto em coordinateX e coordinateY, inclusive vírgulas e casas decimais. Quando não houver coordenadas reais, retorne string vazia nesses dois campos; nunca use as coordenadas normalizadas do desenho como coordenadas reais.
- Preserve rigorosamente a orientação visual do contorno como ele aparece no arquivo. Não gire, espelhe, endireite nem transforme o terreno para deixá-lo horizontal ou vertical.
- Em plotGeometry.edges, crie uma aresta para cada par consecutivo de vértices, inclusive a última ligada à primeira. Associe a cada face seu confrontante, medida e eventual rua.
- Marque isStreet=true em toda face que confrontar com rua, avenida, travessa ou estrada. Preserve o nome em streetName e a posição correta em relação ao terreno.
- Se a mesma rua confrontar com duas ou mais faces, marque todas essas arestas como rua e repita o mesmo streetName nelas, mantendo a sequência e a mudança de direção observadas no original.
- Ruas desenhadas por duas linhas paralelas podem seguir ao lado do terreno e dobrar em um vértice, formando um L, uma esquina ou outro percurso quebrado. Nesse caso, não encerre a rua na dobra: marque como rua todas as faces consecutivas acompanhadas por ela e mantenha o mesmo streetName. Exemplo: se a Rua Juca Figueiredo acompanha uma face e dobra no P5 para acompanhar a face seguinte, as duas arestas devem ter isStreet=true e streetName="RUA JUCA FIGUEIREDO".
- O nome de uma rua pode estar escrito apenas uma vez no trecho horizontal, embora a mesma via continue pelo trecho vertical depois da esquina. Propague esse nome para todos os segmentos consecutivos acompanhados pelas mesmas duas linhas da via. Em um recuo côncavo do lote, verifique especialmente o pequeno segmento horizontal e o segmento vertical que se encontram no vértice da dobra.
- Não confunda a linha de dentro e a linha de fora da mesma via com limites diferentes. O eixo visual da rua deve acompanhar o percurso das duas linhas paralelas, inclusive depois da dobra.
- Quando a borda do terreno ou a rua for curva, marque curved=true. Use curveBulge entre -1 e 1 para indicar a curvatura aproximada: valor positivo curva para o interior do polígono visual e negativo para o exterior; use 0 em linha reta.
- Quando houver uma ou mais edificações desenhadas ou hachuradas dentro do terreno, registre cada contorno em plotGeometry.buildings com coordenadas normalizadas de 0 a 1000 na mesma referência usada pelos vértices do terreno. Não use a caixa impressa da legenda EDIFICAÇÃO.
- Quando houver uma seta do norte manuscrita na área do croqui ou na caixa NORTE, retorne plotGeometry.northAngle em graus: 0 aponta para o topo da página, 90 para a direita, -90 para a esquerda e 180 para baixo. Sem seta manuscrita real, retorne null. Não use a seta pequena impressa de exemplo.
- Classifique shapeType como square, rectangle, trapezoid ou irregular. Use irregular para qualquer terreno com mais de quatro faces. Só use unknown quando o contorno estiver realmente ilegível.
- A geometria é uma representação aproximada para revisão humana. Registre em plotGeometry.reviewNotes qualquer vértice, rua ou curvatura duvidosa.

Mensagem complementar fornecida pelo servidor:
${supplementaryMessage.trim() || "Nenhuma."}`;

  const encodedFile = Buffer.from(bytes).toString("base64");
  const visualInput =
    mimeType === "application/pdf"
      ? {
          type: "input_file",
          filename,
          file_data: `data:${mimeType};base64,${encodedFile}`,
        }
      : {
          type: "input_image",
          image_url: `data:${mimeType};base64,${encodedFile}`,
          detail: "auto",
        };

  async function runExtraction(model: string, effort: "medium" | "high") {
    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          reasoning: { effort },
          input: [
            {
              role: "user",
              content: [{ type: "input_text", text: prompt }, visualInput],
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
        signal: AbortSignal.timeout(240_000),
      });
    } catch (error) {
      console.error("Falha de conexão com a OpenAI", { model, error });
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new Error(
          "A análise demorou além do limite. Tente novamente; se persistir, envie uma foto mais nítida.",
        );
      }
      throw new Error("Não foi possível analisar o croqui neste momento.");
    }

    if (!response.ok) {
      const detail = await response.text();
      console.error("Falha da OpenAI ao analisar croqui", {
        model,
        status: response.status,
        detail: detail.slice(0, 2000),
      });
      if (detail.includes("invalid_api_key")) {
        throw new Error("A chave da OpenAI não foi aceita.");
      }
      if (
        detail.includes("model_not_found") ||
        detail.includes("does not exist")
      ) {
        throw new Error(
          "O modelo de análise configurado não está disponível para esta conta.",
        );
      }
      if (detail.includes("insufficient_quota")) {
        throw new Error(
          "Os créditos da OpenAI estão insuficientes. Verifique o faturamento da API.",
        );
      }
      if (response.status === 429) {
        throw new Error(
          "O limite temporário da OpenAI foi atingido. Aguarde alguns segundos e tente novamente.",
        );
      }
      if (response.status === 408 || response.status === 504) {
        throw new Error(
          "A análise demorou além do limite. Tente novamente; se persistir, envie uma foto mais nítida.",
        );
      }
      if (response.status === 400 && /image|file|mime|format/i.test(detail)) {
        throw new Error(
          "A OpenAI não conseguiu processar este arquivo. Tente convertê-lo para JPG ou PDF.",
        );
      }
      throw new Error("Não foi possível analisar o croqui neste momento.");
    }

    const payload = (await response.json()) as Parameters<
      typeof extractOutputText
    >[0] & { status?: string; incomplete_details?: { reason?: string } };
    const outputText = extractOutputText(payload);
    if (!outputText) {
      console.error("Resposta da OpenAI sem dados estruturados", {
        model,
        status: payload.status,
        incompleteReason: payload.incomplete_details?.reason,
      });
      if (payload.status === "incomplete") {
        throw new Error(
          "A análise foi interrompida antes de concluir todos os campos. Tente novamente.",
        );
      }
      throw new Error("A análise não retornou dados estruturados.");
    }

    return normalizeTopographicData(
      JSON.parse(outputText) as Partial<TopographicData>,
    );
  }

  const primaryModel = process.env.OPENAI_MODEL?.trim() || "gpt-5.6-terra";
  const fallbackModel =
    process.env.OPENAI_FALLBACK_MODEL?.trim() || "gpt-5.6-sol";
  const fallbackThreshold = parseConfidenceThreshold(
    process.env.OPENAI_FALLBACK_CONFIDENCE,
  );

  const primaryData = await runExtraction(primaryModel, "medium");
  const primaryConfidence = extractionConfidence(primaryData);
  if (
    primaryModel === fallbackModel ||
    primaryConfidence >= fallbackThreshold
  ) {
    return primaryData;
  }

  try {
    const fallbackData = await runExtraction(fallbackModel, "high");
    return extractionConfidence(fallbackData) > primaryConfidence
      ? fallbackData
      : primaryData;
  } catch (error) {
    console.error("Segunda análise não concluída; mantendo o resultado principal", {
      fallbackModel,
      error,
    });
    return primaryData;
  }
}
