export type BoundarySide = "front" | "right" | "left" | "back";
export type SexCode = "female" | "male" | "not_informed";
export type StaffRole = "technical_responsible" | "works_inspector";

export type SexOption = {
  code: SexCode;
  label: string;
};

export type StaffMember = {
  id: string | null;
  fullName: string;
  role: StaffRole;
  sex: SexCode;
  registration: string;
};

export type Boundary = {
  side: BoundarySide;
  label: string;
  measurement: number | null;
  measurementInWords: string;
};

export type TopographicData = {
  claimantName: string;
  claimantSex: SexCode;
  cpf: string;
  nationality: string;
  residence: string;
  propertyAddress: string;
  neighborhood: string;
  city: string;
  state: string;
  block: string;
  lot: string;
  landArea: number | null;
  landAreaInWords: string;
  builtArea: number | null;
  builtAreaInWords: string;
  propertyUse: string;
  delimitation: string;
  improvements: string[];
  documentDate: string;
  boundaries: Boundary[];
  confidence: number;
  reviewNotes: string[];
  technicalResponsible: StaffMember;
  worksInspector: StaffMember;
};

export const defaultSexOptions: SexOption[] = [
  { code: "female", label: "Feminino" },
  { code: "male", label: "Masculino" },
  { code: "not_informed", label: "Não informado" },
];

export const defaultTechnicalResponsible: StaffMember = {
  id: null,
  fullName: "Gabriel de Araújo Ramos",
  role: "technical_responsible",
  sex: "male",
  registration: "CREA/CFT: 1909916552/23134151391",
};

export const defaultWorksInspector: StaffMember = {
  id: null,
  fullName: "Elesbão Pinto Magalhães Filho",
  role: "works_inspector",
  sex: "male",
  registration: "Mat. 110351",
};

export const boundaryLabels: Record<BoundarySide, string> = {
  front: "Frente",
  right: "Flanco direito",
  left: "Flanco esquerdo",
  back: "Fundo",
};

export const initialTopographicData: TopographicData = {
  claimantName: "",
  claimantSex: "not_informed",
  cpf: "",
  nationality: "brasileira",
  residence: "",
  propertyAddress: "",
  neighborhood: "",
  city: "Coelho Neto",
  state: "MA",
  block: "",
  lot: "",
  landArea: null,
  landAreaInWords: "",
  builtArea: null,
  builtAreaInWords: "",
  propertyUse: "Residencial",
  delimitation: "Muro de alvenaria",
  improvements: [
    "Pavimentação asfáltica",
    "Iluminação pública",
    "Rede de abastecimento de água",
  ],
  documentDate: new Date().toISOString().slice(0, 10),
  boundaries: [
    { side: "front", label: "", measurement: null, measurementInWords: "" },
    { side: "right", label: "", measurement: null, measurementInWords: "" },
    { side: "left", label: "", measurement: null, measurementInWords: "" },
    {
      side: "back",
      label: "TERRENOS DE TERCEIROS",
      measurement: null,
      measurementInWords: "",
    },
  ],
  confidence: 0,
  reviewNotes: [],
  technicalResponsible: defaultTechnicalResponsible,
  worksInspector: defaultWorksInspector,
};

export const sampleTopographicData: TopographicData = {
  claimantName: "MARIZA SILVA DOS SANTOS",
  claimantSex: "female",
  cpf: "070.609.013-61",
  nationality: "brasileira",
  residence: "Rua Deusadete Barros, Centro, Coelho Neto - MA",
  propertyAddress: "Rua Deusadete Barros",
  neighborhood: "Centro",
  city: "Coelho Neto",
  state: "MA",
  block: "61",
  lot: "",
  landArea: 137.2,
  landAreaInWords: "cento e trinta e sete vírgula dois metros quadrados",
  builtArea: 0,
  builtAreaInWords: "",
  propertyUse: "Residencial",
  delimitation: "Muro de alvenaria",
  improvements: [
    "Pavimentação asfáltica",
    "Iluminação pública",
    "Rede de abastecimento de água",
  ],
  documentDate: "2026-07-23",
  boundaries: [
    {
      side: "front",
      label: "RUA DEUSADETE BARROS",
      measurement: 6.45,
      measurementInWords: "seis metros e quarenta e cinco centímetros",
    },
    {
      side: "right",
      label: "ANTONIO JOSÉ ALVES",
      measurement: 22.4,
      measurementInWords: "vinte e dois metros e quarenta centímetros",
    },
    {
      side: "left",
      label: "MARIA DAS GRAÇAS DA SILVA",
      measurement: 22.41,
      measurementInWords: "vinte e dois metros e quarenta e um centímetros",
    },
    {
      side: "back",
      label: "TERRENOS DE TERCEIROS",
      measurement: 5.8,
      measurementInWords: "cinco metros e oitenta centímetros",
    },
  ],
  confidence: 0.94,
  reviewNotes: [
    "O limite de fundo não continha nome de vizinho ou rua e foi padronizado como TERRENOS DE TERCEIROS.",
    "Área construída indicada como zero; o documento exibirá Sem edificação.",
  ],
  technicalResponsible: defaultTechnicalResponsible,
  worksInspector: defaultWorksInspector,
};

function normalizeSex(value: unknown): SexCode {
  return value === "female" || value === "male" ? value : "not_informed";
}

function normalizeStaffMember(
  value: Partial<StaffMember> | undefined,
  fallback: StaffMember,
): StaffMember {
  return {
    id: typeof value?.id === "string" ? value.id : fallback.id,
    fullName: value?.fullName?.trim() || fallback.fullName,
    role: fallback.role,
    sex: normalizeSex(value?.sex ?? fallback.sex),
    registration: value?.registration?.trim() || fallback.registration,
  };
}

export function normalizeTopographicData(
  data: Partial<TopographicData>,
): TopographicData {
  const merged: TopographicData = {
    ...initialTopographicData,
    ...data,
    claimantSex: normalizeSex(data.claimantSex),
    boundaries: initialTopographicData.boundaries.map((fallback) => {
      const found = data.boundaries?.find(
        (boundary) => boundary.side === fallback.side,
      );
      return {
        side: fallback.side,
        label:
          found?.label?.trim() ||
          (fallback.side === "back" ? "TERRENOS DE TERCEIROS" : ""),
        measurement:
          typeof found?.measurement === "number" ? found.measurement : null,
        measurementInWords: found?.measurementInWords?.trim() || "",
      };
    }),
    improvements:
      data.improvements?.filter(Boolean) ??
      initialTopographicData.improvements,
    reviewNotes: data.reviewNotes?.filter(Boolean) ?? [],
    technicalResponsible: normalizeStaffMember(
      data.technicalResponsible,
      defaultTechnicalResponsible,
    ),
    worksInspector: normalizeStaffMember(
      data.worksInspector,
      defaultWorksInspector,
    ),
  };

  if (!merged.residence.trim()) {
    merged.residence = [
      merged.propertyAddress,
      merged.neighborhood,
      merged.city,
      merged.state,
    ]
      .filter(Boolean)
      .join(", ");
  }

  merged.nationality ||= "brasileira";
  merged.delimitation ||= "Muro de alvenaria";
  return merged;
}

export function isTopographicData(value: unknown): value is TopographicData {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<TopographicData>;
  return (
    typeof data.claimantName === "string" &&
    typeof data.propertyAddress === "string" &&
    Array.isArray(data.boundaries)
  );
}
