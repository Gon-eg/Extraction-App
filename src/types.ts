export type FacilityName =
  | "Keew"
  | "Lerpiny"
  | "Kuerkhan"
  | "Thokchak"
  | "Dhoreak"
  | "Dhornor"
  | "Manajang"
  | "Tangnyang";

export type ReportType = "OPD" | "ANC" | "EPI" | "Lab" | "MUAC" | "Nutrition";

export type BreakdownKey = "men" | "women" | "boys" | "girls" | "total";

export interface IndicatorTarget {
  total: number;
  men?: number;
  women?: number;
  boys?: number;
  girls?: number;
}

export interface IndicatorValue {
  men: number;
  women: number;
  boys: number;
  girls: number;
  total: number;
}

export interface Indicator {
  code: string;
  output: string;
  desc: string;
  target: IndicatorTarget;
  bd: BreakdownKey[];
  source: "auto" | "check" | "manual";
  extract?: (data: Record<string, any>) => IndicatorValue;
}

export interface StagedFile {
  id: string;
  file: File;
  facility: FacilityName | "Lerpiny & Tangnyang" | null;
  type: ReportType | null;
  status: "ready" | "check" | "error";
  errorMsg?: string;
}

export interface OPDData {
  newAtt: IndicatorValue;
  reAtt: IndicatorValue;
  malaria: IndicatorValue;
  diarrhoea: IndicatorValue;
  cmr: { girls: number; women: number };
  training: { men: number; women: number };
  skba: number;
}

export interface ANCData {
  skilled: number;
}

export interface EPIData {
  penta3: { boys: number; girls: number; total: number };
  measles: { boys: number; girls: number; total: number };
}

export interface LabData {
  men: number;
  women: number;
}

export interface NutritionData {
  screening: { boys: number; girls: number; women: number };
  otp: { boys: number; girls: number; cured: number; totalExits: number; recoveryRate: number };
  tsfp: {
    boys: number;
    girls: number;
    women: number;
    plwAdmissions: number;
    cured: number;
    totalExits: number;
    recoveryRate: number;
  };
  sc: { cured: number; totalExits: number; recoveryRate: number };
  iycf: {
    pregnant: number;
    lactating1: number;
    fathers1: number;
    lactating2: number;
    fathers2: number;
    groupFemale: number;
    groupMale: number;
    households: number;
    men: number;
    women: number;
    pregnantLactating: number;
    fathers: number;
    groupMaleVal?: number;
    groupFemaleVal?: number;
    total: number;
  };
  healthEdu: { men: number; women: number; total: number };
  supplementation: number;
  emergencyStock: number;
}

export interface FacilityExtractedData {
  opd?: OPDData;
  anc?: ANCData;
  epi?: EPIData;
  lab?: LabData;
  nutrition?: NutritionData;
}
