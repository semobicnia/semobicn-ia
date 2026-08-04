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

export type MunicipalSecretary = {
  id: string | null;
  fullName: string;
  title: string;
  appointment: string;
};

export type Boundary = {
  side: BoundarySide;
  label: string;
  measurement: number | null;
  measurementInWords: string;
};

export type PlotShapeType =
  | "square"
  | "rectangle"
  | "trapezoid"
  | "irregular"
  | "unknown";
export type SourceLayout = "free_sketch" | "structured_form";

export type PlotVertex = {
  x: number;
  y: number;
  coordinateX: string;
  coordinateY: string;
};

export type PlotDrawingPoint = {
  x: number;
  y: number;
};

export type PlotBuilding = {
  vertices: PlotDrawingPoint[];
};

export type PlotEdge = {
  fromVertex: number;
  toVertex: number;
  label: string;
  measurement: number | null;
  isStreet: boolean;
  streetName: string;
  curved: boolean;
  curveBulge: number;
};

export type PlotGeometry = {
  shapeType: PlotShapeType;
  vertices: PlotVertex[];
  edges: PlotEdge[];
  buildings: PlotBuilding[];
  northAngle: number | null;
  confidence: number;
  reviewNotes: string[];
};

export type TopographicData = {
  sourceLayout: SourceLayout;
  requestNumber: string;
  bci: string;
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
  plotGeometry: PlotGeometry;
  confidence: number;
  reviewNotes: string[];
  technicalResponsible: StaffMember;
  worksInspector: StaffMember;
};

function currentDocumentDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

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

export const defaultMunicipalSecretary: MunicipalSecretary = {
  id: null,
  fullName: "Antonio Lustosa de Melo",
  title: "Sec. Mul de Obras e Infraestrutura",
  appointment: "Portaria: 029/2026-CC",
};

export const boundaryLabels: Record<BoundarySide, string> = {
  front: "Frente",
  right: "Flanco direito",
  left: "Flanco esquerdo",
  back: "Fundo",
};

export const initialTopographicData: TopographicData = {
  sourceLayout: "free_sketch",
  requestNumber: "",
  bci: "",
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
  documentDate: currentDocumentDate(),
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
  plotGeometry: {
    shapeType: "unknown",
    vertices: [],
    edges: [],
    buildings: [],
    northAngle: null,
    confidence: 0,
    reviewNotes: [],
  },
  confidence: 0,
  reviewNotes: [],
  technicalResponsible: defaultTechnicalResponsible,
  worksInspector: defaultWorksInspector,
};

export const sampleTopographicData: TopographicData = {
  sourceLayout: "free_sketch",
  requestNumber: "",
  bci: "",
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
  plotGeometry: {
    shapeType: "trapezoid",
    vertices: [
      { x: 190, y: 180, coordinateX: "", coordinateY: "" },
      { x: 340, y: 170, coordinateX: "", coordinateY: "" },
      { x: 390, y: 790, coordinateX: "", coordinateY: "" },
      { x: 230, y: 800, coordinateX: "", coordinateY: "" },
    ],
    edges: [
      {
        fromVertex: 0,
        toVertex: 1,
        label: "RUA DEUSADETE BARROS",
        measurement: 6.45,
        isStreet: true,
        streetName: "RUA DEUSADETE BARROS",
        curved: false,
        curveBulge: 0,
      },
      {
        fromVertex: 1,
        toVertex: 2,
        label: "ANTONIO JOSÉ ALVES",
        measurement: 22.4,
        isStreet: false,
        streetName: "",
        curved: false,
        curveBulge: 0,
      },
      {
        fromVertex: 2,
        toVertex: 3,
        label: "TERRENOS DE TERCEIROS",
        measurement: 5.8,
        isStreet: false,
        streetName: "",
        curved: false,
        curveBulge: 0,
      },
      {
        fromVertex: 3,
        toVertex: 0,
        label: "MARIA DAS GRAÇAS DA SILVA",
        measurement: 22.41,
        isStreet: false,
        streetName: "",
        curved: false,
        curveBulge: 0,
      },
    ],
    buildings: [],
    northAngle: null,
    confidence: 0.9,
    reviewNotes: [],
  },
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

function normalizePlotGeometry(value: Partial<PlotGeometry> | undefined) {
  const vertices = Array.isArray(value?.vertices)
    ? value.vertices.slice(0, 12).flatMap((vertex) => {
        if (
          !vertex ||
          !Number.isFinite(vertex.x) ||
          !Number.isFinite(vertex.y)
        ) {
          return [];
        }
        return [{
          x: Math.max(0, Math.min(1000, vertex.x)),
          y: Math.max(0, Math.min(1000, vertex.y)),
          coordinateX: vertex.coordinateX?.trim() || "",
          coordinateY: vertex.coordinateY?.trim() || "",
        }];
      })
    : [];
  const validShapeTypes = new Set<PlotShapeType>([
    "square",
    "rectangle",
    "trapezoid",
    "irregular",
    "unknown",
  ]);
  const edges = Array.isArray(value?.edges)
    ? value.edges.slice(0, 12).flatMap((edge) => {
        if (
          !edge ||
          !Number.isInteger(edge.fromVertex) ||
          !Number.isInteger(edge.toVertex) ||
          edge.fromVertex < 0 ||
          edge.toVertex < 0 ||
          edge.fromVertex >= vertices.length ||
          edge.toVertex >= vertices.length ||
          edge.fromVertex === edge.toVertex
        ) {
          return [];
        }
        return [{
          fromVertex: edge.fromVertex,
          toVertex: edge.toVertex,
          label: edge.label?.trim() || "",
          measurement:
            typeof edge.measurement === "number" &&
            Number.isFinite(edge.measurement)
              ? edge.measurement
              : null,
          isStreet: Boolean(edge.isStreet),
          streetName: edge.streetName?.trim() || "",
          curved: Boolean(edge.curved),
          curveBulge:
            typeof edge.curveBulge === "number" &&
            Number.isFinite(edge.curveBulge)
              ? Math.max(-1, Math.min(1, edge.curveBulge))
              : 0,
        }];
      })
    : [];
  const buildings = Array.isArray(value?.buildings)
    ? value.buildings.slice(0, 5).flatMap((building) => {
        if (!building || !Array.isArray(building.vertices)) return [];
        const buildingVertices = building.vertices.slice(0, 12).flatMap((point) => {
          if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
            return [];
          }
          return [{
            x: Math.max(0, Math.min(1000, point.x)),
            y: Math.max(0, Math.min(1000, point.y)),
          }];
        });
        return buildingVertices.length >= 3
          ? [{ vertices: buildingVertices }]
          : [];
      })
    : [];

  return {
    shapeType:
      value?.shapeType && validShapeTypes.has(value.shapeType)
        ? value.shapeType
        : "unknown",
    vertices,
    edges,
    buildings,
    northAngle:
      typeof value?.northAngle === "number" &&
      Number.isFinite(value.northAngle)
        ? Math.max(-180, Math.min(180, value.northAngle))
        : null,
    confidence:
      typeof value?.confidence === "number" &&
      Number.isFinite(value.confidence)
        ? Math.max(0, Math.min(1, value.confidence))
        : 0,
    reviewNotes: value?.reviewNotes?.filter(Boolean).slice(0, 20) ?? [],
  } satisfies PlotGeometry;
}

export function normalizeTopographicData(
  data: Partial<TopographicData>,
): TopographicData {
  const merged: TopographicData = {
    ...initialTopographicData,
    ...data,
    sourceLayout:
      data.sourceLayout === "structured_form"
        ? "structured_form"
        : "free_sketch",
    requestNumber: data.requestNumber?.trim() || "",
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
    plotGeometry: normalizePlotGeometry(data.plotGeometry),
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
  if (merged.sourceLayout === "free_sketch") {
    merged.delimitation ||= "Muro de alvenaria";
  }
  merged.bci = merged.bci?.trim() || "";
  merged.documentDate =
    merged.documentDate?.trim() || currentDocumentDate();
  if (merged.builtArea === 0 && !merged.propertyUse.trim()) {
    merged.propertyUse = "Sem edificação";
  }
  return merged;
}

export function getActiveReviewNotes(data: TopographicData) {
  return data.reviewNotes.filter((note) => {
    const normalized = note
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    if (
      data.documentDate &&
      (normalized.includes("nao contem data") ||
        normalized.includes("data nao foi informada") ||
        normalized.includes("sem data"))
    ) {
      return false;
    }
    if (
      data.propertyUse.trim() &&
      (normalized.includes("uso do imovel nao foi informado") ||
        normalized.includes("uso do imovel ausente"))
    ) {
      return false;
    }
    if (
      data.bci &&
      normalized.includes("bci") &&
      (normalized.includes("nao possui campo") ||
        normalized.includes("sem campo correspondente"))
    ) {
      return false;
    }
    return true;
  });
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
