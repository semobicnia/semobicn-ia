import {
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import { boundaryLabels, type TopographicData } from "./topographic";

const A4 = { width: 595.28, height: 841.89 };
const margin = 50;
const textWidth = A4.width - margin * 2;

function formatNumber(value: number | null, digits = 2) {
  if (value === null) return "Não informado";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
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

function splitText(text: string, font: PDFFont, size: number, width: number) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawParagraph(
  page: PDFPage,
  text: string,
  y: number,
  font: PDFFont,
  options?: { size?: number; lineHeight?: number; color?: ReturnType<typeof rgb> },
) {
  const size = options?.size ?? 10.5;
  const lineHeight = options?.lineHeight ?? 15.5;
  const lines = splitText(text, font, size, textWidth);
  lines.forEach((line, index) => {
    page.drawText(line, {
      x: margin,
      y: y - index * lineHeight,
      size,
      font,
      color: options?.color ?? rgb(0.08, 0.1, 0.09),
    });
  });
  return y - lines.length * lineHeight;
}

export async function createTopographicPdf(data: TopographicData) {
  const document = await PDFDocument.create();
  const page = document.addPage([A4.width, A4.height]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const italic = await document.embedFont(StandardFonts.HelveticaOblique);
  const boldItalic = await document.embedFont(
    StandardFonts.HelveticaBoldOblique,
  );

  page.drawText("SEMOBI", {
    x: margin,
    y: 790,
    size: 25,
    font: bold,
    color: rgb(0.05, 0.28, 0.72),
  });
  page.drawText("SECRETARIA MUNICIPAL DE OBRAS E INFRAESTRUTURA", {
    x: margin + 2,
    y: 778,
    size: 5.8,
    font: bold,
    color: rgb(0.05, 0.28, 0.72),
  });
  page.drawText("PREFEITURA DE", {
    x: 338,
    y: 800,
    size: 6.5,
    font: bold,
    color: rgb(0.05, 0.28, 0.72),
  });
  page.drawText("COELHO NETO", {
    x: 338,
    y: 782,
    size: 18,
    font: bold,
    color: rgb(0.05, 0.28, 0.72),
  });
  page.drawText("A MARCA DO TRABALHO", {
    x: 375,
    y: 771,
    size: 5.8,
    font: bold,
    color: rgb(0.05, 0.28, 0.72),
  });
  page.drawLine({
    start: { x: margin, y: 755 },
    end: { x: A4.width - margin, y: 755 },
    thickness: 0.6,
    color: rgb(0.15, 0.15, 0.15),
  });

  page.drawText("SEMOBI", {
    x: 185,
    y: 240,
    size: 78,
    font: bold,
    color: rgb(0.93, 0.94, 0.93),
    rotate: degrees(48),
  });

  let y = 718;
  page.drawText("1 - INFORMAÇÕES TOPOGRÁFICAS", {
    x: margin,
    y,
    size: 11,
    font: boldItalic,
  });
  y -= 21;
  y = drawParagraph(
    page,
    `Com referência ao terreno requerido por ${data.claimantName.toUpperCase()}, ${data.nationality}, portador(a) do CPF nº ${data.cpf || "não informado"}, residente e domiciliado(a) em ${data.residence}.`,
    y,
    regular,
  );
  y -= 5;

  page.drawText("2 - SITUAÇÃO", {
    x: margin,
    y,
    size: 11,
    font: boldItalic,
  });
  y -= 21;
  const situation = [
    data.propertyAddress.toUpperCase(),
    data.block ? `QUADRA: ${data.block}` : "",
    data.lot ? `LOTE: ${data.lot}` : "",
    data.neighborhood ? `BAIRRO: ${data.neighborhood.toUpperCase()}` : "",
    `${data.city} - ${data.state}`,
  ]
    .filter(Boolean)
    .join(", ");
  y = drawParagraph(page, situation, y, bold);
  y -= 8;

  page.drawText("Com os seguintes limites:", {
    x: margin,
    y,
    size: 10.5,
    font: boldItalic,
  });
  y -= 21;

  for (const boundary of data.boundaries) {
    const measurement =
      boundary.measurement === null
        ? "medida não informada"
        : `${formatNumber(boundary.measurement)} m`;
    const words = boundary.measurementInWords
      ? ` (${boundary.measurementInWords})`
      : "";
    y = drawParagraph(
      page,
      `${boundaryLabels[boundary.side]} limitando-se com ${boundary.label || "TERRENOS DE TERCEIROS"}, medindo ${measurement}${words}.`,
      y,
      regular,
    );
    y -= 2;
  }

  const landWords = data.landAreaInWords
    ? ` (${data.landAreaInWords})`
    : "";
  y = drawParagraph(
    page,
    `Perfazendo uma área total equivalente a ${formatNumber(data.landArea)} m²${landWords}.`,
    y,
    bold,
  );
  y -= 7;

  page.drawText("3 - UTILIZAÇÃO", {
    x: margin,
    y,
    size: 11,
    font: boldItalic,
  });
  y -= 21;

  const building =
    data.builtArea && data.builtArea > 0
      ? `${formatNumber(data.builtArea)} m²${data.builtAreaInWords ? ` (${data.builtAreaInWords})` : ""}`
      : "Sem edificação";
  y = drawParagraph(page, `I - IMÓVEL: ${building}.`, y, boldItalic);
  y = drawParagraph(
    page,
    `II - DELIMITAÇÃO: ${data.delimitation}.`,
    y - 2,
    italic,
  );
  y = drawParagraph(
    page,
    `III - OUTRAS BENFEITORIAS: ${data.improvements.join(", ")}.`,
    y - 2,
    italic,
  );

  const dateLine = `${data.city} (${data.state}), ${formatDate(data.documentDate)}.`;
  const dateWidth = regular.widthOfTextAtSize(dateLine, 10.5);
  page.drawText(dateLine, {
    x: (A4.width - dateWidth) / 2,
    y: Math.max(y - 48, 178),
    size: 10.5,
    font: regular,
  });

  const signatureY = 112;
  page.drawLine({
    start: { x: 94, y: signatureY + 25 },
    end: { x: 270, y: signatureY + 25 },
    thickness: 0.5,
  });
  page.drawLine({
    start: { x: 326, y: signatureY + 25 },
    end: { x: 502, y: signatureY + 25 },
    thickness: 0.5,
  });
  page.drawText("Gabriel de Araújo Ramos", {
    x: 120,
    y: signatureY + 11,
    size: 9.5,
    font: regular,
  });
  page.drawText("Resp. Técnico - SEMOBI", {
    x: 126,
    y: signatureY - 2,
    size: 8.5,
    font: regular,
  });
  page.drawText("CREA/CFT: 1909916552/23134151391", {
    x: 101,
    y: signatureY - 15,
    size: 7.8,
    font: regular,
  });
  page.drawText("Elesbão Pinto Magalhães Filho", {
    x: 339,
    y: signatureY + 11,
    size: 9.2,
    font: regular,
  });
  page.drawText("Fiscal de Obras", {
    x: 389,
    y: signatureY - 2,
    size: 8.5,
    font: regular,
  });
  page.drawText("Mat. 110351", {
    x: 401,
    y: signatureY - 15,
    size: 8.5,
    font: regular,
  });

  page.drawLine({
    start: { x: margin, y: 45 },
    end: { x: A4.width - margin, y: 45 },
    thickness: 0.5,
  });
  const footer = "Avenida José Silva, S/N - Bairro Quiabos";
  const footer2 = "Coelho Neto - MA - CEP: 65.620-000";
  page.drawText(footer, {
    x: (A4.width - bold.widthOfTextAtSize(footer, 7.5)) / 2,
    y: 32,
    size: 7.5,
    font: bold,
  });
  page.drawText(footer2, {
    x: (A4.width - bold.widthOfTextAtSize(footer2, 7.5)) / 2,
    y: 21,
    size: 7.5,
    font: bold,
  });

  document.setTitle(
    `Informações Topográficas - ${data.claimantName || "Imóvel"}`,
  );
  document.setAuthor("SEMOBI - Prefeitura de Coelho Neto");
  return document.save();
}
