import { Indicator, IndicatorValue } from "./types";

export function sumFac(
  data: Record<string, any>,
  fn: (facData: any) => Partial<IndicatorValue>
): IndicatorValue {
  const out: IndicatorValue = { men: 0, women: 0, boys: 0, girls: 0, total: 0 };
  Object.values(data).forEach((f) => {
    if (!f) return;
    const r = fn(f) || {};
    out.men += r.men || 0;
    out.women += r.women || 0;
    out.boys += r.boys || 0;
    out.girls += r.girls || 0;
    out.total += r.total || 0;
  });
  return out;
}

export const INDICATORS: Indicator[] = [
  {
    code: "1.1",
    output: "Output 1.1 — Access & Facility Support",
    desc: "Vulnerable individuals accessing essential health care (overall)",
    target: { total: 13859, men: 3772, women: 3465, boys: 1771, girls: 4851 },
    bd: ["men", "women", "boys", "girls"],
    source: "check",
    extract: (d) =>
      sumFac(d, (f) => ({
        boys: (f.opd?.newAtt?.boys || 0) + (f.opd?.reAtt?.boys || 0),
        girls: (f.opd?.newAtt?.girls || 0) + (f.opd?.reAtt?.girls || 0),
        men: (f.opd?.newAtt?.men || 0) + (f.opd?.reAtt?.men || 0),
        women: (f.opd?.newAtt?.women || 0) + (f.opd?.reAtt?.women || 0),
      })),
  },
  {
    code: "1.1.1",
    output: "Output 1.1 — Access & Facility Support",
    desc: "Functional health facilities supported",
    target: { total: 8 },
    bd: [],
    source: "manual",
  },
  {
    code: "1.1.2",
    output: "Output 1.1 — Access & Facility Support",
    desc: "Emergency health kits delivered",
    target: { total: 8 },
    bd: [],
    source: "manual",
  },
  {
    code: "1.1.3",
    output: "Output 1.1 — Access & Facility Support",
    desc: "Individuals receiving life-saving items from emergency stockpiles",
    target: { total: 13859, men: 3772, women: 3465, boys: 1771, girls: 4851 },
    bd: ["men", "women", "boys", "girls"],
    source: "manual",
  },

  {
    code: "1.2.1",
    output: "Output 1.2 — Health Service Delivery",
    desc: "Primary healthcare consultations provided",
    target: { total: 13166, men: 3300, women: 3540, boys: 1902, girls: 4424 },
    bd: ["men", "women", "boys", "girls"],
    source: "auto",
    extract: (d) =>
      sumFac(d, (f) => ({
        boys: (f.opd?.newAtt?.boys || 0) + (f.opd?.reAtt?.boys || 0),
        girls: (f.opd?.newAtt?.girls || 0) + (f.opd?.reAtt?.girls || 0),
        men: (f.opd?.newAtt?.men || 0) + (f.opd?.reAtt?.men || 0),
        women: (f.opd?.newAtt?.women || 0) + (f.opd?.reAtt?.women || 0),
      })),
  },
  {
    code: "1.2.2",
    output: "Output 1.2 — Health Service Delivery",
    desc: "People provided with MHPSS services",
    target: { total: 2078, men: 312, women: 726, girls: 420, boys: 620 },
    bd: ["men", "women", "boys", "girls"],
    source: "manual",
  },
  {
    code: "1.2.3",
    output: "Output 1.2 — Health Service Delivery",
    desc: "Number of skilled birth attended (ANC)",
    target: { total: 180, women: 0 },
    bd: ["women"],
    source: "auto",
    extract: (d) => sumFac(d, (f) => ({ women: f.anc?.skilled || 0 })),
  },
  {
    code: "1.2.3b",
    output: "Output 1.2 — Health Service Delivery",
    desc: "Facility skilled birth attended (OPD)",
    target: { total: 180, women: 180 },
    bd: ["men", "women", "boys", "girls"],
    source: "auto",
    extract: (d) =>
      sumFac(d, (f) => {
        const sk = f.opd?.skba;
        if (!sk) return { men: 0, women: 0, boys: 0, girls: 0, total: 0 };
        return {
          boys: sk.boys || 0,
          girls: sk.girls || 0,
          men: sk.men || 0,
          women: sk.women || 0,
          total: sk.total || 0,
        };
      }),
  },
  {
    code: "1.2.4",
    output: "Output 1.2 — Health Service Delivery",
    desc: "People benefitting from vector-borne (malaria) disease control",
    target: { total: 5087, men: 1047, women: 1347, boys: 1246, girls: 1447 },
    bd: ["men", "women", "boys", "girls"],
    source: "auto",
    extract: (d) =>
      sumFac(d, (f) => ({
        boys: f.opd?.malaria?.boys || 0,
        girls: f.opd?.malaria?.girls || 0,
        men: f.opd?.malaria?.men || 0,
        women: f.opd?.malaria?.women || 0,
      })),
  },
  {
    code: "1.2.5",
    output: "Output 1.2 — Health Service Delivery",
    desc: "People benefitting from waterborne disease control",
    target: { total: 500, men: 100, women: 135, boys: 115, girls: 150 },
    bd: ["men", "women", "boys", "girls"],
    source: "auto",
    extract: (d) =>
      sumFac(d, (f) => ({
        boys: f.opd?.diarrhoea?.boys || 0,
        girls: f.opd?.diarrhoea?.girls || 0,
        men: f.opd?.diarrhoea?.men || 0,
        women: f.opd?.diarrhoea?.women || 0,
      })),
  },
  {
    code: "1.2.6",
    output: "Output 1.2 — Health Service Delivery",
    desc: "Individuals screened for epidemic-prone diseases",
    target: { total: 2500, men: 500, women: 625, boys: 625, girls: 750 },
    bd: ["men", "women"],
    source: "check",
    extract: (d) => sumFac(d, (f) => ({ men: f.lab?.men || 0, women: f.lab?.women || 0 })),
  },
  {
    code: "1.2.7",
    output: "Output 1.2 — Health Service Delivery",
    desc: "Violence survivors receiving medical assistance (incl. CMR)",
    target: { total: 150, women: 80, girls: 70 },
    bd: ["women", "girls"],
    source: "auto",
    extract: (d) => sumFac(d, (f) => ({ girls: f.opd?.cmr?.girls || 0, women: f.opd?.cmr?.women || 0 })),
  },
  {
    code: "1.2.8",
    output: "Output 1.2 — Health Service Delivery",
    desc: "People vaccinated — DTP3 (Pentavalent dose 3)",
    target: { total: 499, boys: 145, girls: 154 },
    bd: ["boys", "girls"],
    source: "auto",
    extract: (d) =>
      sumFac(d, (f) => ({
        boys: f.epi?.penta3?.boys || 0,
        girls: f.epi?.penta3?.girls || 0,
        total: f.epi?.penta3?.total || 0,
      })),
  },
  {
    code: "1.2.9",
    output: "Output 1.2 — Health Service Delivery",
    desc: "People vaccinated — Measles containing vaccine",
    target: { total: 1500, boys: 706, girls: 794 },
    bd: ["boys", "girls"],
    source: "auto",
    extract: (d) =>
      sumFac(d, (f) => ({
        boys: f.epi?.measles?.boys || 0,
        girls: f.epi?.measles?.girls || 0,
        total: f.epi?.measles?.total || 0,
      })),
  },

  {
    code: "1.3.1",
    output: "Output 1.3 — Workforce & Community Systems",
    desc: "Frontline health workers trained on outbreak detection & response",
    target: { total: 49, men: 19, women: 30 },
    bd: ["men", "women"],
    source: "check",
    extract: (d) => sumFac(d, (f) => ({ men: f.opd?.training?.men || 0, women: f.opd?.training?.women || 0 })),
  },
  {
    code: "1.3.2",
    output: "Output 1.3 — Workforce & Community Systems",
    desc: "Community-based complaints/feedback mechanisms established",
    target: { total: 97, men: 59, women: 38 },
    bd: ["men", "women"],
    source: "manual",
  },
  {
    code: "1.3.3",
    output: "Output 1.3 — Workforce & Community Systems",
    desc: "Frontline/community workers trained on emergency surveillance/reporting",
    target: { total: 97, men: 59, women: 38 },
    bd: ["men", "women"],
    source: "manual",
  },

  /* ---- NUTRITION INDICATORS ---- */
  {
    code: "2.1",
    output: "Output 2.1 — Nutrition Screening & Treatment",
    desc: "SAM recovery rate (with medical complication) — SC",
    target: { total: 80 },
    bd: ["total"],
    source: "auto",
    extract: (d) => sumFac(d, (f) => ({ total: f.nutrition?.sc?.recoveryRate || 0 })),
  },
  {
    code: "2.1.1",
    output: "Output 2.1 — Nutrition Screening & Treatment",
    desc: "People screened for acute malnutrition",
    target: { total: 2260 },
    bd: ["boys", "girls", "women"],
    source: "auto",
    extract: (d) =>
      sumFac(d, (f) => ({
        boys: f.nutrition?.screening?.boys || 0,
        girls: f.nutrition?.screening?.girls || 0,
        women: f.nutrition?.screening?.women || 0,
      })),
  },
  {
    code: "2.1.2",
    output: "Output 2.1 — Nutrition Screening & Treatment",
    desc: "People admitted to SAM treatment programme (OTP)",
    target: { total: 80 },
    bd: ["boys", "girls"],
    source: "auto",
    extract: (d) => sumFac(d, (f) => ({ boys: f.nutrition?.otp?.boys || 0, girls: f.nutrition?.otp?.girls || 0 })),
  },
  {
    code: "2.1.3",
    output: "Output 2.1 — Nutrition Screening & Treatment",
    desc: "People admitted to MAM treatment programme (TSFP)",
    target: { total: 170 },
    bd: ["boys", "girls", "women"],
    source: "auto",
    extract: (d) =>
      sumFac(d, (f) => ({
        boys: f.nutrition?.tsfp?.boys || 0,
        girls: f.nutrition?.tsfp?.girls || 0,
        women: f.nutrition?.tsfp?.women || 0,
      })),
  },
  {
    code: "2.1.4",
    output: "Output 2.1 — Nutrition Screening & Treatment",
    desc: "People receiving supplementary feeding (MAM prevention)",
    target: { total: 130 },
    bd: ["women"],
    source: "auto",
    extract: (d) => sumFac(d, (f) => ({ women: f.nutrition?.tsfp?.plwAdmissions || 0 })),
  },
  {
    code: "2.1.5",
    output: "Output 2.1 — Nutrition Screening & Treatment",
    desc: "People benefitting IYCF training/awareness sessions",
    target: { total: 5707 },
    bd: ["men", "women", "total"],
    source: "auto",
    extract: (d) =>
      sumFac(d, (f) => ({
        men: f.nutrition?.iycf?.men || 0,
        women: f.nutrition?.iycf?.women || 0,
        total: f.nutrition?.iycf?.total || 0,
      })),
  },

  {
    code: "2.2",
    output: "Output 2.2 — IYCF & Supplementation",
    desc: "SAM recovery rate (without medical complication) — OTP",
    target: { total: 80 },
    bd: ["total"],
    source: "auto",
    extract: (d) => sumFac(d, (f) => ({ total: f.nutrition?.otp?.recoveryRate || 0 })),
  },
  {
    code: "2.2.1",
    output: "Output 2.2 — IYCF & Supplementation",
    desc: "IYCF participants (pregnant + lactating women)",
    target: { total: 1431 },
    bd: ["women"],
    source: "auto",
    extract: (d) => sumFac(d, (f) => ({ women: f.nutrition?.iycf?.pregnantLactating || 0 })),
  },
  {
    code: "2.2.2",
    output: "Output 2.2 — IYCF & Supplementation",
    desc: "IYCF participants (fathers/caregivers)",
    target: { total: 60 },
    bd: ["men"],
    source: "auto",
    extract: (d) => sumFac(d, (f) => ({ men: f.nutrition?.iycf?.fathers || 0 })),
  },
  {
    code: "2.2.3",
    output: "Output 2.2 — IYCF & Supplementation",
    desc: "IYCF participants (group sessions)",
    target: { total: 60 },
    bd: ["men", "women"],
    source: "auto",
    extract: (d) =>
      sumFac(d, (f) => ({
        men: f.nutrition?.iycf?.groupMale || 0,
        women: f.nutrition?.iycf?.groupFemale || 0,
      })),
  },
  {
    code: "2.2.4",
    output: "Output 2.2 — IYCF & Supplementation",
    desc: "Individuals receiving life-saving items from emergency stockpiles",
    target: { total: 380 },
    bd: ["total"],
    source: "auto",
    extract: (d) => sumFac(d, (f) => ({ total: f.nutrition?.emergencyStock || 0 })),
  },
  {
    code: "2.2.5",
    output: "Output 2.2 — IYCF & Supplementation",
    desc: "People receiving vitamins and/or micronutrient supplements",
    target: { total: 1018 },
    bd: ["total"],
    source: "auto",
    extract: (d) => sumFac(d, (f) => ({ total: f.nutrition?.supplementation || 0 })),
  },
  {
    code: "2.2.6",
    output: "Output 2.2 — IYCF & Supplementation",
    desc: "People reached with health/nutrition promotion",
    target: { total: 15000 },
    bd: ["men", "women", "total"],
    source: "auto",
    extract: (d) =>
      sumFac(d, (f) => ({
        men: f.nutrition?.healthEdu?.men || 0,
        women: f.nutrition?.healthEdu?.women || 0,
        total: f.nutrition?.healthEdu?.total || 0,
      })),
  },
  {
    code: "2.2.7",
    output: "Output 2.2 — IYCF & Supplementation",
    desc: "Children under 5 screened for malnutrition (MUAC) — cross-cutting",
    target: { total: 1890 },
    bd: ["boys", "girls", "women"],
    source: "auto",
    extract: (d) =>
      sumFac(d, (f) => ({
        boys: f.nutrition?.screening?.boys || 0,
        girls: f.nutrition?.screening?.girls || 0,
        women: f.nutrition?.screening?.women || 0,
      })),
  },
  {
    code: "2.2.8",
    output: "Output 2.2 — IYCF & Supplementation",
    desc: "Households reached with IYCF messages",
    target: { total: 500 },
    bd: ["total"],
    source: "auto",
    extract: (d) => sumFac(d, (f) => ({ total: f.nutrition?.iycf?.households || 0 })),
  },
  {
    code: "2.3",
    output: "Output 2.3 — MAM Treatment & Community Awareness",
    desc: "MAM recovery rate — TSFP",
    target: { total: 80 },
    bd: ["total"],
    source: "auto",
    extract: (d) => sumFac(d, (f) => ({ total: f.nutrition?.tsfp?.recoveryRate || 0 })),
  },
  {
    code: "2.3.1",
    output: "Output 2.3 — MAM Treatment & Community Awareness",
    desc: "IYCF training participants (group 4)",
    target: { total: 40 },
    bd: ["total"],
    source: "manual",
  },
  {
    code: "2.3.2",
    output: "Output 2.3 — MAM Treatment & Community Awareness",
    desc: "IYCF training participants (group 5)",
    target: { total: 40 },
    bd: ["total"],
    source: "manual",
  },
  {
    code: "2.3.3",
    output: "Output 2.3 — MAM Treatment & Community Awareness",
    desc: "IYCF training participants (group 6)",
    target: { total: 40 },
    bd: ["total"],
    source: "manual",
  },
];
