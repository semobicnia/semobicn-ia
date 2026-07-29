import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  PDFDocument,
  degrees,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import { boundaryLabels, type TopographicData } from "./topographic";

// O pacote é mantido localmente para que a incorporação da Open Sans funcione
// de forma idêntica no desenvolvimento e na Vercel.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fontkit = require("./vendor/fontkit-bundle.cjs");

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 43;
const TEXT_WIDTH = A4.width - MARGIN * 2;
const BODY_SIZE = 11;
const BODY_LINE_HEIGHT = BODY_SIZE * 1.5;
const SECTION_TEXT_SPACING = BODY_SIZE;
const TOP_MARGIN = 15 * 0.75;
const BLACK = rgb(0.035, 0.035, 0.035);
const BLUE = rgb(0.02, 0.3, 0.7);

type FontStyle = "regular" | "bold";

type Fonts = {
  regular: PDFFont;
  bold: PDFFont;
};

type RichSpan = {
  text: string;
  font?: FontStyle;
  italic?: boolean;
};

type RichToken = Omit<RichSpan, "text"> & {
  text: string;
  width: number;
};

function formatNumber(
  value: number | null,
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number },
) {
  if (value === null) return "Não informado";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: options?.minimumFractionDigits ?? 0,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
  });
}

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function getFont(fonts: Fonts, style: FontStyle | undefined) {
  return style === "bold" ? fonts.bold : fonts.regular;
}

function toTokens(spans: RichSpan[], fonts: Fonts, size: number) {
  const tokens: RichToken[] = [];
  for (const span of spans) {
    for (const word of span.text.replace(/\s+/g, " ").trim().split(" ")) {
      if (!word) continue;
      const font = getFont(fonts, span.font);
      tokens.push({
        text: word,
        font: span.font,
        italic: span.italic,
        width: font.widthOfTextAtSize(word, size),
      });
    }
  }
  return tokens;
}

function wrapTokens(tokens: RichToken[], fonts: Fonts, size: number, width: number) {
  const lines: RichToken[][] = [];
  const spaceWidth = fonts.regular.widthOfTextAtSize(" ", size);
  let line: RichToken[] = [];
  let lineWidth = 0;

  for (const token of tokens) {
    const nextWidth = line.length
      ? lineWidth + spaceWidth + token.width
      : token.width;
    if (line.length && nextWidth > width) {
      lines.push(line);
      line = [token];
      lineWidth = token.width;
    } else {
      line.push(token);
      lineWidth = nextWidth;
    }
  }
  if (line.length) lines.push(line);
  return lines;
}

function drawRichParagraph(
  page: PDFPage,
  spans: RichSpan[],
  y: number,
  fonts: Fonts,
  options?: {
    size?: number;
    lineHeight?: number;
    justify?: boolean;
    width?: number;
    x?: number;
  },
) {
  const size = options?.size ?? BODY_SIZE;
  const lineHeight = options?.lineHeight ?? BODY_LINE_HEIGHT;
  const width = options?.width ?? TEXT_WIDTH;
  const startX = options?.x ?? MARGIN;
  const tokens = toTokens(spans, fonts, size);
  const lines = wrapTokens(tokens, fonts, size, width);
  const normalSpace = fonts.regular.widthOfTextAtSize(" ", size);

  lines.forEach((line, lineIndex) => {
    const contentWidth = line.reduce((sum, token) => sum + token.width, 0);
    const isLast = lineIndex === lines.length - 1;
    const spaces = Math.max(0, line.length - 1);
    const spaceWidth =
      options?.justify !== false && !isLast && spaces > 0
        ? (width - contentWidth) / spaces
        : normalSpace;
    let x = startX;
    const baseline = y - lineIndex * lineHeight;

    line.forEach((token, tokenIndex) => {
      const font = getFont(fonts, token.font);
      page.drawText(token.text, {
        x,
        y: baseline,
        size,
        font,
        color: BLACK,
      });
      x += token.width + (tokenIndex < line.length - 1 ? spaceWidth : 0);
    });
  });

  return y - lines.length * lineHeight;
}

function drawHeading(
  page: PDFPage,
  text: string,
  y: number,
  fonts: Fonts,
  size = 11.8,
) {
  page.drawText(text, {
    x: MARGIN,
    y,
    size,
    font: fonts.bold,
    color: BLACK,
  });
  return y - 20;
}

function boundaryName(side: TopographicData["boundaries"][number]["side"]) {
  if (side === "front") return "Frente";
  if (side === "right") return "Flanco direito";
  if (side === "left") return "Flanco esquerdo";
  return "Fundo";
}

function boundarySentence(
  boundary: TopographicData["boundaries"][number],
  endMark: "," | ".",
): RichSpan[] {
  const label = (boundary.label || "TERRENOS DE TERCEIROS").toUpperCase();
  const measurement =
    boundary.measurement === null
      ? "medida não informada"
      : `${formatNumber(boundary.measurement, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}m`;
  const measurementWords = boundary.measurementInWords
    ? `; (${boundary.measurementInWords})`
    : "";

  return [
    { text: boundaryName(boundary.side), font: "bold" },
    { text: "limitando-se com" },
    { text: label, font: "bold" },
    { text: "medindo:" },
    { text: `${measurement};`, font: "bold" },
    {
      text: measurementWords
        ? `${measurementWords.slice(2)}${endMark}`
        : endMark,
    },
  ];
}

async function loadAsset(relativePath: string) {
  return readFile(path.join(process.cwd(), "public", relativePath));
}

export async function createTopographicPdf(data: TopographicData) {
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);

  const [regularBytes, boldBytes, semobiLogoBytes, cityLogoBytes] =
    await Promise.all([
      loadAsset("fonts/OpenSans-Regular.ttf"),
      loadAsset("fonts/OpenSans-Bold.ttf"),
      loadAsset("assets/logo-semobi.png"),
      loadAsset("assets/logo-coelho-neto.png"),
    ]);

  const fonts: Fonts = {
    regular: await document.embedFont(regularBytes, { subset: false }),
    bold: await document.embedFont(boldBytes, { subset: false }),
  };
  const semobiLogo = await document.embedPng(semobiLogoBytes);
  const cityLogo = await document.embedPng(cityLogoBytes);
  const page = document.addPage([A4.width, A4.height]);
  const nationality = data.nationality.trim().toLowerCase();
  const feminine = nationality.endsWith("a");
  const holder = feminine ? "portadora" : "portador";
  const domiciled = feminine ? "domiciliada" : "domiciliado";

  const visibleLogoTop = A4.height - TOP_MARGIN;
  const logoGap = 14;
  const headerCenter = A4.width / 2;
  const semobiWidth = 132;
  const semobiHeight = (semobiLogo.height / semobiLogo.width) * semobiWidth;
  const cityWidth = 156;
  const cityHeight = (cityLogo.height / cityLogo.width) * cityWidth;
  // Os arquivos possuem margens brancas internas diferentes. Estes limites
  // representam a área realmente desenhada em cada PNG e mantêm os pixels
  // visíveis alinhados, sem alterar a proporção original das imagens.
  const semobiScale = semobiWidth / semobiLogo.width;
  const cityScale = cityWidth / cityLogo.width;
  const semobiVisible = {
    left: 16 * semobiScale,
    top: 23 * semobiScale,
    right: 824 * semobiScale,
    bottom: 245 * semobiScale,
  };
  const cityVisible = {
    left: 0,
    top: 47 * cityScale,
    right: 418 * cityScale,
    bottom: 152 * cityScale,
  };
  const semobiCanvasTop = visibleLogoTop + semobiVisible.top;
  const cityCanvasTop = visibleLogoTop + cityVisible.top;
  const semobiX = headerCenter - logoGap - semobiVisible.right;
  const cityX = headerCenter + logoGap - cityVisible.left;
  page.drawImage(semobiLogo, {
    x: semobiX,
    y: semobiCanvasTop - semobiHeight,
    width: semobiWidth,
    height: semobiHeight,
  });
  const semobiVisibleBottom = semobiCanvasTop - semobiVisible.bottom;
  const cityVisibleBottom = cityCanvasTop - cityVisible.bottom;
  const visibleLogoBottom = Math.min(semobiVisibleBottom, cityVisibleBottom);
  page.drawLine({
    start: { x: headerCenter, y: visibleLogoBottom },
    end: { x: headerCenter, y: visibleLogoTop },
    thickness: 1.25,
    color: BLUE,
  });
  page.drawImage(cityLogo, {
    x: cityX,
    y: cityCanvasTop - cityHeight,
    width: cityWidth,
    height: cityHeight,
  });
  const headerRuleY = visibleLogoBottom - 11;
  page.drawLine({
    start: { x: MARGIN, y: headerRuleY },
    end: { x: A4.width - MARGIN, y: headerRuleY },
    thickness: 0.65,
    color: BLACK,
  });

  const watermarkText = "SEMOBI";
  const watermarkSize = 76;
  const watermarkAngle = 51;
  const watermarkWidth = fonts.bold.widthOfTextAtSize(
    watermarkText,
    watermarkSize,
  );
  const watermarkRadians = (watermarkAngle * Math.PI) / 180;
  const watermarkCenterOffsetX =
    (watermarkWidth / 2) * Math.cos(watermarkRadians) -
    (watermarkSize / 2) * Math.sin(watermarkRadians);
  const watermarkCenterOffsetY =
    (watermarkWidth / 2) * Math.sin(watermarkRadians) +
    (watermarkSize / 2) * Math.cos(watermarkRadians);
  page.drawText("SEMOBI", {
    x: A4.width / 2 - watermarkCenterOffsetX,
    y: A4.height / 2 - watermarkCenterOffsetY,
    size: watermarkSize,
    font: fonts.bold,
    color: rgb(0.95, 0.95, 0.95),
    rotate: degrees(watermarkAngle),
  });

  let y = headerRuleY - 39;
  y = drawHeading(page, "1 - INFORMAÇÕES TOPOGRÁFICAS:", y, fonts);
  y = drawRichParagraph(
    page,
    [
      { text: "Com referência do terreno requerido por" },
      {
        text: `${data.claimantName.toUpperCase()},`,
        font: "bold",
      },
      { text: `${data.nationality}, ${holder} do` },
      {
        text: `CPF. nº ${data.cpf || "não informado"},`,
        font: "bold",
      },
      {
        text: `residente e ${domiciled} nesta cidade de ${data.city} - ${data.state}.`,
      },
    ],
    y,
    fonts,
    { justify: true },
  );
  y -= SECTION_TEXT_SPACING;

  y = drawHeading(page, "2 - SITUAÇÃO:", y, fonts);
  const situationSpans: RichSpan[] = [
    {
      text: `${data.propertyAddress.toUpperCase()},`,
      font: "bold",
    },
  ];
  if (data.block) {
    situationSpans.push({
      text: `QUADRA: ${data.block},`,
      font: "bold",
    });
  }
  if (data.lot) {
    situationSpans.push({
      text: `LOTE: ${data.lot},`,
      font: "bold",
    });
  }
  if (data.neighborhood) {
    situationSpans.push(
      { text: "Bairro:" },
      {
        text: `${data.neighborhood.toUpperCase()},`,
        font: "bold",
      },
    );
  }
  situationSpans.push({ text: `${data.city} - ${data.state}.` });
  y = drawRichParagraph(page, situationSpans, y, fonts, { justify: false });
  y -= SECTION_TEXT_SPACING;

  y = drawHeading(page, "3 - LIMITES E CONFRONTANTES:", y, fonts);

  const boundarySpans: RichSpan[] = [];
  data.boundaries.forEach((boundary, index) => {
    boundarySpans.push(
      ...boundarySentence(
        boundary,
        index < data.boundaries.length - 1 ? "," : ".",
      ),
    );
  });
  const landArea = `${formatNumber(data.landArea, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}m²;`;
  boundarySpans.push(
    { text: "Perfazendo uma área total equivalente a" },
    { text: landArea, font: "bold" },
  );
  if (data.landAreaInWords) {
    boundarySpans.push({ text: `(${data.landAreaInWords}).` });
  }
  y = drawRichParagraph(page, boundarySpans, y, fonts, {
    justify: true,
    lineHeight: BODY_LINE_HEIGHT,
  });
  y -= SECTION_TEXT_SPACING;

  y = drawHeading(page, "4 - UTILIZAÇÃO:", y, fonts);
  const building =
    data.builtArea && data.builtArea > 0
      ? `${formatNumber(data.builtArea)}m²${
          data.builtAreaInWords ? ` (${data.builtAreaInWords})` : ""
        }`
      : "Sem edificação";
  y = drawRichParagraph(
    page,
    [
      { text: "I - IMÓVEL:", font: "bold", italic: true },
      { text: `${building}.`, italic: true },
    ],
    y,
    fonts,
    { justify: false, size: 11 },
  );
  y = drawRichParagraph(
    page,
    [
      { text: "II - DELIMITAÇÃO:", font: "bold", italic: true },
      { text: `${data.delimitation}.`, italic: true },
    ],
    y,
    fonts,
    { justify: false, size: 11 },
  );
  y = drawRichParagraph(
    page,
    [
      { text: "III - OUTRAS BENFEITORIAS:", font: "bold", italic: true },
      { text: `${data.improvements.join(", ")}.`, italic: true },
    ],
    y,
    fonts,
    { justify: true, size: 11 },
  );
  y -= SECTION_TEXT_SPACING;

  const dateLine = `${data.city} (${data.state}), ${formatDate(data.documentDate)}.`;
  const dateWidth = fonts.regular.widthOfTextAtSize(dateLine, 11);
  page.drawText(dateLine, {
    x: (A4.width - dateWidth) / 2,
    y: Math.max(y - 42, 174),
    size: 11,
    font: fonts.regular,
    color: BLACK,
  });

  const signatureY = 105;
  page.drawLine({
    start: { x: 84, y: signatureY + 25 },
    end: { x: 270, y: signatureY + 25 },
    thickness: 0.5,
    color: BLACK,
  });
  page.drawLine({
    start: { x: 325, y: signatureY + 25 },
    end: { x: 511, y: signatureY + 25 },
    thickness: 0.5,
    color: BLACK,
  });
  const leftName = "Gabriel de Araújo Ramos";
  const rightName = "Elesbão Pinto Magalhães Filho";
  page.drawText(leftName, {
    x: 177 - fonts.regular.widthOfTextAtSize(leftName, 8.7) / 2,
    y: signatureY + 11,
    size: 8.7,
    font: fonts.regular,
  });
  page.drawText("Resp. Técnico - SEMOBI", {
    x: 177 - fonts.regular.widthOfTextAtSize("Resp. Técnico - SEMOBI", 7.7) / 2,
    y: signatureY,
    size: 7.7,
    font: fonts.regular,
  });
  page.drawText("CREA/CFT: 1909916552/23134151391", {
    x:
      177 -
      fonts.regular.widthOfTextAtSize(
        "CREA/CFT: 1909916552/23134151391",
        6.8,
      ) /
        2,
    y: signatureY - 11,
    size: 6.8,
    font: fonts.regular,
  });
  page.drawText(rightName, {
    x: 418 - fonts.regular.widthOfTextAtSize(rightName, 8.4) / 2,
    y: signatureY + 11,
    size: 8.4,
    font: fonts.regular,
  });
  page.drawText("Fiscal de Obras", {
    x: 418 - fonts.regular.widthOfTextAtSize("Fiscal de Obras", 7.7) / 2,
    y: signatureY,
    size: 7.7,
    font: fonts.regular,
  });
  page.drawText("Mat. 110351", {
    x: 418 - fonts.regular.widthOfTextAtSize("Mat. 110351", 7.7) / 2,
    y: signatureY - 11,
    size: 7.7,
    font: fonts.regular,
  });

  page.drawLine({
    start: { x: MARGIN, y: 43 },
    end: { x: A4.width - MARGIN, y: 43 },
    thickness: 0.5,
    color: BLACK,
  });
  const footer1 = "Avenida José Silva, S/N - Bairro Quiabos";
  const footer2 = "Coelho Neto - MA - CEP: 65.620-000";
  page.drawText(footer1, {
    x: (A4.width - fonts.bold.widthOfTextAtSize(footer1, 7.1)) / 2,
    y: 29,
    size: 7.1,
    font: fonts.bold,
  });
  page.drawText(footer2, {
    x: (A4.width - fonts.bold.widthOfTextAtSize(footer2, 7.1)) / 2,
    y: 18,
    size: 7.1,
    font: fonts.bold,
  });

  document.setTitle(
    `Informações Topográficas - ${data.claimantName || "Imóvel"}`,
  );
  document.setAuthor("SEMOBI - Prefeitura de Coelho Neto");
  return document.save();
}
