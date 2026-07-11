import * as XLSX from "xlsx";
import mammoth from "mammoth";
import { FacilityName, ReportType, OPDData, ANCData, EPIData, LabData, NutritionData, IndicatorValue } from "./types";

export const FACILITIES: Record<FacilityName, string[]> = {
  "Keew": ["keew", "kew"],
  "Lerpiny": ["lerpiny", "lerpiiny", "leerpiny"],
  "Kuerkhan": ["kuerkhan", "kuerkan", "kuerk"],
  "Thokchak": ["thokchak", "thokchack"],
  "Dhoreak": ["dhoreak", "dhoriak"],
  "Dhornor": ["dhornor", "dhorndor", "dhornur", "dhornol", "dhonor", "dhoronor", "dhor"],
  "Manajang": ["manajang", "manyjang"],
  "Tangnyang": ["tangnyang", "tangnang", "tang-nyang"]
};

export const REPORT_TYPES: Record<ReportType, string[]> = {
  "ANC": ["anc"],
  "EPI": ["epi", "routine", "routine epi", "vaccin"],
  "Lab": ["lab", "laboratory", "analysis", "tests", "test"],
  "MUAC": ["muac"],
  "OPD": ["opd"],
  "Nutrition": ["nutrition", "nis", "cluster report"],
  "Health Education": ["health education", "health edu", "promotion"],
  "Health Data": ["health data", "health"]
};

export function num(v: any): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  const cleaned = String(v).replace(/,/g, "").trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

export function detect(name: string, dict: Record<string, string[]>): any {
  const lower = name.toLowerCase();
  for (const key in dict) {
    if (dict[key].some(a => lower.includes(a.toLowerCase()))) {
      return key;
    }
  }
  return null;
}

export function sheetToAOA(ws: any): any[][] {
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][];
}

export function findRow(aoa: any[][], needle: string) {
  const n = needle.toLowerCase();
  for (let r = 0; r < aoa.length; r++) {
    if (!aoa[r]) continue;
    for (let c = 0; c < aoa[r].length; c++) {
      const v = aoa[r][c];
      if (v === null || v === undefined) continue;
      const s = String(v).toLowerCase();
      if (s.includes(n)) return { r, c, row: aoa[r] };
    }
  }
  return null;
}

export async function parseXLSX(arrayBuffer: ArrayBuffer, sheetNameMatcher?: RegExp): Promise<any[][]> {
  const wb = XLSX.read(arrayBuffer, { type: "array" });
  let sheetName = wb.SheetNames[0];
  if (sheetNameMatcher) {
    const found = wb.SheetNames.find(n => sheetNameMatcher.test(n));
    if (found) sheetName = found;
  }
  return sheetToAOA(wb.Sheets[sheetName]);
}

export async function parseDocxTables(arrayBuffer: ArrayBuffer): Promise<string[][][]> {
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const html = result.value;
  if (typeof window === "undefined") return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  const tables = Array.from(doc.querySelectorAll("table"));
  return tables.map(t =>
    Array.from(t.querySelectorAll("tr")).map(tr =>
      Array.from(tr.querySelectorAll("td, th")).map(td => (td.textContent || "").trim())
    )
  );
}

export function opdRowVals(aoa: any[][], label: string) {
  const hit = findRow(aoa, label);
  if (!hit) return { boys: 0, girls: 0, men: 0, women: 0, total: 0 };
  const row = hit.row;
  return {
    boys: num(row[1]),
    girls: num(row[2]),
    men: num(row[5]),
    women: num(row[6]),
    total: num(row[1]) + num(row[2]) + num(row[5]) + num(row[6])
  };
}

export function extractOPDSKBA(aoa: any[][]): IndicatorValue {
  let hit = findRow(aoa, "deliveries by skilled attendant");
  if (!hit) hit = findRow(aoa, "skilled attendant");
  if (!hit) hit = findRow(aoa, "skilled birth");
  if (!hit) hit = findRow(aoa, "skba");
  if (!hit) hit = findRow(aoa, "facility skilled birth attended");
  
  let row: any[] | null = hit ? hit.row : null;
  if (!row) {
    // Fallback: If no label is found, check row 51 (0-indexed index 50)
    if (aoa && aoa[50] && aoa[50].length > 1) {
      row = aoa[50];
    } else if (aoa && aoa[51] && aoa[51].length > 1) {
      row = aoa[51];
    }
  }
  
  if (!row) {
    return { boys: 0, girls: 0, men: 0, women: 0, total: 0 };
  }
  
  // According to the rest of the extraction logic (like opdRowVals):
  // Column 1: Boys, Column 2: Girls, Column 5: Men, Column 6: Women
  const boys = num(row[1]);
  const girls = num(row[2]);
  const men = num(row[5]);
  const women = num(row[6]);
  
  return {
    boys,
    girls,
    men,
    women,
    total: boys + girls + men + women
  };
}

export async function extractOPD(buf: ArrayBuffer): Promise<OPDData> {
  const aoa = await parseXLSX(buf, /(new hfs|health data|health|opd)/i);
  const newAtt = opdRowVals(aoa, "MoH F1A New attendance");
  const reAtt = opdRowVals(aoa, "MoH F1A Re-attendance");
  const malaria = opdRowVals(aoa, "Total malaria cases treated");
  const diarrhoea = opdRowVals(aoa, "Diarrhoea (Acute");
  
  const cmrHit = findRow(aoa, "Clinically managed rape cases");
  const cmr = cmrHit ? { girls: num(cmrHit.row[6]), women: num(cmrHit.row[7]) } : { girls: 0, women: 0 };
  
  const trainHit = findRow(aoa, "Emergency Preparedness and Response");
  const training = trainHit ? { men: num(trainHit.row[7]), women: num(trainHit.row[8]) } : { men: 0, women: 0 };
  
  let skba = extractOPDSKBA(aoa);

  if (skba.total === 0) {
    try {
      const wb = XLSX.read(buf, { type: "array" });
      for (const sheetName of wb.SheetNames) {
        const sheetAoa = sheetToAOA(wb.Sheets[sheetName]);
        const val = extractOPDSKBA(sheetAoa);
        if (val.total > 0) {
          skba = val;
          break;
        }
      }
    } catch (e) {
      console.warn("Error scanning all sheets for skba in extractOPD", e);
    }
  }
  
  return { newAtt, reAtt, malaria, diarrhoea, cmr, training, skba };
}

export async function extractANC(buf: ArrayBuffer): Promise<ANCData> {
  const aoa = await parseXLSX(buf);
  let hit = findRow(aoa, "deliveries by skilled attendant");
  if (!hit) hit = findRow(aoa, "skilled attendant");
  if (!hit) hit = findRow(aoa, "skilled birth");
  const skilled = hit ? num(hit.row[hit.c + 1]) : 0;
  return { skilled };
}

export function getEpiRowRange(aoa: any[][]) {
  let start0_11 = 0;
  let start1_2 = aoa.length;
  for (let r = 0; r < aoa.length; r++) {
    if (!aoa[r]) continue;
    const rowStr = aoa[r].map(c => String(c || "").toLowerCase()).join(" ");
    
    // Concentrate only on "0-11 months"
    if (
      rowStr.includes("0-11") ||
      rowStr.includes("0 - 11") ||
      rowStr.includes("< 1 year") ||
      rowStr.includes("under 1") ||
      rowStr.includes("<1 year")
    ) {
      start0_11 = r;
    }
    
    // Exclude the "1-2 years" section entirely for all facilities
    if (
      rowStr.includes("1-2 years") ||
      rowStr.includes("1-2 year") ||
      rowStr.includes("12-23") ||
      rowStr.includes("1 - 2") ||
      rowStr.includes("1 to 2") ||
      rowStr.includes("2nd year")
    ) {
      start1_2 = r;
      break;
    }
  }
  return { start: start0_11, end: start1_2 };
}

export function epiFindRow(aoa: any[][], label: string, start: number, end: number): { r: number; c: number } | null {
  const n = label.toLowerCase().trim();
  for (let r = start; r < Math.min(end, aoa.length); r++) {
    if (!aoa[r]) continue;
    for (let c = 0; c < aoa[r].length; c++) {
      const cellVal = String(aoa[r][c] || "").toLowerCase().trim();
      if (!cellVal) continue;
      
      let isMatch = false;
      if (cellVal === n || cellVal.includes(n)) {
        isMatch = true;
      } else if (n.includes("pentavalent-3") || n.includes("penta")) {
        const isPenta = cellVal.includes("penta") || cellVal.includes("pentavalent") || cellVal.includes("dpt") || cellVal.includes("hepb") || cellVal.includes("hib");
        const isDose3 = cellVal.includes("3") || cellVal.includes("iii") || cellVal.includes("three") || cellVal.includes("dose3") || cellVal.includes("dose 3") || cellVal.endsWith("3");
        if (isPenta && isDose3) {
          isMatch = true;
        }
      } else if (n.includes("measles") || n.includes("mcv")) {
        const isMeasles = cellVal.includes("measle") || cellVal.includes("measles") || cellVal.includes("mcv") || cellVal.includes("mr 1") || cellVal.includes("mr-1") || cellVal.includes("mr1") || cellVal.startsWith("mr ") || cellVal === "mr";
        const isNotDose2 = !cellVal.includes("2") && !cellVal.includes("dose 2") && !cellVal.includes("dose2") && !cellVal.includes("ii");
        if (isMeasles && isNotDose2) {
          isMatch = true;
        }
      }
      
      if (isMatch) {
        return { r, c };
      }
    }
  }
  return null;
}

export function epiHasGenderRow(aoa: any[][], start: number, end: number): boolean {
  for (let r = start; r < Math.min(start + 25, end, aoa.length); r++) {
    if (!aoa[r]) continue;
    const rowStr = aoa[r].map(c => String(c || "").toLowerCase()).join(" ");
    if (rowStr.includes("gender") || rowStr.includes("male") || rowStr.includes("female")) return true;
  }
  return false;
}

export function epiRowVals(aoa: any[][], label: string, start: number, end: number) {
  let hit = epiFindRow(aoa, label, start, end);
  if (!hit) {
    // Fallback to searching the entire sheet
    hit = epiFindRow(aoa, label, 0, aoa.length);
  }
  if (!hit) return { boys: 0, girls: 0, total: 0 };
  
  const { r, c } = hit;
  const row = aoa[r];
  
  // Dynamically find where the actual numbers start.
  let startCol = c + 1;
  while (startCol < row.length && (row[startCol] === "" || row[startCol] === null || row[startCol] === undefined || isNaN(parseFloat(String(row[startCol]).replace(/,/g, ""))))) {
    startCol++;
  }
  
  // Find a header row to check if the column we found is a target/tgt column.
  let headerRow: any[] | null = null;
  for (let prevR = Math.max(0, r - 10); prevR < r; prevR++) {
    if (!aoa[prevR]) continue;
    const rStr = aoa[prevR].map(cell => String(cell || "").toLowerCase()).join(" ");
    if (rStr.includes("target") || rStr.includes("static") || rStr.includes("outreach") || rStr.includes("male") || rStr.includes("female") || rStr.includes("boys") || rStr.includes("girls")) {
      headerRow = aoa[prevR];
      break;
    }
  }

  if (headerRow && startCol < headerRow.length) {
    const colHeader = String(headerRow[startCol] || "").toLowerCase().trim();
    if (colHeader.includes("target") || colHeader.includes("tgt")) {
      // It's the target column! Skip it.
      startCol++;
      while (startCol < row.length && (row[startCol] === "" || row[startCol] === null || row[startCol] === undefined || isNaN(parseFloat(String(row[startCol]).replace(/,/g, ""))))) {
        startCol++;
      }
    }
  }

  if (startCol >= row.length) {
    startCol = c + 1;
  }

  const hasGender = epiHasGenderRow(aoa, start, end) || epiHasGenderRow(aoa, 0, aoa.length);
  
  let boys = 0;
  let girls = 0;
  let total = 0;
  
  if (hasGender) {
    // LAYOUT B: Col startCol=Static Male, startCol+1=Static Female, startCol+2=Out Reach Male, startCol+3=Out Reach Female, startCol+4=Total
    const staticMale = startCol < row.length ? num(row[startCol]) : 0;
    const staticFemale = startCol + 1 < row.length ? num(row[startCol + 1]) : 0;
    const outreachMale = startCol + 2 < row.length ? num(row[startCol + 2]) : 0;
    const outreachFemale = startCol + 3 < row.length ? num(row[startCol + 3]) : 0;
    total = startCol + 4 < row.length ? num(row[startCol + 4]) : 0;
    boys = staticMale + outreachMale;
    girls = staticFemale + outreachFemale;
  } else {
    // LAYOUT A: Col startCol=Static, startCol+1=Out Reach, startCol+2=Total
    boys = startCol < row.length ? num(row[startCol]) : 0;       // Static
    girls = startCol + 1 < row.length ? num(row[startCol + 1]) : 0;      // Out Reach
    total = startCol + 2 < row.length ? num(row[startCol + 2]) : 0;      // Total from sheet
  }
  
  // Absolute column fallback just in case startCol relative scan fails
  if (boys === 0 && girls === 0 && total === 0) {
    if (hasGender) {
      const staticMale = num(row[1]);
      const staticFemale = num(row[2]);
      const outreachMale = num(row[3]);
      const outreachFemale = num(row[4]);
      total = num(row[5]);
      boys = staticMale + outreachMale;
      girls = staticFemale + outreachFemale;
    } else {
      boys = num(row[1]);
      girls = num(row[2]);
      total = num(row[3]);
    }
  }
  
  if (total === 0) total = boys + girls;
  if (girls === 0 && total > 0 && total > boys) girls = total - boys;
  if (boys === 0 && total > 0 && total > girls) boys = total - girls;
  
  return { boys, girls, total };
}

export async function extractEPI(buf: ArrayBuffer, facility?: string): Promise<EPIData> {
  let aoa = await parseXLSX(buf, /(routine\s*epi|epi\s*reporting|epi|health\s*data|health|immunization|routine\s*immunization)/i);
  let range = getEpiRowRange(aoa);
  
  let penta3 = epiRowVals(aoa, "Pentavalent-3", range.start, range.end);
  let measles = epiRowVals(aoa, "Measles", range.start, range.end);

  if (penta3.total === 0 && measles.total === 0) {
    try {
      const wb = XLSX.read(buf, { type: "array" });
      for (const sheetName of wb.SheetNames) {
        const sheetAoa = sheetToAOA(wb.Sheets[sheetName]);
        const r = getEpiRowRange(sheetAoa);
        const p3 = epiRowVals(sheetAoa, "Pentavalent-3", r.start, r.end);
        const m = epiRowVals(sheetAoa, "Measles", r.start, r.end);
        if (p3.total > 0 || m.total > 0) {
          penta3 = p3;
          measles = m;
          break;
        }
      }
    } catch (e) {
      console.warn("Error scanning all sheets in extractEPI", e);
    }
  }
  
  // Specific instruction: handle gender breakdown for Keew EPI where it's not present but has same form
  if (facility && facility.toLowerCase() === "keew") {
    const pTotal = penta3.total;
    penta3.boys = Math.floor(pTotal / 2);
    penta3.girls = pTotal - penta3.boys;
    
    const mTotal = measles.total;
    measles.boys = Math.floor(mTotal / 2);
    measles.girls = mTotal - measles.boys;
  }
  
  return { penta3, measles };
}

export async function extractLab(buf: ArrayBuffer): Promise<LabData> {
  const tables = await parseDocxTables(buf);
  const wanted = ["Malaria Test", "Typhoid Tests", "Brucellosis Tests", "Kala_azar Tests", "Kala-azar Tests", "HAT Tests", "Malaria", "Typhoid", "Brucellosis", "Kala"];
  let men = 0;
  let women = 0;
  
  tables.forEach(table => {
    table.forEach(r => {
      if (r && r.length > 0) {
        let matchedIdx = -1;
        for (let c = 0; c < r.length; c++) {
          const val = String(r[c] || "").toLowerCase().trim();
          if (wanted.some(w => val.includes(w.toLowerCase()))) {
            matchedIdx = c;
            break;
          }
        }
        if (matchedIdx >= 0) {
          const mVal = num(r[matchedIdx + 1]);
          const wVal = num(r[matchedIdx + 2]);
          const extraM = r[matchedIdx + 3] ? num(r[matchedIdx + 3]) : 0;
          const extraW = r[matchedIdx + 4] ? num(r[matchedIdx + 4]) : 0;
          men += mVal + extraM;
          women += wVal + extraW;
        }
      }
    });
  });
  
  return { men, women };
}

export function parseNutritionSheet(aoa: any[][]): NutritionData {
  const data: any = { screening: {}, otp: {}, tsfp: {}, sc: {}, iycf: {} };

  const tsfpHit = findRow(aoa, "TSFP Reporting");
  const otpHit = findRow(aoa, "OTP Reporting");
  const scHit = findRow(aoa, "SC Reporting");
  const iycfHit = findRow(aoa, "IYCF");
  const healthEduHit = findRow(aoa, "Health/Nutrition Education");
  const suppHit = findRow(aoa, "Supplementation");

  const tsfpStart = tsfpHit ? tsfpHit.r : -1;
  const otpStart = otpHit ? otpHit.r : -1;
  const scStart = scHit ? scHit.r : -1;
  const iycfStart = iycfHit ? iycfHit.r : -1;
  const healthEduStart = healthEduHit ? healthEduHit.r : -1;
  const suppStart = suppHit ? suppHit.r : -1;

  // Screening
  let scrBoys = 0, scrGirls = 0, scrWomen = 0;
  let plwValCol = 10;
  const plwHdr = findRow(aoa, "PLW");
  if (plwHdr) {
    plwValCol = plwHdr.c + 1;
  }
  const maleHit = findRow(aoa, "Total Male");
  if (maleHit) {
    scrBoys = num(aoa[maleHit.r]?.[maleHit.c + 1] || 0);
    scrWomen += num(aoa[maleHit.r]?.[plwValCol] || 0);
  }
  const femaleHit = findRow(aoa, "Total Female");
  if (femaleHit) {
    scrGirls = num(aoa[femaleHit.r]?.[femaleHit.c + 1] || 0);
    scrWomen += num(aoa[femaleHit.r]?.[plwValCol] || 0);
  }
  data.screening = { boys: scrBoys, girls: scrGirls, women: scrWomen };

  // OTP
  let otpBoys = 0, otpGirls = 0, otpCured = 0, otpTotalExits = 0, otpRecoveryRate = 0;
  if (otpStart >= 0) {
    let admCol = 6, curedCol = 11, exitsCol = 17;
    for (let r = otpStart; r < Math.min(otpStart + 5, aoa.length); r++) {
      for (let c = 0; c < Math.min(aoa[r]?.length || 0, 20); c++) {
        const v = String(aoa[r]?.[c] || "").toLowerCase();
        if (v.includes("total new admissions")) admCol = c;
        if (v.includes("cured")) curedCol = c;
        if (v.includes("total exits")) exitsCol = c;
      }
    }
    for (let r = otpStart + 2; r < Math.min(otpStart + 20, aoa.length); r++) {
      const cell = String(aoa[r]?.[0] || "").toLowerCase();
      if (!cell) continue;
      const hasNonPwd = cell.includes("non pwd") || cell.includes("non-pwd") || (cell.includes("non") && cell.includes("pwd"));
      if (cell.includes("6-59 months") && cell.includes("male") && !cell.includes("female") && hasNonPwd) {
        otpBoys = num(aoa[r]?.[admCol] || 0);
      }
      if (cell.includes("6-59 months") && cell.includes("female") && hasNonPwd) {
        otpGirls = num(aoa[r]?.[admCol] || 0);
      }
      if (cell.includes("total 6-59") || (cell === "total" && r > otpStart + 5)) {
        otpCured = num(aoa[r]?.[curedCol] || 0);
        otpTotalExits = num(aoa[r]?.[exitsCol] || 0);
        if (otpTotalExits > 0) otpRecoveryRate = Math.round((otpCured / otpTotalExits) * 100);
        break;
      }
    }
  }
  data.otp = { boys: otpBoys, girls: otpGirls, cured: otpCured, totalExits: otpTotalExits, recoveryRate: otpRecoveryRate };

  // TSFP
  let tsfpBoys = 0, tsfpGirls = 0, tsfpWomen = 0, tsfpPlwAdm = 0;
  let tsfpCured = 0, tsfpTotalExits = 0, tsfpRecoveryRate = 0;
  if (tsfpStart >= 0) {
    let admCol = 6, curedCol = 11, exitsCol = 19;
    for (let r = tsfpStart; r < Math.min(tsfpStart + 5, aoa.length); r++) {
      for (let c = 0; c < Math.min(aoa[r]?.length || 0, 22); c++) {
        const v = String(aoa[r]?.[c] || "").toLowerCase();
        if (v.includes("total new admissions")) admCol = c;
        if (v.includes("cured")) curedCol = c;
        if (v.includes("total exits")) exitsCol = c;
      }
    }
    for (let r = tsfpStart + 2; r < Math.min(tsfpStart + 25, aoa.length); r++) {
      const cell = String(aoa[r]?.[0] || "").toLowerCase();
      if (!cell) continue;
      const hasNonPwd = cell.includes("non pwd") || cell.includes("non-pwd") || (cell.includes("non") && cell.includes("pwd"));
      if (cell.includes("6-59 months") && cell.includes("male") && !cell.includes("female") && hasNonPwd) {
        tsfpBoys = num(aoa[r]?.[admCol] || 0);
      }
      if (cell.includes("6-59 months") && cell.includes("female") && hasNonPwd) {
        tsfpGirls = num(aoa[r]?.[admCol] || 0);
      }
      if (cell.includes("total plw")) {
        tsfpWomen = num(aoa[r]?.[admCol] || 0);
        tsfpPlwAdm = num(aoa[r]?.[admCol] || 0);
      }
      if (cell.includes("total 6-59 months")) {
        tsfpCured = num(aoa[r]?.[curedCol] || 0);
        tsfpTotalExits = num(aoa[r]?.[exitsCol] || 0);
        if (tsfpTotalExits > 0) tsfpRecoveryRate = Math.round((tsfpCured / tsfpTotalExits) * 100);
      }
    }
  }
  data.tsfp = { boys: tsfpBoys, girls: tsfpGirls, women: tsfpWomen, plwAdmissions: tsfpPlwAdm, cured: tsfpCured, totalExits: tsfpTotalExits, recoveryRate: tsfpRecoveryRate };

  // SC
  let scCured = 0, scTotalExits = 0, scRecoveryRate = 0;
  if (scStart >= 0) {
    let curedCol = 9, exitsCol = 16;
    for (let r = scStart; r < Math.min(scStart + 5, aoa.length); r++) {
      for (let c = 0; c < Math.min(aoa[r]?.length || 0, 20); c++) {
        const v = String(aoa[r]?.[c] || "").toLowerCase();
        if (v.includes("cured")) curedCol = c;
        if (v.includes("total exits")) exitsCol = c;
      }
    }
    for (let r = scStart + 2; r < Math.min(scStart + 20, aoa.length); r++) {
      const cell = String(aoa[r]?.[0] || "").toLowerCase();
      if (cell === "total") {
        scCured = num(aoa[r]?.[curedCol] || 0);
        scTotalExits = num(aoa[r]?.[exitsCol] || 0);
        if (scTotalExits > 0) scRecoveryRate = Math.round((scCured / scTotalExits) * 100);
        break;
      }
    }
  }
  data.sc = { cured: scCured, totalExits: scTotalExits, recoveryRate: scRecoveryRate };

  // IYCF
  let iycfPregnant = 0, iycfLactating1 = 0, iycfFathers1 = 0, iycfLactating2 = 0, iycfFathers2 = 0;
  let iycfGroupFemale = 0, iycfGroupMale = 0, iycfHouseholds = 0;
  if (iycfStart >= 0) {
    let valCol = 10;
    for (let r = iycfStart; r < Math.min(iycfStart + 15, aoa.length); r++) {
      for (let c = 0; c < Math.min(aoa[r]?.length || 0, 15); c++) {
        const v = String(aoa[r]?.[c] || "").toLowerCase();
        if (v.includes("non pwd") && c > 5) {
          valCol = c + 1;
          break;
        }
      }
    }

    for (let r = iycfStart; r < Math.min(iycfStart + 70, aoa.length); r++) {
      const cell1 = String(aoa[r]?.[1] || "").toLowerCase();
      const val = num(aoa[r]?.[valCol] || 0);

      if (cell1.includes("total pregnant women")) iycfPregnant = val;
      else if (cell1.includes("total lactating women") && cell1.includes("car")) iycfLactating1 = val;
      else if (cell1.includes("total fathers") && cell1.includes("male caregi")) iycfFathers1 = val;
      else if (cell1.includes("total lactating/caretaker")) iycfLactating2 = val;
      else if (cell1.includes("total fathers") && cell1.includes("male caret")) iycfFathers2 = val;
      else if (cell1 === "female total") iycfGroupFemale = val;
      else if (cell1 === "male total") iycfGroupMale = val;
      else if (cell1.includes("number of households")) iycfHouseholds = val;
    }
  }
  data.iycf = {
    pregnant: iycfPregnant,
    lactating1: iycfLactating1, fathers1: iycfFathers1,
    lactating2: iycfLactating2, fathers2: iycfFathers2,
    groupFemale: iycfGroupFemale, groupMale: iycfGroupMale,
    households: iycfHouseholds,
    men: iycfFathers1 + iycfFathers2 + iycfGroupMale,
    women: iycfPregnant + iycfLactating1 + iycfLactating2 + iycfGroupFemale,
    pregnantLactating: iycfPregnant + iycfLactating1 + iycfLactating2,
    fathers: iycfFathers1 + iycfFathers2,
    total: iycfPregnant + iycfLactating1 + iycfFathers1 + iycfLactating2 + iycfFathers2 + iycfGroupFemale + iycfGroupMale
  };

  // Health Education
  let eduMen = 0, eduWomen = 0, eduTotal = 0;
  if (healthEduStart >= 0) {
    let maleCol = -1, femaleCol = -1, reachedCol = -1;
    for (let r = healthEduStart; r < Math.min(healthEduStart + 5, aoa.length); r++) {
      for (let c = 0; c < Math.min(aoa[r]?.length || 0, 20); c++) {
        const v = String(aoa[r]?.[c] || "").toLowerCase();
        if (v.includes("total male") && maleCol < 0) maleCol = c;
        if (v.includes("total female") && femaleCol < 0) femaleCol = c;
        if (v.includes("total reached") && reachedCol < 0) reachedCol = c;
      }
    }
    for (let r = healthEduStart; r < Math.min(healthEduStart + 10, aoa.length); r++) {
      const cell = String(aoa[r]?.[0] || "").toLowerCase();
      if (cell === "total") {
        eduMen = maleCol >= 0 ? num(aoa[r]?.[maleCol] || 0) : 0;
        eduWomen = femaleCol >= 0 ? num(aoa[r]?.[femaleCol] || 0) : 0;
        eduTotal = reachedCol >= 0 ? num(aoa[r]?.[reachedCol] || 0) : 0;
        break;
      }
    }
  }
  data.healthEdu = { men: eduMen, women: eduWomen, total: eduTotal };

  // Supplementation
  let suppTotal = 0;
  let emergencyStock = 0;
  if (suppStart >= 0) {
    for (let r = suppStart + 2; r < Math.min(suppStart + 25, aoa.length); r++) {
      const cell0 = String(aoa[r]?.[0] || "").toLowerCase();
      for (let c = 4; c < 16; c++) {
        suppTotal += num(aoa[r]?.[c] || 0);
      }
      if (cell0.includes("csb") || cell0.includes("blank supplementary")) {
        for (let c = 4; c < 16; c++) {
          emergencyStock += num(aoa[r]?.[c] || 0);
        }
      }
    }
  }
  data.supplementation = suppTotal;
  data.emergencyStock = emergencyStock;

  return data;
}

export async function extractNutritionAll(buf: ArrayBuffer): Promise<Record<FacilityName, NutritionData>> {
  const wb = XLSX.read(buf, { type: "array" });
  const result: Record<string, NutritionData> = {};

  for (const sheetName of wb.SheetNames) {
    const lowerName = sheetName.toLowerCase();
    if (
      lowerName.includes("consolidated") ||
      lowerName.includes("summary") ||
      lowerName.includes("bsfp") ||
      lowerName.includes("sheet6") ||
      lowerName.includes("sshf site")
    ) {
      continue;
    }

    let facility: FacilityName | null = detect(sheetName, FACILITIES);

    if (!facility) {
      const ws = wb.Sheets[sheetName];
      const aoa = sheetToAOA(ws);
      for (let r = 0; r < Math.min(aoa.length, 10); r++) {
        for (let c = 0; c < Math.min(aoa[r]?.length || 0, 12); c++) {
          const v = String(aoa[r][c] || "");
          const match: FacilityName | null = detect(v, FACILITIES);
          if (match) {
            facility = match;
            break;
          }
        }
        if (facility) break;
      }
    }

    if (!facility) continue;

    const ws = wb.Sheets[sheetName];
    const aoa = sheetToAOA(ws);
    result[facility] = parseNutritionSheet(aoa);
  }

  return result as Record<FacilityName, NutritionData>;
}

export function detectFileAttributes(filename: string): { facility: FacilityName | "Lerpiny & Tangnyang" | null; type: ReportType | null } {
  const lower = filename.toLowerCase();
  
  // Custom smart check: Nutrition contains all/multiple facilities (defaults to Lerpiny & Tangnyang)
  if (lower.includes("nutrition") || lower.includes("nis") || lower.includes("cluster")) {
    return { facility: "Lerpiny & Tangnyang", type: "Nutrition" };
  }

  let facility: FacilityName | null = null;
  let type: ReportType | null = null;

  // Specific automatic overrides for Keew EPI and Dhornor Lab to bypass manual selection
  if ((lower.includes("keew") || lower.includes("kew")) && (lower.includes("epi") || lower.includes("routine") || lower.includes("vaccin"))) {
    facility = "Keew";
    type = "EPI";
  } else if ((lower.includes("dhornor") || lower.includes("dhonor") || lower.includes("dhor")) && (lower.includes("lab") || lower.includes("laboratory") || lower.includes("analysis") || lower.includes("tests") || lower.includes("test") || lower.endsWith(".docx"))) {
    facility = "Dhornor";
    type = "Lab";
  }

  if (!facility) {
    for (const [key, aliases] of Object.entries(FACILITIES)) {
      if (aliases.some(alias => lower.includes(alias.toLowerCase()))) {
        facility = key as FacilityName;
        break;
      }
    }
  }

  if (!type) {
    for (const [key, aliases] of Object.entries(REPORT_TYPES)) {
      if (aliases.some(alias => lower.includes(alias.toLowerCase()))) {
        type = key as ReportType;
        break;
      }
    }
  }

  // File extension check fallbacks
  if (!type) {
    if (lower.endsWith(".docx")) {
      if (lower.includes("muac")) {
        type = "MUAC";
      } else {
        type = "Lab";
      }
    } else if (lower.endsWith(".xlsx")) {
      if (lower.includes("opd")) type = "OPD";
      else if (lower.includes("anc")) type = "ANC";
      else if (lower.includes("epi")) type = "EPI";
    }
  }

  return { facility, type };
}
