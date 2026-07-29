import postgres from "postgres";
import {
  defaultSexOptions,
  defaultTechnicalResponsible,
  defaultWorksInspector,
  type SexCode,
  type SexOption,
  type StaffMember,
  type StaffRole,
  type TopographicData,
} from "./topographic";

type ProcessInput = {
  data: TopographicData;
  createdByUserId: string;
  sourceUrl?: string;
  sourcePublicId?: string;
  supplementaryMessage?: string;
};

export type ReferenceData = {
  sexOptions: SexOption[];
  staff: StaffMember[];
};

function fallbackReferenceData(): ReferenceData {
  return {
    sexOptions: defaultSexOptions.map((option) => ({ ...option })),
    staff: [
      { ...defaultTechnicalResponsible },
      { ...defaultWorksInspector },
    ],
  };
}

export function createDatabaseClient() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) return null;
  return postgres(databaseUrl, {
    ssl: "require",
    max: 1,
    idle_timeout: 10,
  });
}

export async function getReferenceData(): Promise<ReferenceData> {
  const sql = createDatabaseClient();
  if (!sql) return fallbackReferenceData();

  try {
    const [sexRows, staffRows] = await Promise.all([
      sql<{ code: SexCode; label: string }[]>`
        select code, label
        from sex_options
        where active
        order by sort_order, label
      `,
      sql<
        {
          id: string;
          full_name: string;
          role: StaffRole;
          sex_code: SexCode;
          registration: string;
        }[]
      >`
        select id, full_name, role, sex_code, registration
        from municipal_staff
        where active
        order by role, sort_order, full_name
      `,
    ]);

    return {
      sexOptions:
        sexRows.length > 0
          ? sexRows.map((row) => ({ code: row.code, label: row.label }))
          : fallbackReferenceData().sexOptions,
      staff:
        staffRows.length > 0
          ? staffRows.map((row) => ({
              id: row.id,
              fullName: row.full_name,
              role: row.role,
              sex: row.sex_code,
              registration: row.registration,
            }))
          : fallbackReferenceData().staff,
    };
  } finally {
    await sql.end();
  }
}

export async function saveProcess(input: ProcessInput): Promise<string | null> {
  const sql = createDatabaseClient();
  if (!sql) return null;

  try {
    const [row] = await sql<{ id: string }[]>`
      insert into topographic_processes (
        claimant_name,
        claimant_sex_code,
        property_address,
        block_number,
        lot_number,
        technical_responsible_id,
        works_inspector_id,
        created_by_user_id,
        source_pdf_url,
        source_public_id,
        supplementary_message,
        extracted_data
      ) values (
        ${input.data.claimantName},
        ${input.data.claimantSex},
        ${input.data.propertyAddress},
        ${input.data.block || null},
        ${input.data.lot || null},
        coalesce(
          ${input.data.technicalResponsible.id}::uuid,
          (
            select id from municipal_staff
            where role = 'technical_responsible' and active
            order by sort_order, full_name
            limit 1
          )
        ),
        coalesce(
          ${input.data.worksInspector.id}::uuid,
          (
            select id from municipal_staff
            where role = 'works_inspector' and active
            order by sort_order, full_name
            limit 1
          )
        ),
        ${input.createdByUserId}::uuid,
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
