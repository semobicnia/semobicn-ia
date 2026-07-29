import postgres from "postgres";
import type { TopographicData } from "./topographic";

type ProcessInput = {
  data: TopographicData;
  sourceUrl?: string;
  sourcePublicId?: string;
  supplementaryMessage?: string;
};

export async function saveProcess(input: ProcessInput): Promise<string | null> {
  if (!process.env.DATABASE_URL) return null;

  const sql = postgres(process.env.DATABASE_URL, {
    ssl: "require",
    max: 1,
    idle_timeout: 10,
  });

  try {
    const [row] = await sql<{ id: string }[]>`
      insert into topographic_processes (
        claimant_name,
        property_address,
        block_number,
        lot_number,
        source_pdf_url,
        source_public_id,
        supplementary_message,
        extracted_data
      ) values (
        ${input.data.claimantName},
        ${input.data.propertyAddress},
        ${input.data.block || null},
        ${input.data.lot || null},
        ${input.sourceUrl || null},
        ${input.sourcePublicId || null},
        ${input.supplementaryMessage || null},
        ${sql.json(input.data)}
      )
      returning id
    `;
    return row?.id ?? null;
  } finally {
    await sql.end();
  }
}
