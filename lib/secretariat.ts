import type { Sql } from "postgres";
import { getSignedPrivateImageUrl } from "./cloudinary";
import { createDatabaseClient } from "./database";

export type SecretariatSettings = {
  name: string;
  acronym: string;
  logoUrl: string | null;
  secretaryName: string;
  email: string;
  phone: string;
  fullAddress: string;
  cityHallName: string;
  cnpj: string;
  updatedAt: string | null;
};

export type SecretariatSettingsInput = Omit<
  SecretariatSettings,
  "logoUrl" | "updatedAt"
>;

type SecretariatRow = {
  name: string;
  acronym: string;
  logo_public_id: string | null;
  logo_format: string | null;
  secretary_name: string;
  email: string;
  phone: string;
  full_address: string;
  city_hall_name: string;
  cnpj: string;
  updated_at: Date | string;
};

const fallbackSettings: SecretariatSettings = {
  name: "Secretaria Municipal de Obras e Infraestrutura",
  acronym: "SEMOBI",
  logoUrl: null,
  secretaryName: "Antonio Lustosa de Melo",
  email: "",
  phone: "",
  fullAddress: "",
  cityHallName: "Prefeitura Municipal de Coelho Neto",
  cnpj: "",
  updatedAt: null,
};

export async function ensureSecretariatSettingsTable(sql: Sql) {
  await sql`
    create table if not exists secretariat_settings (
      id smallint primary key default 1,
      name text not null,
      acronym text not null,
      logo_public_id text,
      logo_format text,
      secretary_name text not null,
      email text not null,
      phone text not null,
      full_address text not null,
      city_hall_name text not null,
      cnpj text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint secretariat_settings_singleton_check check (id = 1)
    )
  `;
  await sql`
    insert into secretariat_settings (
      id, name, acronym, secretary_name, email, phone,
      full_address, city_hall_name, cnpj
    )
    select
      1,
      'Secretaria Municipal de Obras e Infraestrutura',
      'SEMOBI',
      coalesce(
        (
          select full_name
          from municipal_secretaries
          where active
          order by is_default desc, updated_at desc
          limit 1
        ),
        'Antonio Lustosa de Melo'
      ),
      '', '', '',
      'Prefeitura Municipal de Coelho Neto',
      ''
    )
    on conflict (id) do nothing
  `;
}

function mapSettings(row: SecretariatRow): SecretariatSettings {
  return {
    name: row.name,
    acronym: row.acronym,
    logoUrl:
      row.logo_public_id && row.logo_format
        ? getSignedPrivateImageUrl(row.logo_public_id, row.logo_format)
        : null,
    secretaryName: row.secretary_name,
    email: row.email,
    phone: row.phone,
    fullAddress: row.full_address,
    cityHallName: row.city_hall_name,
    cnpj: row.cnpj,
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : new Date(row.updated_at).toISOString(),
  };
}

export async function getSecretariatSettings(): Promise<SecretariatSettings> {
  const sql = createDatabaseClient();
  if (!sql) return { ...fallbackSettings };
  try {
    await ensureSecretariatSettingsTable(sql);
    const [row] = await sql<SecretariatRow[]>`
      select
        name, acronym, logo_public_id, logo_format, secretary_name,
        email, phone, full_address, city_hall_name, cnpj, updated_at
      from secretariat_settings
      where id = 1
      limit 1
    `;
    return row ? mapSettings(row) : { ...fallbackSettings };
  } catch {
    return { ...fallbackSettings };
  } finally {
    await sql.end();
  }
}

export async function saveSecretariatSettings(
  input: SecretariatSettingsInput & {
    logoPublicId?: string;
    logoFormat?: string;
  },
) {
  const sql = createDatabaseClient();
  if (!sql) throw new Error("DATABASE_UNAVAILABLE");
  try {
    await ensureSecretariatSettingsTable(sql);
    const [previous] = await sql<
      Array<{ logo_public_id: string | null; logo_format: string | null }>
    >`
      select logo_public_id, logo_format
      from secretariat_settings
      where id = 1
      limit 1
    `;

    await sql.begin(async (transaction) => {
      await transaction`
        update secretariat_settings
        set
          name = ${input.name},
          acronym = ${input.acronym},
          logo_public_id = coalesce(${input.logoPublicId ?? null}, logo_public_id),
          logo_format = coalesce(${input.logoFormat ?? null}, logo_format),
          secretary_name = ${input.secretaryName},
          email = ${input.email},
          phone = ${input.phone},
          full_address = ${input.fullAddress},
          city_hall_name = ${input.cityHallName},
          cnpj = ${input.cnpj},
          updated_at = now()
        where id = 1
      `;

      const [secretary] = await transaction<{ id: string }[]>`
        select id
        from municipal_secretaries
        where active
        order by is_default desc, updated_at desc
        limit 1
      `;
      if (secretary) {
        await transaction`
          update municipal_secretaries
          set full_name = ${input.secretaryName}, updated_at = now()
          where id = ${secretary.id}::uuid
        `;
      } else {
        await transaction`
          insert into municipal_secretaries (
            full_name, office_title, appointment, is_default, active
          ) values (
            ${input.secretaryName},
            'Sec. Mun. de Obras e Infraestrutura',
            '',
            true,
            true
          )
        `;
      }
    });

    return {
      previousLogoPublicId: previous?.logo_public_id ?? null,
      previousLogoFormat: previous?.logo_format ?? null,
    };
  } finally {
    await sql.end();
  }
}
