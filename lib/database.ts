import postgres from "postgres";
import {
  defaultUrbanSketchSettings,
  type UrbanSketchSettings,
} from "./croqui";
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

export type ProcessStatus =
  | "review"
  | "approved"
  | "completed"
  | "cancelled"
  | "archived";

export type ReferenceData = {
  sexOptions: SexOption[];
  staff: StaffMember[];
};

export type ProcessSummary = {
  id: string;
  status: ProcessStatus;
  claimantName: string;
  propertyAddress: string;
  blockNumber: string | null;
  lotNumber: string | null;
  createdByName: string;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
};

export type ProcessEvent = {
  id: string;
  action:
    | "created"
    | "updated"
    | "status_changed"
    | "pdf_generated"
    | "source_viewed"
    | "sketch_saved";
  description: string;
  userName: string;
  userEmail: string;
  createdAt: string;
};

export type ProcessDetail = ProcessSummary & {
  data: TopographicData;
  supplementaryMessage: string;
  sourceAvailable: boolean;
  events: ProcessEvent[];
};

export type DashboardStats = {
  total: number;
  review: number;
  approved: number;
  completed: number;
  cancelled: number;
  last30Days: number;
  byUser: Array<{ name: string; email: string; total: number }>;
  recentEvents: Array<ProcessEvent & { processId: string; claimantName: string }>;
};

export type UrbanSketchRecord = {
  id: string;
  processId: string;
  settings: UrbanSketchSettings;
  locationImageAvailable: boolean;
  status: "review" | "finalized";
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
        select staff.id, staff.full_name, staff.role, staff.sex_code, staff.registration
        from municipal_staff staff
        where staff.active
          and (
            staff.app_user_id is not null
            or not exists (
              select 1
              from municipal_staff managed
              where managed.role = staff.role
                and managed.app_user_id is not null
                and managed.active
            )
          )
        order by staff.role, staff.sort_order, staff.full_name
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

export async function getUrbanSketch(
  processId: string,
): Promise<UrbanSketchRecord | null> {
  const sql = createDatabaseClient();
  if (!sql) return null;

  try {
    const [row] = await sql<
      {
        id: string;
        process_id: string;
        settings: Partial<UrbanSketchSettings>;
        location_image_public_id: string | null;
        status: "review" | "finalized";
        updated_at: Date | string;
      }[]
    >`
      select
        id,
        process_id,
        settings,
        location_image_public_id,
        status,
        updated_at
      from urban_sketches
      where process_id = ${processId}::uuid
      limit 1
    `;
    if (!row) return null;
    return {
      id: row.id,
      processId: row.process_id,
      settings: {
        ...defaultUrbanSketchSettings,
        ...row.settings,
      },
      locationImageAvailable: Boolean(row.location_image_public_id),
      status: row.status,
      updatedAt:
        row.updated_at instanceof Date
          ? row.updated_at.toISOString()
          : new Date(row.updated_at).toISOString(),
    };
  } finally {
    await sql.end();
  }
}

export async function getUrbanSketchImage(input: {
  processId: string;
  userId: string;
  role: "admin" | "operator" | "reviewer";
}): Promise<{ publicId: string; format: string } | null> {
  const sql = createDatabaseClient();
  if (!sql) return null;

  try {
    const [row] = await sql<
      { public_id: string | null; format: string | null }[]
    >`
      select
        sketch.location_image_public_id as public_id,
        sketch.location_image_format as format
      from urban_sketches sketch
      join topographic_processes process on process.id = sketch.process_id
      where sketch.process_id = ${input.processId}::uuid
        and (
          ${input.role} <> 'operator'
          or process.created_by_user_id = ${input.userId}::uuid
        )
      limit 1
    `;
    if (!row?.public_id || !row.format) return null;
    return { publicId: row.public_id, format: row.format };
  } finally {
    await sql.end();
  }
}

export async function saveUrbanSketchImage(input: {
  processId: string;
  userId: string;
  role: "admin" | "operator" | "reviewer";
  publicId: string;
  format: string;
}): Promise<boolean> {
  const sql = createDatabaseClient();
  if (!sql) return false;

  try {
    const [allowed] = await sql<{ id: string }[]>`
      select process.id
      from topographic_processes process
      where process.id = ${input.processId}::uuid
        and (
          ${input.role} <> 'operator'
          or process.created_by_user_id = ${input.userId}::uuid
        )
      limit 1
    `;
    if (!allowed) return false;

    await sql`
      insert into urban_sketches (
        process_id,
        created_by_user_id,
        settings,
        location_image_public_id,
        location_image_format
      ) values (
        ${input.processId}::uuid,
        ${input.userId}::uuid,
        ${sql.json(defaultUrbanSketchSettings)},
        ${input.publicId},
        ${input.format}
      )
      on conflict (process_id) do update
      set
        location_image_public_id = excluded.location_image_public_id,
        location_image_format = excluded.location_image_format,
        updated_at = now()
    `;

    await sql`
      insert into process_events (
        process_id,
        user_id,
        action,
        description,
        metadata
      ) values (
        ${input.processId}::uuid,
        ${input.userId}::uuid,
        'sketch_saved',
        'Imagem de localização do croqui armazenada.',
        ${sql.json({ format: input.format })}
      )
    `;
    return true;
  } finally {
    await sql.end();
  }
}

export async function saveUrbanSketch(input: {
  processId: string;
  userId: string;
  role: "admin" | "operator" | "reviewer";
  settings: UrbanSketchSettings;
}): Promise<boolean> {
  const sql = createDatabaseClient();
  if (!sql) return false;

  try {
    const [allowed] = await sql<{ id: string }[]>`
      select process.id
      from topographic_processes process
      where process.id = ${input.processId}::uuid
        and (
          ${input.role} <> 'operator'
          or process.created_by_user_id = ${input.userId}::uuid
        )
      limit 1
    `;
    if (!allowed) return false;

    await sql`
      insert into urban_sketches (
        process_id,
        created_by_user_id,
        settings
      ) values (
        ${input.processId}::uuid,
        ${input.userId}::uuid,
        ${sql.json(input.settings)}
      )
      on conflict (process_id) do update
      set
        settings = excluded.settings,
        updated_at = now()
    `;

    await sql`
      insert into process_events (
        process_id,
        user_id,
        action,
        description,
        metadata
      ) values (
        ${input.processId}::uuid,
        ${input.userId}::uuid,
        'sketch_saved',
        'Croqui urbano salvo ou atualizado.',
        ${sql.json({ settings: input.settings })}
      )
    `;
    return true;
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
    if (row?.id) {
      await sql`
        insert into process_events (
          process_id,
          user_id,
          action,
          description
        ) values (
          ${row.id}::uuid,
          ${input.createdByUserId}::uuid,
          'created',
          'Processo criado a partir da análise do croqui.'
        )
      `;
    }
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
    await sql`
      insert into process_events (
        process_id,
        user_id,
        action,
        description
      )
      select
        ${processId}::uuid,
        ${userId}::uuid,
        'pdf_generated',
        'Documento PDF gerado.'
      where exists (
        select 1
        from topographic_processes process
        where process.id = ${processId}::uuid
          and (
            process.created_by_user_id = ${userId}::uuid
            or exists (
              select 1 from app_users
              where id = ${userId}::uuid
                and role in ('admin', 'reviewer')
                and active
            )
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
        status: ProcessStatus;
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

export async function getProcessDetail(input: {
  processId: string;
  userId: string;
  role: "admin" | "operator" | "reviewer";
}): Promise<ProcessDetail | null> {
  const sql = createDatabaseClient();
  if (!sql) return null;

  try {
    const [row] = await sql<
      {
        id: string;
        status: ProcessStatus;
        claimant_name: string;
        property_address: string;
        block_number: string | null;
        lot_number: string | null;
        created_by_name: string | null;
        created_by_email: string | null;
        supplementary_message: string | null;
        source_public_id: string | null;
        extracted_data: TopographicData;
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
        process.supplementary_message,
        process.source_public_id,
        process.extracted_data,
        process.created_at,
        process.updated_at
      from topographic_processes process
      left join app_users creator on creator.id = process.created_by_user_id
      where process.id = ${input.processId}::uuid
        and (
          ${input.role} <> 'operator'
          or process.created_by_user_id = ${input.userId}::uuid
        )
      limit 1
    `;
    if (!row) return null;

    const eventRows = await sql<
      {
        id: string;
        action: ProcessEvent["action"];
        description: string;
        user_name: string | null;
        user_email: string | null;
        created_at: Date | string;
      }[]
    >`
      select
        event.id,
        event.action,
        event.description,
        actor.full_name as user_name,
        actor.email as user_email,
        event.created_at
      from process_events event
      left join app_users actor on actor.id = event.user_id
      where event.process_id = ${input.processId}::uuid
      order by event.created_at desc
    `;
    const iso = (value: Date | string) =>
      value instanceof Date ? value.toISOString() : new Date(value).toISOString();
    return {
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
      data: row.extracted_data,
      supplementaryMessage: row.supplementary_message || "",
      sourceAvailable: Boolean(row.source_public_id),
      events: eventRows.map((event) => ({
        id: event.id,
        action: event.action,
        description: event.description,
        userName: event.user_name || "Sistema",
        userEmail: event.user_email || "",
        createdAt: iso(event.created_at),
      })),
    };
  } finally {
    await sql.end();
  }
}

export async function updateProcess(input: {
  processId: string;
  userId: string;
  role: "admin" | "operator" | "reviewer";
  data: TopographicData;
  status: ProcessStatus;
}): Promise<boolean> {
  const sql = createDatabaseClient();
  if (!sql) return false;

  try {
    const [current] = await sql<{ status: ProcessStatus }[]>`
      select status
      from topographic_processes
      where id = ${input.processId}::uuid
        and (
          ${input.role} <> 'operator'
          or created_by_user_id = ${input.userId}::uuid
        )
      limit 1
    `;
    if (!current) return false;

    const [updated] = await sql<{ id: string }[]>`
      update topographic_processes
      set
        status = ${input.status},
        claimant_name = ${input.data.claimantName},
        claimant_sex_code = ${input.data.claimantSex},
        property_address = ${input.data.propertyAddress},
        block_number = ${input.data.block || null},
        lot_number = ${input.data.lot || null},
        extracted_data = ${sql.json(input.data)},
        updated_at = now()
      where id = ${input.processId}::uuid
      returning id
    `;
    if (!updated) return false;

    await sql`
      insert into process_events (
        process_id,
        user_id,
        action,
        description,
        metadata
      ) values (
        ${input.processId}::uuid,
        ${input.userId}::uuid,
        'updated',
        'Dados topográficos revisados e salvos.',
        ${sql.json({ status: input.status })}
      )
    `;
    if (current.status !== input.status) {
      await sql`
        insert into process_events (
          process_id,
          user_id,
          action,
          description,
          metadata
        ) values (
          ${input.processId}::uuid,
          ${input.userId}::uuid,
          'status_changed',
          ${`Situação alterada de ${current.status} para ${input.status}.`},
          ${sql.json({ from: current.status, to: input.status })}
        )
      `;
    }
    return true;
  } finally {
    await sql.end();
  }
}

export async function getProcessSource(input: {
  processId: string;
  userId: string;
  role: "admin" | "operator" | "reviewer";
}): Promise<{ publicId: string; claimantName: string } | null> {
  const sql = createDatabaseClient();
  if (!sql) return null;

  try {
    const [row] = await sql<
      { source_public_id: string | null; claimant_name: string }[]
    >`
      select source_public_id, claimant_name
      from topographic_processes
      where id = ${input.processId}::uuid
        and (
          ${input.role} <> 'operator'
          or created_by_user_id = ${input.userId}::uuid
        )
      limit 1
    `;
    if (!row?.source_public_id) return null;
    await sql`
      insert into process_events (
        process_id,
        user_id,
        action,
        description
      ) values (
        ${input.processId}::uuid,
        ${input.userId}::uuid,
        'source_viewed',
        'Croqui original consultado.'
      )
    `;
    return {
      publicId: row.source_public_id,
      claimantName: row.claimant_name,
    };
  } finally {
    await sql.end();
  }
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const sql = createDatabaseClient();
  if (!sql) {
    return {
      total: 0,
      review: 0,
      approved: 0,
      completed: 0,
      cancelled: 0,
      last30Days: 0,
      byUser: [],
      recentEvents: [],
    };
  }

  try {
    const [counts, byUserRows, eventRows] = await Promise.all([
      sql<
        {
          total: number;
          review: number;
          approved: number;
          completed: number;
          cancelled: number;
          last_30_days: number;
        }[]
      >`
        select
          count(*)::int as total,
          count(*) filter (where status = 'review')::int as review,
          count(*) filter (where status = 'approved')::int as approved,
          count(*) filter (where status = 'completed')::int as completed,
          count(*) filter (where status = 'cancelled')::int as cancelled,
          count(*) filter (
            where created_at >= now() - interval '30 days'
          )::int as last_30_days
        from topographic_processes
      `,
      sql<{ name: string; email: string; total: number }[]>`
        select
          coalesce(users.full_name, 'Usuário não identificado') as name,
          coalesce(users.email, '') as email,
          count(process.id)::int as total
        from topographic_processes process
        left join app_users users on users.id = process.created_by_user_id
        group by users.id, users.full_name, users.email
        order by total desc, name
        limit 10
      `,
      sql<
        {
          id: string;
          process_id: string;
          claimant_name: string;
          action: ProcessEvent["action"];
          description: string;
          user_name: string | null;
          user_email: string | null;
          created_at: Date | string;
        }[]
      >`
        select
          event.id,
          event.process_id,
          process.claimant_name,
          event.action,
          event.description,
          actor.full_name as user_name,
          actor.email as user_email,
          event.created_at
        from process_events event
        join topographic_processes process on process.id = event.process_id
        left join app_users actor on actor.id = event.user_id
        order by event.created_at desc
        limit 12
      `,
    ]);
    const count = counts[0];
    const iso = (value: Date | string) =>
      value instanceof Date ? value.toISOString() : new Date(value).toISOString();
    return {
      total: count?.total || 0,
      review: count?.review || 0,
      approved: count?.approved || 0,
      completed: count?.completed || 0,
      cancelled: count?.cancelled || 0,
      last30Days: count?.last_30_days || 0,
      byUser: byUserRows,
      recentEvents: eventRows.map((event) => ({
        id: event.id,
        processId: event.process_id,
        claimantName: event.claimant_name,
        action: event.action,
        description: event.description,
        userName: event.user_name || "Sistema",
        userEmail: event.user_email || "",
        createdAt: iso(event.created_at),
      })),
    };
  } finally {
    await sql.end();
  }
}
