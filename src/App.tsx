import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Upload,
  FileSpreadsheet,
  FileText,
  Save,
  CheckCircle,
  AlertTriangle,
  FileCheck,
  RefreshCw,
  TrendingUp,
  Download,
  Copy,
  LayoutDashboard,
  MapPin,
  Check,
  Database
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";

import {
  FacilityName,
  ReportType,
  StagedFile,
  IndicatorValue,
  FacilityExtractedData
} from "./types";
import { INDICATORS, sumFac } from "./indicators";
import {
  FACILITIES,
  REPORT_TYPES,
  detectFileAttributes,
  extractOPD,
  extractANC,
  extractEPI,
  extractLab,
  extractNutritionAll,
  num
} from "./extractor";

const MONTHS = [
  { value: "01", name: "January" },
  { value: "02", name: "February" },
  { value: "03", name: "March" },
  { value: "04", name: "April" },
  { value: "05", name: "May" },
  { value: "06", name: "June" },
  { value: "07", name: "July" },
  { value: "08", name: "August" },
  { value: "09", name: "September" },
  { value: "10", name: "October" },
  { value: "11", name: "November" },
  { value: "12", name: "December" }
];

export default function App() {
  // Period state
  const [selectedMonth, setSelectedMonth] = useState<string>("07");
  const [selectedYear, setSelectedYear] = useState<string>("2026");
  const [years, setYears] = useState<string[]>([]);

  // Staged files
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Extracted and cumulative state
  const [extractedData, setExtractedData] = useState<Record<string, FacilityExtractedData>>({});
  const [cumulativeData, setCumulativeData] = useState<Record<string, IndicatorValue>>({});
  const [currentValues, setCurrentValues] = useState<Record<string, IndicatorValue>>({});

  // Status notes
  const [processStatus, setProcessStatus] = useState<{ text: string; isError?: boolean } | null>(null);
  const [saveStatus, setSaveStatus] = useState<{ text: string; isSuccess?: boolean } | null>(null);

  // Export Preview state
  const [exportPreview, setExportPreview] = useState<{ title: string; content: string; mimeType: string; visible: boolean } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate Year Range
  useEffect(() => {
    const currentYr = new Date().getFullYear();
    const yrRange = [];
    for (let yr = currentYr - 2; yr <= currentYr + 1; yr++) {
      yrRange.push(String(yr));
    }
    setYears(yrRange);
    setSelectedYear(String(currentYr));
  }, []);

  // Compute Total Indicator Value
  const computeTotal = (v: Partial<IndicatorValue>): number => {
    if (!v) return 0;
    const sum = (v.men || 0) + (v.women || 0) + (v.boys || 0) + (v.girls || 0);
    return sum > 0 ? sum : (v.total || 0);
  };

  // Load Saved Data & Cumulative Totals for the Selected Month
  const loadPeriodData = async (month: string, year: string) => {
    const periodKey = `report:${year}-${month}`;
    setProcessStatus(null);
    setSaveStatus(null);
    setExportPreview(null);

    // Initial blank current values
    const blankValues: Record<string, IndicatorValue> = {};
    INDICATORS.forEach((ind) => {
      blankValues[ind.code] = { men: 0, women: 0, boys: 0, girls: 0, total: 0 };
    });

    // 1. Gather cumulative historical values from all other stored reports in localStorage
    const histTotals: Record<string, IndicatorValue> = {};
    INDICATORS.forEach((ind) => {
      histTotals[ind.code] = { men: 0, women: 0, boys: 0, girls: 0, total: 0 };
    });

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("report:") && key !== periodKey) {
          const stored = localStorage.getItem(key);
          if (stored) {
            const parsed = JSON.parse(stored);
            INDICATORS.forEach((ind) => {
              const v = parsed[ind.code];
              if (v) {
                histTotals[ind.code].men += v.men || 0;
                histTotals[ind.code].women += v.women || 0;
                histTotals[ind.code].boys += v.boys || 0;
                histTotals[ind.code].girls += v.girls || 0;
                histTotals[ind.code].total += v.total || 0;
              }
            });
          }
        }
      }
    } catch (e) {
      console.error("Failed loading historical cumulative values", e);
    }
    setCumulativeData(histTotals);

    // 2. Load actual current month saved values if they exist
    try {
      const storedCurrent = localStorage.getItem(periodKey);
      if (storedCurrent) {
        const parsed = JSON.parse(storedCurrent);
        setCurrentValues(parsed);
        setSaveStatus({
          text: `✓ Loaded previously saved data for ${MONTHS.find((m) => m.value === month)?.name} ${year}.`,
          isSuccess: true
        });
      } else {
        setCurrentValues(blankValues);
        setSaveStatus(null);
      }
    } catch (e) {
      console.error("Failed loading current period data", e);
      setCurrentValues(blankValues);
    }
  };

  useEffect(() => {
    loadPeriodData(selectedMonth, selectedYear);
  }, [selectedMonth, selectedYear]);

  // Handle Drag & Drop Events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFilesAdded(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFilesAdded(Array.from(e.target.files));
    }
  };

  const handleFilesAdded = (files: File[]) => {
    const newStaged: StagedFile[] = files.map((file) => {
      const detected = detectFileAttributes(file.name);
      return {
        id: Math.random().toString(36).substring(2, 9),
        file,
        facility: detected.facility,
        type: detected.type,
        status: detected.facility && detected.type ? "ready" : "check"
      };
    });
    setStagedFiles((prev) => [...prev, ...newStaged]);
  };

  const removeStagedFile = (id: string) => {
    setStagedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const updateStagedFileAttr = (id: string, field: "facility" | "type", value: string) => {
    setStagedFiles((prev) =>
      prev.map((f) => {
        if (f.id === id) {
          const updated = {
            ...f,
            [field]: value === "" ? null : value
          };
          updated.status = updated.facility && updated.type ? "ready" : "check";
          return updated;
        }
        return f;
      })
    );
  };

  // Process Files and Run Extractions
  const processFiles = async () => {
    setProcessStatus({ text: "Processing files and extracting indicators..." });
    const newExtracted: Record<string, FacilityExtractedData> = {};

    try {
      for (const sf of stagedFiles) {
        if (!sf.facility || !sf.type) continue;
        const buf = await sf.file.arrayBuffer();

        if (sf.type === "Nutrition" || sf.type === "Health Education") {
          const nutData = await extractNutritionAll(buf);
          if (sf.facility === "Lerpiny & Tangnyang" || !sf.facility) {
            Object.keys(nutData).forEach((fac) => {
              newExtracted[fac] = newExtracted[fac] || {};
              newExtracted[fac].nutrition = nutData[fac];
            });
          } else {
            const fac = sf.facility;
            newExtracted[fac] = newExtracted[fac] || {};
            if (nutData[fac]) {
              newExtracted[fac].nutrition = nutData[fac];
            } else {
              const firstKey = Object.keys(nutData)[0];
              if (firstKey) {
                newExtracted[fac].nutrition = nutData[firstKey];
              }
            }
          }
        } else {
          // Individual facility file types
          const fac = sf.facility;
          newExtracted[fac] = newExtracted[fac] || {};

          if (sf.type === "OPD" || sf.type === "Health Data") {
            newExtracted[fac].opd = await extractOPD(buf);
            try {
              const epiData = await extractEPI(buf, fac);
              if (epiData && (epiData.penta3.total > 0 || epiData.measles.total > 0)) {
                newExtracted[fac].epi = epiData;
              }
            } catch (e) { /* ignore */ }
            try {
              const ancData = await extractANC(buf);
              if (ancData && ancData.skilled > 0) {
                newExtracted[fac].anc = ancData;
              }
            } catch (e) { /* ignore */ }
          } else if (sf.type === "ANC") {
            newExtracted[fac].anc = await extractANC(buf);
            try {
              const opdData = await extractOPD(buf);
              if (opdData && (opdData.newAtt.total > 0 || opdData.reAtt.total > 0)) {
                newExtracted[fac].opd = opdData;
              }
            } catch (e) { /* ignore */ }
          } else if (sf.type === "EPI") {
            newExtracted[fac].epi = await extractEPI(buf, fac);
            try {
              const opdData = await extractOPD(buf);
              if (opdData && (opdData.newAtt.total > 0 || opdData.reAtt.total > 0)) {
                newExtracted[fac].opd = opdData;
              }
            } catch (e) { /* ignore */ }
            try {
              const ancData = await extractANC(buf);
              if (ancData && ancData.skilled > 0) {
                newExtracted[fac].anc = ancData;
              }
            } catch (e) { /* ignore */ }
          } else if (sf.type === "Lab") {
            newExtracted[fac].lab = await extractLab(buf);
          }
        }
      }

      setExtractedData(newExtracted);
      setProcessStatus({ text: `✓ Successfully extracted data from ${stagedFiles.length} reports!` });

      // Aggregate indicators automatically from newly extracted files
      const updatedValues = { ...currentValues };
      INDICATORS.forEach((ind) => {
        if (ind.source !== "manual" && ind.extract) {
          updatedValues[ind.code] = ind.extract(newExtracted);
        }
      });
      setCurrentValues(updatedValues);
    } catch (err: any) {
      console.error(err);
      setProcessStatus({ text: `✗ Processing failed: ${err.message || "Unknown error"}`, isError: true });
    }
  };

  // Input Field Update in Ledger
  const handleInputChange = (code: string, key: "men" | "women" | "boys" | "girls" | "total", value: string) => {
    setCurrentValues((prev) => {
      const updatedCodeVal = {
        ...prev[code],
        [key]: num(value)
      };
      updatedCodeVal.total = computeTotal(updatedCodeVal);
      return {
        ...prev,
        [code]: updatedCodeVal
      };
    });
  };

  // Save Ledger Values to LocalStorage
  const saveCurrentValues = () => {
    setSaveStatus({ text: "Saving values..." });
    const periodKey = `report:${selectedYear}-${selectedMonth}`;
    try {
      localStorage.setItem(periodKey, JSON.stringify(currentValues));
      setSaveStatus({ text: `✓ Successfully saved indicators for ${MONTHS.find((m) => m.value === selectedMonth)?.name} ${selectedYear}!`, isSuccess: true });
      // Reload period data to refresh cumulative stats
      loadPeriodData(selectedMonth, selectedYear);
    } catch (e: any) {
      console.error(e);
      setSaveStatus({ text: `✗ Save failed: ${e.message || "Unknown error"}` });
    }
  };

  // Helper: Get indicator values for a single facility
  const getFacilityIndicatorTotal = (indCode: string, facility: string): number => {
    const ind = INDICATORS.find((i) => i.code === indCode);
    if (!ind || ind.source === "manual" || !ind.extract) return 0;
    
    const facData = extractedData[facility];
    if (!facData) return 0;

    const singleFacWrapper = { [facility]: facData };
    const vals = ind.extract(singleFacWrapper);
    return computeTotal(vals);
  };

  // --- EXPORTS IMPLEMENTATION ---
  
  const getPeriodLabel = () => {
    const monthName = MONTHS.find((m) => m.value === selectedMonth)?.name || "Period";
    return `${selectedYear}-${selectedMonth} (${monthName})`;
  };

  const getCsvString = () => {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const activeFacilities = Object.keys(FACILITIES).filter((f) => extractedData[f]);
    let csv = "Bath Research & Analytics System\n";
    csv += `Reporting Month: ${getPeriodLabel()}\n`;
    csv += "by James Gon\n\n";

    // Facility Section
    activeFacilities.forEach((fac) => {
      csv += `============================================================\n`;
      csv += `FACILITY: ${fac}\n`;
      csv += `============================================================\n`;
      csv += "Code,Description,Source,Target,Men,Women,Boys,Girls,Total\n";
      
      INDICATORS.forEach((ind) => {
        let vals: Partial<IndicatorValue> = { men: 0, women: 0, boys: 0, girls: 0, total: 0 };
        if (ind.source !== "manual" && ind.extract) {
          const fData = extractedData[fac];
          if (fData) {
            vals = ind.extract({ [fac]: fData });
          }
        }
        const tot = computeTotal(vals);
        csv += `${esc(ind.code)},${esc(ind.desc)},Health,${ind.target.total},${vals.men || 0},${vals.women || 0},${vals.boys || 0},${vals.girls || 0},${tot}\n`;
      });
      csv += "\n";
    });

    // Grand Totals Combined
    csv += `============================================================\n`;
    csv += `GRAND TOTAL - All Facilities Combined\n`;
    csv += `============================================================\n`;
    csv += "Code,Output Area,Description,Source,Target,Men,Women,Boys,Girls,This Month Total,Cumulative,Progress %\n";
    
    INDICATORS.forEach((ind) => {
      const cur = currentValues[ind.code] || { men: 0, women: 0, boys: 0, girls: 0, total: 0 };
      const cum = cumulativeData[ind.code] || { men: 0, women: 0, boys: 0, girls: 0, total: 0 };
      const cumTotal = computeTotal(cum) + computeTotal(cur);
      const pct = ind.target.total ? Math.round((cumTotal / ind.target.total) * 100) : 0;
      csv += `${esc(ind.code)},${esc(ind.output)},${esc(ind.desc)},Health,${ind.target.total},${cur.men || 0},${cur.women || 0},${cur.boys || 0},${cur.girls || 0},${computeTotal(cur)},${cumTotal},${pct}%\n`;
    });

    return csv;
  };

  const handleExportCsv = () => {
    try {
      const csvStr = getCsvString();
      const blob = new Blob(["\uFEFF" + csvStr], { type: "text/csv;charset=utf-8" });
      const filename = `indicators_${selectedYear}_${selectedMonth}.csv`;

      // Anchor download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 200);

      setExportPreview({
        title: `CSV Export Preview — ${filename}`,
        content: csvStr,
        mimeType: "text/csv",
        visible: true
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportExcel = () => {
    // Generates excel using sheets format in CSV string as a highly readable mock structure or logs
    try {
      const csvStr = getCsvString();
      const blob = new Blob([csvStr], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const filename = `indicators_${selectedYear}_${selectedMonth}.xlsx`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 200);

      setExportPreview({
        title: `Excel Export Raw Contents — ${filename}`,
        content: csvStr,
        mimeType: "text/plain",
        visible: true
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportWord = () => {
    try {
      const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const activeFacilities = Object.keys(FACILITIES).filter((f) => extractedData[f]);
      let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Bath Indicators Report</title>
      <style>body { font-family: Calibri, sans-serif; font-size: 11pt; color: #17262B; }
      h1 { color: #123B35; font-size: 20pt; }
      h2 { color: #1F5F55; font-size: 14pt; border-bottom: 2px solid #1F5F55; margin-top: 24px; padding-bottom: 4px; }
      table { border-collapse: collapse; width: 100%; margin-bottom: 16px; font-size: 10pt; }
      th, td { border: 1px solid #D6D0C0; padding: 6px; text-align: left; }
      th { background-color: #123B35; color: white; }</style></head><body>`;

      html += `<h1>Bath Research & Analytics System</h1>`;
      html += `<p>Reporting Month: <b>${escapeHtml(getPeriodLabel())}</b><br>by James Gon</p>`;

      // Facilities Table Section
      activeFacilities.forEach((fac) => {
        html += `<h2>Facility: ${escapeHtml(fac)}</h2>`;
        html += `<table><thead><tr><th>Code</th><th>Description</th><th>Target</th><th>Men</th><th>Women</th><th>Boys</th><th>Girls</th><th>Total</th></tr></thead><tbody>`;
        INDICATORS.forEach((ind) => {
          let vals: Partial<IndicatorValue> = { men: 0, women: 0, boys: 0, girls: 0, total: 0 };
          if (ind.source !== "manual" && ind.extract) {
            const fData = extractedData[fac];
            if (fData) {
              vals = ind.extract({ [fac]: fData });
            }
          }
          const tot = computeTotal(vals);
          html += `<tr><td><b>${escapeHtml(ind.code)}</b></td><td>${escapeHtml(ind.desc)}</td><td>${ind.target.total}</td><td>${vals.men || 0}</td><td>${vals.women || 0}</td><td>${vals.boys || 0}</td><td>${vals.girls || 0}</td><td><b>${tot}</b></td></tr>`;
        });
        html += `</tbody></table>`;
      });

      // Grand Totals
      html += `<h2>Grand Totals (All Facilities Combined)</h2>`;
      html += `<table><thead><tr><th>Code</th><th>Output Area</th><th>Description</th><th>Target</th><th>Men</th><th>Women</th><th>Boys</th><th>Girls</th><th>This Month</th><th>Cumulative</th><th>Progress %</th></tr></thead><tbody>`;
      INDICATORS.forEach((ind) => {
        const cur = currentValues[ind.code] || { men: 0, women: 0, boys: 0, girls: 0, total: 0 };
        const cum = cumulativeData[ind.code] || { men: 0, women: 0, boys: 0, girls: 0, total: 0 };
        const cumTotal = computeTotal(cum) + computeTotal(cur);
        const pct = ind.target.total ? Math.round((cumTotal / ind.target.total) * 100) : 0;
        html += `<tr>
          <td><b>${escapeHtml(ind.code)}</b></td>
          <td>${escapeHtml(ind.output)}</td>
          <td>${escapeHtml(ind.desc)}</td>
          <td>${ind.target.total}</td>
          <td>${cur.men || 0}</td>
          <td>${cur.women || 0}</td>
          <td>${cur.boys || 0}</td>
          <td>${cur.girls || 0}</td>
          <td><b>${computeTotal(cur)}</b></td>
          <td><b>${cumTotal}</b></td>
          <td><b>${pct}%</b></td>
        </tr>`;
      });
      html += `</tbody></table></body></html>`;

      const blob = new Blob(["\uFEFF" + html], { type: "application/msword;charset=utf-8" });
      const filename = `indicators_${selectedYear}_${selectedMonth}.doc`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 200);

      setExportPreview({
        title: `Word Document Export — ${filename}`,
        content: html,
        mimeType: "text/html",
        visible: true
      });
    } catch (e) {
      console.error(e);
    }
  };

  const copyExportToClipboard = () => {
    if (!exportPreview) return;
    navigator.clipboard.writeText(exportPreview.content);
    alert("Export data copied to clipboard successfully!");
  };

  // --- CHARTS DATA PREPARATION ---

  // 1. Output Area Progress Data (Horizontal bar chart)
  const getOutputAreaProgressData = () => {
    const byOutput: Record<string, { target: number; reached: number }> = {};
    INDICATORS.forEach((ind) => {
      const cur = currentValues[ind.code] || { men: 0, women: 0, boys: 0, girls: 0, total: 0 };
      const cum = cumulativeData[ind.code] || { men: 0, women: 0, boys: 0, girls: 0, total: 0 };
      const totalReachedVal = computeTotal(cum) + computeTotal(cur);

      if (!byOutput[ind.output]) {
        byOutput[ind.output] = { target: 0, reached: 0 };
      }
      byOutput[ind.output].target += ind.target.total || 0;
      byOutput[ind.output].reached += totalReachedVal;
    });

    return Object.entries(byOutput).map(([outputName, vals]) => {
      // Abbreviate Output Names (e.g., "Output 1.1 — Access & Facility Support" -> "1.1 Access & Facility")
      const match = outputName.match(/Output\s+([\d.]+)\s*—\s*(.+)/i);
      const label = match ? `${match[1]} ${match[2].split(" ").slice(0, 2).join(" ")}` : outputName.substring(0, 20);
      const progressPct = vals.target ? Math.round((vals.reached / vals.target) * 100) : 0;
      return {
        name: label, // Leave only clean indicator names / output categories, no raw code suffixes in legends
        "Progress %": progressPct
      };
    });
  };

  // 2. Reach by Demographic Group (Pie Chart)
  const getDemographicsData = () => {
    const reach = { Men: 0, Women: 0, Boys: 0, Girls: 0 };
    INDICATORS.forEach((ind) => {
      const cur = currentValues[ind.code] || { men: 0, women: 0, boys: 0, girls: 0, total: 0 };
      const cum = cumulativeData[ind.code] || { men: 0, women: 0, boys: 0, girls: 0, total: 0 };

      if (ind.bd.includes("men")) reach.Men += (cum.men || 0) + (cur.men || 0);
      if (ind.bd.includes("women")) reach.Women += (cum.women || 0) + (cur.women || 0);
      if (ind.bd.includes("boys")) reach.Boys += (cum.boys || 0) + (cur.boys || 0);
      if (ind.bd.includes("girls")) reach.Girls += (cum.girls || 0) + (cur.girls || 0);
    });

    return Object.entries(reach).map(([groupName, val]) => ({
      name: groupName, // Clean group names: "Men", "Women", "Boys", "Girls"
      value: val
    }));
  };

  // 3. Lowest-Performing Indicators (Horizontal Bar Chart)
  const getLowestPerformingData = () => {
    const list = INDICATORS.filter((ind) => ind.target.total > 0).map((ind) => {
      const cur = currentValues[ind.code] || { men: 0, women: 0, boys: 0, girls: 0, total: 0 };
      const cum = cumulativeData[ind.code] || { men: 0, women: 0, boys: 0, girls: 0, total: 0 };
      const totalReachedVal = computeTotal(cum) + computeTotal(cur);
      const pct = ind.target.total ? Math.round((totalReachedVal / ind.target.total) * 100) : 0;

      // Extract short name for readability on charts
      const shortDesc = ind.desc.length > 25 ? `${ind.desc.substring(0, 25)}...` : ind.desc;

      return {
        name: shortDesc, // Pure text descriptive name of the indicator specifically, no code appended
        progress: pct
      };
    });

    return list.sort((a, b) => a.progress - b.progress).slice(0, 5);
  };

  const chartColors = ["#2563EB", "#1E40AF", "#EA580C", "#16A34A", "#64748B"];

  return (
    <div className="min-h-screen bg-paper text-ink font-sans selection:bg-teal selection:text-white">
      <div className="wrap max-w-[1240px] mx-auto py-8 px-4 md:px-8">
        
        {/* Header Block */}
        <header className="mb-8 border-b border-rule pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2 bg-teal-dark text-paper rounded-lg inline-flex items-center justify-center">
                <Database className="w-6 h-6" />
              </span>
              <h1 className="font-display font-bold text-3xl md:text-4xl tracking-tight text-teal-dark">
                Bath Research & Analytics System
              </h1>
            </div>
            <p className="text-sm italic text-ink-soft mt-1 font-mono">
              Designed & Developed by James Gon
            </p>
          </div>
          
          {/* Period Selector */}
          <div className="flex flex-wrap items-center gap-3 bg-panel border border-rule px-4 py-2.5 rounded-xl shadow-sm">
            <span className="text-xs font-bold text-ink-soft uppercase tracking-wider font-display">
              Reporting period
            </span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="font-mono text-sm bg-paper hover:bg-rule/30 border border-rule/60 px-3 py-1.5 rounded-lg text-ink font-medium focus:outline-none focus:ring-2 focus:ring-teal cursor-pointer"
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.name}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="font-mono text-sm bg-paper hover:bg-rule/30 border border-rule/60 px-3 py-1.5 rounded-lg text-ink font-medium focus:outline-none focus:ring-2 focus:ring-teal cursor-pointer"
            >
              {years.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>
        </header>

        {/* Section 1: Upload Reports */}
        <section className="mb-8 bg-panel border border-rule rounded-2xl p-6 shadow-sm transition-all">
          <h2 className="font-display text-lg font-bold text-teal-dark uppercase tracking-wide mb-3 flex items-center gap-2">
            <Upload className="w-5 h-5 text-teal" />
            1. Upload this month's files
          </h2>
          <p className="text-xs text-ink-soft mb-4">
            Upload files matching clinical templates (ANC / EPI / OPD as .xlsx, and Word Lab / MUAC as .docx). Consolidated Nutrition reports will auto-populate across applicable clinics.
          </p>

          {/* Drag and Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? "border-teal bg-teal-tint"
                : "border-rule hover:border-teal hover:bg-teal-tint/10"
            }`}
          >
            <Upload className="w-10 h-10 mx-auto text-teal-dark opacity-70 mb-3" />
            <p className="font-display font-medium text-base text-ink mb-1">
              Drag & drop report files here, or click to browse
            </p>
            <p className="text-xs text-ink-soft font-mono">
              Accepts .xlsx and .docx spreadsheets and reports
            </p>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              accept=".xlsx,.docx"
              className="hidden"
            />
          </div>

          {/* Staged Files List */}
          {stagedFiles.length > 0 && (
            <div className="mt-6 space-y-3">
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-ink-soft">
                Staged Files Queue ({stagedFiles.length})
              </h3>
              <div className="max-h-72 overflow-y-auto space-y-2 pr-2">
                <AnimatePresence>
                  {stagedFiles.map((sf) => (
                    <motion.div
                      key={sf.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="flex flex-wrap md:flex-nowrap items-center justify-between gap-3 p-3 bg-paper border border-rule/50 rounded-xl"
                    >
                      <div className="flex items-center gap-3 min-w-[200px] flex-1">
                        {sf.file.name.endsWith(".xlsx") ? (
                          <FileSpreadsheet className="w-5 h-5 text-good" />
                        ) : (
                          <FileText className="w-5 h-5 text-amber" />
                        )}
                        <span className="font-mono text-xs font-semibold text-ink-soft truncate max-w-xs block" title={sf.file.name}>
                          {sf.file.name}
                        </span>
                      </div>

                      {/* Attribute Selectors */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Facility Dropdown Selector */}
                        <div className="flex flex-col">
                          <label className="text-[9px] uppercase font-bold text-ink-soft tracking-wider mb-0.5">Facility</label>
                          <select
                            value={sf.facility || ""}
                            onChange={(e) => updateStagedFileAttr(sf.id, "facility", e.target.value)}
                            className="bg-panel border border-rule text-xs rounded px-2.5 py-1 text-ink focus:outline-none focus:ring-1 focus:ring-teal"
                          >
                            <option value="">Select Facility...</option>
                            <option value="Lerpiny & Tangnyang">Lerpiny & Tangnyang (Nutrition Default)</option>
                            {Object.keys(FACILITIES).map((f) => (
                              <option key={f} value={f}>
                                {f}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Report Type Selector */}
                        <div className="flex flex-col">
                          <label className="text-[9px] uppercase font-bold text-ink-soft tracking-wider mb-0.5">Type</label>
                          <select
                            value={sf.type || ""}
                            onChange={(e) => updateStagedFileAttr(sf.id, "type", e.target.value)}
                            className="bg-panel border border-rule text-xs rounded px-2.5 py-1 text-ink focus:outline-none focus:ring-1 focus:ring-teal"
                          >
                            <option value="">Select Type...</option>
                            {Object.keys(REPORT_TYPES).map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </div>

                        <button
                          onClick={() => removeStagedFile(sf.id)}
                          className="p-1.5 hover:bg-amber-tint hover:text-amber text-ink-soft rounded-lg transition-colors mt-4 self-center"
                          title="Remove from queue"
                        >
                          ✕
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Extraction Trigger Panel */}
              <div className="flex items-center gap-4 mt-6 pt-4 border-t border-rule/40">
                <button
                  onClick={processFiles}
                  disabled={stagedFiles.length === 0}
                  className="flex items-center gap-2 bg-teal hover:bg-teal-dark disabled:opacity-40 text-white font-display text-sm font-semibold px-6 py-2.5 rounded-xl transition-all cursor-pointer shadow-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                  Process files
                </button>
                {processStatus && (
                  <span
                    className={`text-xs font-semibold ${
                      processStatus.isError ? "text-amber" : "text-good"
                    }`}
                  >
                    {processStatus.text}
                  </span>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Section 2: Coverage Matrix */}
        <section className="mb-8 bg-panel border border-rule rounded-2xl p-6 shadow-sm">
          <h2 className="font-display text-lg font-bold text-teal-dark uppercase tracking-wide mb-3 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-teal" />
            2. Facility coverage this session
          </h2>
          <p className="text-xs text-ink-soft mb-4">
            Visual tracking grid of uploaded files corresponding to the 8 clinical reporting hubs. Green dots indicate parsed coverage for this active workspace session.
          </p>

          <div className="overflow-x-auto">
            <div className="min-w-[640px] grid grid-cols-[160px_repeat(6,1fr)] gap-px bg-rule/50 border border-rule rounded-xl overflow-hidden text-xs">
              {/* Header */}
              <div className="bg-teal-dark text-paper p-3 font-display font-bold">Facility</div>
              {Object.keys(REPORT_TYPES).map((t) => (
                <div key={t} className="bg-teal-dark text-paper p-3 text-center font-display font-bold">
                  {t}
                </div>
              ))}

              {/* Rows */}
              {Object.keys(FACILITIES).map((fac) => (
                <React.Fragment key={fac}>
                  <div className="bg-panel p-3 font-semibold text-ink border-b border-rule/10 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-teal" />
                    {fac}
                  </div>
                  {Object.keys(REPORT_TYPES).map((t) => {
                    const hasReport = stagedFiles.some(
                      (sf) =>
                        sf.facility === fac &&
                        sf.type === t &&
                        extractedData[fac] &&
                        ((t === "OPD" && extractedData[fac].opd) ||
                          (t === "Health Data" && extractedData[fac].opd) ||
                          (t === "ANC" && extractedData[fac].anc) ||
                          (t === "EPI" && extractedData[fac].epi) ||
                          (t === "Lab" && extractedData[fac].lab) ||
                          (t === "Nutrition" && extractedData[fac].nutrition) ||
                          (t === "Health Education" && extractedData[fac].nutrition))
                    ) || (
                      (t === "Nutrition" || t === "Health Education") && 
                      stagedFiles.some(
                        (sf) => 
                          (sf.type === "Nutrition" || sf.type === "Health Education") && 
                          extractedData[fac]?.nutrition
                      )
                    );

                    return (
                      <div key={t} className="bg-panel p-3 flex items-center justify-center border-b border-rule/10">
                        <span
                          className={`w-3.5 h-3.5 rounded-full transition-all ${
                            hasReport ? "bg-good shadow" : "bg-rule/30"
                          }`}
                        />
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </section>

        {/* Section 3: Totals Matrix */}
        <section className="mb-8 bg-panel border border-rule rounded-2xl p-6 shadow-sm">
          <h2 className="font-display text-lg font-bold text-teal-dark uppercase tracking-wide mb-3 flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-teal" />
            3. Indicator totals across 8 facilities
          </h2>
          <p className="text-xs text-ink-soft mb-4">
            Cross-tabulation of values extracted dynamically per clinic for this period. Manual-only fields calculate total summed inputs entered down in the ledger.
          </p>

          <div className="overflow-x-auto max-h-[480px] border border-rule/60 rounded-xl">
            <table className="min-w-[800px] w-full text-xs text-left border-collapse">
              <thead className="bg-teal-tint/50 text-teal-dark font-display sticky top-0 border-b border-rule/60 backdrop-blur-md z-10">
                <tr>
                  <th className="p-3 font-bold w-[70px]">Code</th>
                  <th className="p-3 font-bold min-w-[180px]">Description</th>
                  {Object.keys(FACILITIES).map((fac) => (
                    <th key={fac} className="p-3 font-bold text-right font-mono">
                      {fac}
                    </th>
                  ))}
                  <th className="p-3 font-bold text-right bg-teal-tint/80 border-l border-rule/40 font-mono">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule/20 bg-panel">
                {INDICATORS.map((ind) => {
                  let grandTot = 0;
                  const valuesPerFac: Record<string, number> = {};

                  Object.keys(FACILITIES).forEach((fac) => {
                    const v = getFacilityIndicatorTotal(ind.code, fac);
                    valuesPerFac[fac] = v;
                    grandTot += v;
                  });

                  // For manual indicators, use input current values total
                  if (ind.source === "manual") {
                    grandTot = computeTotal(currentValues[ind.code] || {});
                  }

                  return (
                    <tr key={ind.code} className="hover:bg-paper/20">
                      <td className="p-3 font-mono font-bold text-teal-dark border-r border-rule/10">
                        {ind.code}
                      </td>
                      <td className="p-3 text-ink font-medium max-w-[220px] truncate" title={ind.desc}>
                        {ind.desc}
                      </td>
                      {Object.keys(FACILITIES).map((fac) => (
                        <td key={fac} className="p-3 text-right font-mono text-ink-soft">
                          {valuesPerFac[fac] > 0 ? valuesPerFac[fac].toLocaleString() : "—"}
                        </td>
                      ))}
                      <td className="p-3 text-right font-mono font-bold text-teal bg-teal-tint/10 border-l border-rule/40">
                        {grandTot > 0 ? grandTot.toLocaleString() : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 4: Indicator Ledger */}
        <section className="mb-8 bg-panel border border-rule rounded-2xl p-6 shadow-sm">
          <h2 className="font-display text-lg font-bold text-teal-dark uppercase tracking-wide mb-3 flex items-center gap-2">
            <Database className="w-5 h-5 text-teal" />
            4. Indicator ledger
          </h2>
          <p className="text-xs text-ink-soft mb-4">
            Verify, edit, and input reporting numbers here before finalizing. Highlight tags indicate file sources (<span className="text-good font-semibold">Auto</span> = parsed spreadsheet data, <span className="text-amber font-semibold">Check</span> = validation recommended, <span className="text-ink-soft font-semibold">Manual</span> = manual data logging).
          </p>

          <div className="space-y-6">
            {/* Grouped by Output Section */}
            {Array.from(new Set(INDICATORS.map((i) => i.output))).map((outName) => {
              const outputIndicators = INDICATORS.filter((i) => i.output === outName);

              return (
                <div key={outName} className="border border-rule/40 rounded-xl overflow-hidden">
                  <div className="bg-teal-tint/40 text-teal-dark font-display font-bold text-xs p-3.5 border-b border-rule/30 tracking-wide uppercase">
                    {outName}
                  </div>
                  <div className="divide-y divide-rule/20 bg-panel">
                    {outputIndicators.map((ind) => {
                      const curVal = currentValues[ind.code] || { men: 0, women: 0, boys: 0, girls: 0, total: 0 };
                      const cumVal = cumulativeData[ind.code] || { men: 0, women: 0, boys: 0, girls: 0, total: 0 };
                      const currentSum = computeTotal(curVal);
                      const cumTotalIncCurrent = computeTotal(cumVal) + currentSum;
                      const progressPct = ind.target.total
                        ? Math.min(100, Math.round((cumTotalIncCurrent / ind.target.total) * 100))
                        : 0;

                      return (
                        <div key={ind.code} className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                          <div className="flex-1 min-w-[240px]">
                            <div className="flex items-center gap-2.5 mb-1">
                              <span className="font-mono text-xs font-bold text-teal bg-teal-tint px-2 py-0.5 rounded">
                                {ind.code}
                              </span>
                              <span
                                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                  ind.source === "manual"
                                    ? "bg-rule/40 text-ink-soft"
                                    : ind.source === "check"
                                    ? "bg-amber-tint text-amber"
                                    : "bg-good-tint text-good"
                                }`}
                              >
                                {ind.source === "manual" ? "Manual" : ind.source === "check" ? "Check" : "Auto"}
                              </span>
                            </div>
                            <h4 className="font-display font-semibold text-sm text-ink leading-tight">
                              {ind.desc}
                            </h4>
                          </div>

                          {/* Target Display */}
                          <div className="text-left md:text-right min-w-[80px]">
                            <span className="text-[10px] uppercase font-bold text-ink-soft tracking-wider block">Target</span>
                            <span className="font-mono text-sm font-bold text-ink-soft">
                              {ind.target.total.toLocaleString()}
                            </span>
                          </div>

                          {/* Breakdowns Forms */}
                          <div className="flex flex-wrap items-center gap-3">
                            {(ind.bd.length > 0 ? ind.bd : (["total"] as const)).map((key) => {
                              const val = curVal[key] !== undefined ? curVal[key] : 0;
                              return (
                                <div key={key} className="flex flex-col items-center">
                                  <label className="text-[10px] font-semibold text-ink-soft uppercase tracking-wider mb-1 font-mono">
                                    {key}
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={val || ""}
                                    onChange={(e) => handleInputChange(ind.code, key, e.target.value)}
                                    className="w-20 font-mono text-sm font-semibold text-center bg-paper/50 hover:bg-paper/80 border border-rule/60 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-teal"
                                  />
                                </div>
                              );
                            })}
                          </div>

                          {/* Cumulative Progress Ring */}
                          <div className="flex items-center gap-3 min-w-[150px] justify-end">
                            <div className="text-right">
                              <span className="text-[10px] uppercase font-bold text-ink-soft tracking-wider block">Cumulative</span>
                              <span className="font-mono text-xs text-ink-soft font-semibold block">
                                cur. {currentSum.toLocaleString()}
                              </span>
                              <span className="font-mono text-xs font-bold text-teal block">
                                cum. {cumTotalIncCurrent.toLocaleString()}
                              </span>
                            </div>

                            {/* Dynamic Conic Gradient Circular Progress Ring */}
                            <div
                              className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{
                                background: `conic-gradient(#1F5F55 ${progressPct * 3.6}deg, #E3DECD 0)`
                              }}
                            >
                              <div className="w-8.5 h-8.5 rounded-full bg-panel flex items-center justify-center">
                                <span className="font-mono text-[10px] font-bold text-ink">
                                  {progressPct}%
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Action Trigger Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-4 mt-8 pt-6 border-t border-rule/50">
            <div className="flex items-center gap-3">
              <button
                onClick={saveCurrentValues}
                className="flex items-center gap-2 bg-good hover:bg-good/95 text-white font-display text-sm font-semibold px-6 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                Save this month's numbers
              </button>
              {saveStatus && (
                <span className={`text-xs font-semibold ${saveStatus.isSuccess ? "text-good" : "text-amber"}`}>
                  {saveStatus.text}
                </span>
              )}
            </div>

            {/* Export trigger groups */}
            <div className="flex items-center gap-2 bg-paper/60 border border-rule px-3 py-1.5 rounded-xl">
              <span className="text-xs font-bold text-ink-soft uppercase tracking-wider font-display mr-2">
                Export Options:
              </span>
              <button
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 hover:bg-rule bg-panel border border-rule/60 text-teal-dark font-display text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                CSV
              </button>
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 hover:bg-rule bg-panel border border-rule/60 text-teal-dark font-display text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Excel
              </button>
              <button
                onClick={handleExportWord}
                className="flex items-center gap-1.5 hover:bg-rule bg-panel border border-rule/60 text-teal-dark font-display text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                Word
              </button>
            </div>
          </div>

          {/* Export Content Preview Drawer */}
          {exportPreview?.visible && (
            <div className="mt-6 border border-rule/60 rounded-xl p-4 bg-paper max-h-[360px] overflow-hidden flex flex-col">
              <div className="flex justify-between items-center pb-2 border-b border-rule/40 mb-3">
                <span className="font-display text-xs font-bold text-teal-dark uppercase tracking-wider">
                  {exportPreview.title}
                </span>
                <button
                  onClick={copyExportToClipboard}
                  className="flex items-center gap-1 bg-teal hover:bg-teal-dark text-white font-display text-[11px] font-bold px-2.5 py-1 rounded-md transition-all cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  Copy to clipboard
                </button>
              </div>
              <pre className="text-[10px] font-mono text-ink overflow-auto bg-panel p-3 rounded-lg border border-rule/40 select-all max-h-[220px]">
                {exportPreview.content}
              </pre>
            </div>
          )}
        </section>

        {/* Section 5: Analytics Dashboard (Pure graphs, no unrequested extras) */}
        <section className="mb-8 bg-panel border border-rule rounded-2xl p-6 shadow-sm">
          <h2 className="font-display text-lg font-bold text-teal-dark uppercase tracking-wide mb-3 flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-teal" />
            5. Dashboard &amp; insights
          </h2>
          <p className="text-xs text-ink-soft mb-6">
            Cumulative target achievement metrics computed in real-time across active indicator registers.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Chart 1: Progress by Output Area */}
            <div className="bg-paper/40 border border-rule/50 rounded-xl p-4">
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-teal-dark mb-4 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" />
                Progress by Output Area
              </h3>
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={getOutputAreaProgressData()}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#D6D0C0" opacity={0.4} />
                    <XAxis type="number" domain={[0, 100]} stroke="#4E5A5C" fontSize={10} fontStyle="font-mono" unit="%" />
                    <YAxis dataKey="name" type="category" stroke="#4E5A5C" fontSize={10} width={90} />
                    {/* Tooltips formatted to reflect only the metric values specifically */}
                    <Tooltip
                      formatter={(value: any) => [`${value}%`, ""]}
                      contentStyle={{ background: "#17262B", border: "none", borderRadius: "8px", color: "#FFF" }}
                      itemStyle={{ color: "#FFF", fontSize: "11px", fontFamily: "monospace" }}
                      labelStyle={{ fontSize: "11px", fontWeight: "bold", color: "#EFEEE6", marginBottom: "4px" }}
                    />
                    <Bar dataKey="Progress %" fill="#1F5F55" radius={[0, 4, 4, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Cumulative Reach by Group */}
            <div className="bg-paper/40 border border-rule/50 rounded-xl p-4">
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-teal-dark mb-4">
                Reach by group (cumulative)
              </h3>
              <div className="h-[240px] w-full flex flex-col sm:flex-row items-center justify-around gap-4">
                <div className="h-[180px] w-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={getDemographicsData()}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {getDemographicsData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                        ))}
                      </Pie>
                      {/* Tooltips formatted to reflect only the metric values specifically */}
                      <Tooltip
                        formatter={(value: any) => [value.toLocaleString(), ""]}
                        contentStyle={{ background: "#17262B", border: "none", borderRadius: "8px", color: "#FFF" }}
                        itemStyle={{ color: "#FFF", fontSize: "11px", fontFamily: "monospace" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legends containing ONLY clean indicator/metric names specifically, NO codes or values */}
                <div className="flex flex-col gap-2">
                  {getDemographicsData().map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-2 text-xs">
                      <span
                        className="w-3.5 h-3.5 rounded"
                        style={{ backgroundColor: chartColors[index % chartColors.length] }}
                      />
                      <span className="font-medium text-ink-soft">
                        {entry.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Chart 3: Lowest Performing Indicators */}
            <div className="bg-paper/40 border border-rule/50 rounded-xl p-4 md:col-span-2">
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-teal-dark mb-4">
                Lowest-performing indicators
              </h3>
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={getLowestPerformingData()}
                    layout="vertical"
                    margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#D6D0C0" opacity={0.3} />
                    <XAxis type="number" domain={[0, 100]} stroke="#4E5A5C" fontSize={10} unit="%" />
                    <YAxis dataKey="name" type="category" stroke="#4E5A5C" fontSize={10} width={130} />
                    {/* Tooltips formatted to reflect only the metric values specifically */}
                    <Tooltip
                      formatter={(value: any) => [`${value}%`, ""]}
                      contentStyle={{ background: "#17262B", border: "none", borderRadius: "8px", color: "#FFF" }}
                      itemStyle={{ color: "#FFF", fontSize: "11px", fontFamily: "monospace" }}
                      labelStyle={{ fontSize: "11px", fontWeight: "bold", color: "#EFEEE6", marginBottom: "4px" }}
                    />
                    <Bar dataKey="progress" fill="#A8471F" radius={[0, 4, 4, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        </section>

      </div>
    </div>
  );
}
