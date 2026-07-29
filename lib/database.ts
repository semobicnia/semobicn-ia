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

export type ProcessSummary = {
  id: string;
  status: "review" | "completed";
  claimantName: string;
  propertyAddress: string;
  blockNumber: string | null;
  lotNumber: string | null;
  createdByName: string;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
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

export async function markProcessCompleted(
  processId: string,
  userId: string,
): Promise<void> {
  const sql = createDatabaseClient();
  if (!sql) return;

  try {
    await sql`
      update topographic_processes
      set status = 'completed', updated_at = now()
      where id = ${processId}::uuid
        and (
          created_by_user_id = ${userId}::uuid
          or exists (
            select 1 from app_users
            where id = ${userId}::uuid and role in ('admin', 'reviewer') and active
          )
        )
    `;
  } finally {
    await sql.end();
  }
}

export async function listProcesses(input: {
  userId: string;
  role: "admin" | "operator" | "reviewer";
  search?: string;
  limit?: number;
}): Promise<ProcessSummary[]> {
  const sql = createDatabaseClient();
  if (!sql) return [];
  const search = input.search?.trim() || "";
  const limit = Math.min(Math.max(input.limit || 50, 1), 100);

  try {
    const rows = await sql<
      {
        id: string;
        status: "review" | "completed";
        claimant_name: string;
        property_address: string;
        block_number: string | null;
        lot_number: string | null;
        created_by_name: string | null;
        created_by_email: string | null;
        created_at: Date | string;
        updated_at: Date | string;
      }[]
    >`
      select
        process.id,
        process.status,
        process.claimant_name,
        process.property_address,
        process.block_number,
        process.lot_number,
        creator.full_name as created_by_name,
        creator.email as created_by_email,
        process.created_at,
        process.updated_at
      from topographic_processes process
      left join app_users creator on creator.id = process.created_by_user_id
      where
        (${input.role} <> 'operator' or process.created_by_user_id = ${input.userId}::uuid)
        and (
          ${search} = ''
          or process.claimant_name ilike ${`%${search}%`}
          or process.property_address ilike ${`%${search}%`}
          or coalesce(process.block_number, '') ilike ${`%${search}%`}
          or coalesce(process.lot_number, '') ilike ${`%${search}%`}
        )
      order by process.created_at desc
      limit ${limit}
    `;

    const iso = (value: Date | string) =>
      value instanceof Date ? value.toISOString() : new Date(value).toISOString();
    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      claimantName: row.claimant_name,
      propertyAddress: row.property_address,
      blockNumber: row.block_number,
      lotNumber: row.lot_number,
      createdByName: row.created_by_name || "Usuário não identificado",
      createdByEmail: row.created_by_email || "",
      createdAt: iso(row.created_at),
      updatedAt: iso(row.updated_at),
    }));
  } finally {
    await sql.end();
  }
}
