import type { Sql } from "postgres";
import { createDatabaseClient } from "./database";
import type { SexCode, StaffRole } from "./topographic";

export type UserRole = "admin" | "operator" | "reviewer";

export type AppUser = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  active: boolean;
  pictureUrl: string | null;
  professionalRole: StaffRole | null;
  sex: SexCode;
  registration: string;
};

export type ManagedUser = AppUser & {
  lastLoginAt: string | null;
  createdAt: string;
};

export type AccessRequestInput = {
  fullName: string;
  email: string;
  phone: string;
  jobTitle: string;
  registration: string;
};

export type AccessRequest = AccessRequestInput & {
  id: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

type UserRow = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  active: boolean;
  picture_url: string | null;
  last_login_at?: Date | string | null;
  created_at?: Date | string;
  professional_role: StaffRole | null;
  sex_code: SexCode | null;
  registration: string | null;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function ensureAccessRequestsTable(sql: Sql) {
  await sql`
    create table if not exists access_requests (
      id uuid primary key default gen_random_uuid(),
      full_name text not null,
      email text not null,
      phone text not null,
      job_title text not null,
      registration text not null,
      status text not null default 'pending',
      reviewed_by_user_id uuid references app_users (id),
      reviewed_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint access_requests_status_check
        check (status in ('pending', 'approved', 'rejected'))
    )
  `;
  await sql`
    create unique index if not exists access_requests_email_idx
      on access_requests (lower(email))
  `;
}

export async function createAccessRequest(input: AccessRequestInput) {
  const fullName = input.fullName.trim().replace(/\s+/g, " ");
  const email = normalizeEmail(input.email);
  const phone = input.phone.trim();
  const phoneDigits = phone.replace(/\D/g, "");
  const jobTitle = input.jobTitle.trim().replace(/\s+/g, " ");
  const registration = input.registration.trim();

  if (
    fullName.length < 5 ||
    fullName.length > 120 ||
    !/^[^@\s]+@gmail\.com$/i.test(email) ||
    phoneDigits.length < 10 ||
    phoneDigits.length > 11 ||
    phone.length > 20 ||
    jobTitle.length < 2 ||
    jobTitle.length > 100 ||
    registration.length < 1 ||
    registration.length > 50
  ) {
    throw new Error("INVALID_ACCESS_REQUEST");
  }

  const sql = createDatabaseClient();
  if (!sql) throw new Error("DATABASE_UNAVAILABLE");

  try {
    await ensureAccessRequestsTable(sql);
    const [authorized] = await sql<{ id: string }[]>`
      select id
      from app_users
      where lower(email) = ${email} and active
      limit 1
    `;
    if (authorized) throw new Error("ALREADY_AUTHORIZED");

    const [request] = await sql<{ id: string }[]>`
      insert into access_requests (
        full_name,
        email,
        phone,
        job_title,
        registration,
        status
      ) values (
        ${fullName},
        ${email},
        ${phone},
        ${jobTitle},
        ${registration},
        'pending'
      )
      on conflict (lower(email)) do update
      set
        full_name = excluded.full_name,
        phone = excluded.phone,
        job_title = excluded.job_title,
        registration = excluded.registration,
        status = 'pending',
        reviewed_by_user_id = null,
        reviewed_at = null,
        updated_at = now()
      returning id
    `;
    if (!request) throw new Error("ACCESS_REQUEST_FAILED");
    return request.id;
  } finally {
    await sql.end();
  }
}

export async function listPendingAccessRequests(): Promise<AccessRequest[]> {
  const sql = createDatabaseClient();
  if (!sql) return [];
  try {
    await ensureAccessRequestsTable(sql);
    const rows = await sql<
      Array<{
        id: string;
        full_name: string;
        email: string;
        phone: string;
        job_title: string;
        registration: string;
        status: AccessRequest["status"];
        created_at: Date | string;
      }>
    >`
      select id, full_name, email, phone, job_title, registration, status, created_at
      from access_requests
      where status = 'pending'
      order by created_at asc
    `;
    return rows.map((row) => ({
      id: row.id,
      fullName: row.full_name,
      email: row.email,
      phone: row.phone,
      jobTitle: row.job_title,
      registration: row.registration,
      status: row.status,
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : new Date(row.created_at).toISOString(),
    }));
  } finally {
    await sql.end();
  }
}

export async function reviewAccessRequest(input: {
  id: string;
  reviewerId: string;
  action: "approve" | "reject";
}) {
  const sql = createDatabaseClient();
  if (!sql) throw new Error("DATABASE_UNAVAILABLE");
  try {
    await ensureAccessRequestsTable(sql);
    const [request] = await sql<
      Array<{ id: string; full_name: string; email: string }>
    >`
      select id, full_name, email
      from access_requests
      where id = ${input.id}::uuid and status = 'pending'
      limit 1
    `;
    if (!request) throw new Error("ACCESS_REQUEST_NOT_FOUND");

    if (input.action === "approve") {
      await sql`
        insert into app_users (email, full_name, role, active)
        values (${request.email}, ${request.full_name}, 'operator', true)
        on conflict (lower(email)) do update
        set
          full_name = excluded.full_name,
          active = true,
          updated_at = now()
      `;
    }

    await sql`
      update access_requests
      set
        status = ${input.action === "approve" ? "approved" : "rejected"},
        reviewed_by_user_id = ${input.reviewerId}::uuid,
        reviewed_at = now(),
        updated_at = now()
      where id = ${input.id}::uuid
    `;
  } finally {
    await sql.end();
  }
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapUser(row: UserRow): AppUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    active: row.active,
    pictureUrl: row.picture_url,
    professionalRole: row.professional_role,
    sex: row.sex_code || "not_informed",
    registration: row.registration || "",
  };
}

function validateProfessionalData(input: {
  professionalRole: StaffRole | null;
  sex: SexCode;
  registration: string;
}) {
  if (
    input.professionalRole &&
    (!input.registration.trim() ||
      !["female", "male", "not_informed"].includes(input.sex))
  ) {
    throw new Error("INVALID_PROFESSIONAL_DATA");
  }
}

async function syncMunicipalStaff(
  sql: Sql,
  input: {
    userId: string;
    fullName: string;
    active: boolean;
    professionalRole: StaffRole | null;
    sex: SexCode;
    registration: string;
  },
) {
  validateProfessionalData(input);

  if (!input.professionalRole) {
    await sql`
      update municipal_staff
      set app_user_id = null, active = false, updated_at = now()
      where app_user_id = ${input.userId}::uuid
    `;
    return;
  }

  await sql`
    insert into municipal_staff (
      app_user_id,
      full_name,
      role,
      sex_code,
      registration,
      active
    ) values (
      ${input.userId}::uuid,
      ${input.fullName},
      ${input.professionalRole},
      ${input.sex},
      ${input.registration.trim()},
      ${input.active}
    )
    on conflict (app_user_id) do update
    set
      full_name = excluded.full_name,
      role = excluded.role,
      sex_code = excluded.sex_code,
      registration = excluded.registration,
      active = excluded.active,
      updated_at = now()
  `;
}

async function ensureInitialAdmin(sql: Sql, email: string) {
  const initialAdminEmail = normalizeEmail(
    process.env.INITIAL_ADMIN_EMAIL || "semobicn.ia@gmail.com",
  );
  if (email !== initialAdminEmail) return;

  await sql`
    insert into app_users (email, full_name, role)
    values (
      ${initialAdminEmail},
      'Administrador SEMOBICN IA',
      'admin'
    )
    on conflict do nothing
  `;
}

export async function findAuthorizedUser(
  emailValue: string | null | undefined,
): Promise<AppUser | null> {
  if (!emailValue) return null;
  const email = normalizeEmail(emailValue);
  const sql = createDatabaseClient();
  if (!sql) return null;

  try {
    await ensureInitialAdmin(sql, email);
    const [row] = await sql<UserRow[]>`
      select
        users.id,
        users.email,
        users.full_name,
        users.role,
        users.active,
        users.picture_url,
        staff.role as professional_role,
        staff.sex_code,
        staff.registration
      from app_users users
      left join municipal_staff staff on staff.app_user_id = users.id
      where lower(users.email) = ${email}
      limit 1
    `;
    if (!row?.active) return null;
    return mapUser(row);
  } finally {
    await sql.end();
  }
}

export async function recordSuccessfulLogin(input: {
  email: string;
  fullName?: string | null;
  pictureUrl?: string | null;
}) {
  const sql = createDatabaseClient();
  if (!sql) return;
  const email = normalizeEmail(input.email);

  try {
    await sql`
      update app_users
      set
        full_name = coalesce(nullif(${input.fullName?.trim() || null}, ''), full_name),
        picture_url = coalesce(${input.pictureUrl || null}, picture_url),
        last_login_at = now(),
        updated_at = now()
      where lower(email) = ${email}
        and active
    `;
  } finally {
    await sql.end();
  }
}

export async function listManagedUsers(): Promise<ManagedUser[]> {
  const sql = createDatabaseClient();
  if (!sql) return [];

  try {
    const rows = await sql<UserRow[]>`
      select
        users.id,
        users.email,
        users.full_name,
        users.role,
        users.active,
        users.picture_url,
        users.last_login_at,
        users.created_at,
        staff.role as professional_role,
        staff.sex_code,
        staff.registration
      from app_users users
      left join municipal_staff staff on staff.app_user_id = users.id
      order by users.active desc, users.full_name, users.email
    `;
    return rows.map((row) => ({
      ...mapUser(row),
      lastLoginAt: toIso(row.last_login_at),
      createdAt: toIso(row.created_at) || new Date(0).toISOString(),
    }));
  } finally {
    await sql.end();
  }
}

export async function createManagedUser(input: {
  email: string;
  fullName: string;
  role: UserRole;
  professionalRole: StaffRole | null;
  sex: SexCode;
  registration: string;
}): Promise<ManagedUser> {
  const email = normalizeEmail(input.email);
  const fullName = input.fullName.trim();
  if (!email || !email.includes("@") || !fullName) {
    throw new Error("INVALID_USER");
  }

  const sql = createDatabaseClient();
  if (!sql) throw new Error("DATABASE_UNAVAILABLE");
  validateProfessionalData(input);

  try {
    const [row] = await sql<UserRow[]>`
      insert into app_users (email, full_name, role)
      values (${email}, ${fullName}, ${input.role})
      returning
        id,
        email,
        full_name,
        role,
        active,
        picture_url,
        last_login_at,
        created_at,
        null::text as professional_role,
        null::text as sex_code,
        null::text as registration
    `;
    await syncMunicipalStaff(sql, {
      userId: row.id,
      fullName,
      active: true,
      professionalRole: input.professionalRole,
      sex: input.sex,
      registration: input.registration,
    });
    return {
      ...mapUser(row),
      professionalRole: input.professionalRole,
      sex: input.sex,
      registration: input.registration.trim(),
      lastLoginAt: toIso(row.last_login_at),
      createdAt: toIso(row.created_at) || new Date().toISOString(),
    };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new Error("EMAIL_EXISTS");
    }
    throw error;
  } finally {
    await sql.end();
  }
}

export async function updateManagedUser(input: {
  id: string;
  currentUserId: string;
  fullName: string;
  role: UserRole;
  active: boolean;
  professionalRole: StaffRole | null;
  sex: SexCode;
  registration: string;
}): Promise<ManagedUser> {
  if (input.id === input.currentUserId && (!input.active || input.role !== "admin")) {
    throw new Error("CANNOT_CHANGE_SELF_ACCESS");
  }

  const fullName = input.fullName.trim();
  if (!fullName) throw new Error("INVALID_USER");
  validateProfessionalData(input);

  const sql = createDatabaseClient();
  if (!sql) throw new Error("DATABASE_UNAVAILABLE");

  try {
    const [row] = await sql<UserRow[]>`
      update app_users
      set
        full_name = ${fullName},
        role = ${input.role},
        active = ${input.active},
        updated_at = now()
      where id = ${input.id}::uuid
      returning
        id,
        email,
        full_name,
        role,
        active,
        picture_url,
        last_login_at,
        created_at,
        null::text as professional_role,
        null::text as sex_code,
        null::text as registration
    `;
    if (!row) throw new Error("USER_NOT_FOUND");
    await syncMunicipalStaff(sql, {
      userId: row.id,
      fullName,
      active: input.active,
      professionalRole: input.professionalRole,
      sex: input.sex,
      registration: input.registration,
    });
    return {
      ...mapUser(row),
      professionalRole: input.professionalRole,
      sex: input.sex,
      registration: input.registration.trim(),
      lastLoginAt: toIso(row.last_login_at),
      createdAt: toIso(row.created_at) || new Date().toISOString(),
    };
  } finally {
    await sql.end();
  }
}
