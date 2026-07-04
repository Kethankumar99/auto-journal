import React, { useRef, useState, useMemo } from "react";
import { 
  X, 
  Download, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight, 
  Calendar, 
  PieChart as PieIcon, 
  Activity,
  Printer,
  Shield,
  FileText,
  BadgeAlert,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Image as ImageIcon
} from "lucide-react";
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from "recharts";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { Trade, DocumentRecord, Category } from "../types";

// Mathematical conversion from OKLCH space to standard sRGB space
function oklchToRgb(l: number, c: number, h: number): [number, number, number] {
  // Convert hue to radians
  const hRad = (h * Math.PI) / 180;
  
  // OKLCH to OKLAB
  const oklabL = l;
  const oklabA = c * Math.cos(hRad);
  const oklabB = c * Math.sin(hRad);
  
  // OKLAB to LMS
  const l_ = oklabL + 0.3963377774 * oklabA + 0.2158037573 * oklabB;
  const m_ = oklabL - 0.1055613458 * oklabA - 0.0638541728 * oklabB;
  const s_ = oklabL - 0.0894841775 * oklabA - 1.2914855480 * oklabB;
  
  // Cube LMS
  const l_cube = l_ * l_ * l_;
  const m_cube = m_ * m_ * m_;
  const s_cube = s_ * s_ * s_;
  
  // LMS to Linear sRGB
  const rL =  4.0767416621 * l_cube - 3.3077115913 * m_cube + 0.2309699292 * s_cube;
  const gL = -1.2684380046 * l_cube + 2.6097574011 * m_cube - 0.3413193965 * s_cube;
  const bL = -0.0041960863 * l_cube - 0.7034186147 * m_cube + 1.7076147010 * s_cube;
  
  // Linear sRGB to standard sRGB (gamma correction)
  const gamma = (val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    return clamped <= 0.0031308 
      ? 12.92 * clamped 
      : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  };
  
  const r = Math.round(gamma(rL) * 255);
  const g = Math.round(gamma(gL) * 255);
  const b = Math.round(gamma(bL) * 255);
  
  return [r, g, b];
}

// Mathematical conversion from OKLAB space to standard sRGB space
function oklabToRgb(l: number, a: number, bCoord: number): [number, number, number] {
  // OKLAB to LMS
  const l_ = l + 0.3963377774 * a + 0.2158037573 * bCoord;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * bCoord;
  const s_ = l - 0.0894841775 * a - 1.2914855480 * bCoord;
  
  // Cube LMS
  const l_cube = l_ * l_ * l_;
  const m_cube = m_ * m_ * m_;
  const s_cube = s_ * s_ * s_;
  
  // LMS to Linear sRGB
  const rL =  4.0767416621 * l_cube - 3.3077115913 * m_cube + 0.2309699292 * s_cube;
  const gL = -1.2684380046 * l_cube + 2.6097574011 * m_cube - 0.3413193965 * s_cube;
  const bL = -0.0041960863 * l_cube - 0.7034186147 * m_cube + 1.7076147010 * s_cube;
  
  // Linear sRGB to standard sRGB (gamma correction)
  const gamma = (val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    return clamped <= 0.0031308 
      ? 12.92 * clamped 
      : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
  };
  
  const r = Math.round(gamma(rL) * 255);
  const g = Math.round(gamma(gL) * 255);
  const b = Math.round(gamma(bL) * 255);
  
  return [r, g, b];
}

// Scans text block or style property and parses oklch(...) and oklab(...) expressions into safe rgb/rgba colors
function replaceModernColorWithRgb(cssString: string): string {
  if (!cssString || typeof cssString !== "string") {
    return cssString;
  }
  
  let result = cssString;
  
  if (result.includes("oklch")) {
    result = result.replace(
      /oklch\s*\(\s*([\d.+-]+%?)[,\s]+([\d.+-]+%?)[,\s]+([\d.+-]+(?:deg)?%?)\s*(?:[,\s/]+\s*([\d.+-]+%?))?\s*\)/gi,
      (match, lStr, cStr, hStr, aStr) => {
        try {
          let l = parseFloat(lStr);
          if (lStr.includes("%")) l = l / 100;
          
          let c = parseFloat(cStr);
          if (cStr.includes("%")) c = c / 100;
          
          let h = parseFloat(hStr);
          
          const [r, g, b] = oklchToRgb(l, c, h);
          
          if (aStr) {
            let a = parseFloat(aStr);
            if (aStr.includes("%")) a = a / 100;
            return `rgba(${r}, ${g}, ${b}, ${a})`;
          }
          
          return `rgb(${r}, ${g}, ${b})`;
        } catch (err) {
          console.error("Error parsing oklch color:", match, err);
          return "rgb(120, 120, 120)"; // Default gray fallback
        }
      }
    );
  }

  if (result.includes("oklab")) {
    result = result.replace(
      /oklab\s*\(\s*([\d.+-]+%?)[,\s]+([\d.+-]+%?)[,\s]+([\d.+-]+%?)\s*(?:[,\s/]+\s*([\d.+-]+%?))?\s*\)/gi,
      (match, lStr, aStrCoord, bStrCoord, aStr) => {
        try {
          let l = parseFloat(lStr);
          if (lStr.includes("%")) l = l / 100;
          
          let aVal = parseFloat(aStrCoord);
          if (aStrCoord.includes("%")) aVal = aVal / 100;
          
          let bVal = parseFloat(bStrCoord);
          if (bStrCoord.includes("%")) bVal = bVal / 100;
          
          const [r, g, b] = oklabToRgb(l, aVal, bVal);
          
          if (aStr) {
            let a = parseFloat(aStr);
            if (aStr.includes("%")) a = a / 100;
            return `rgba(${r}, ${g}, ${b}, ${a})`;
          }
          
          return `rgb(${r}, ${g}, ${b})`;
        } catch (err) {
          console.error("Error parsing oklab color:", match, err);
          return "rgb(120, 120, 120)"; // Default gray fallback
        }
      }
    );
  }
  
  return result;
}

interface ReportScreenProps {
  document: DocumentRecord;
  transactions: Trade[];
  onClose: () => void;
}

const COLORS = ["#3b82f6", "#10b981", "#ef4444", "#f59e0b", "#6366f1", "#8b5cf6", "#ec4899"];

export const ReportScreen: React.FC<ReportScreenProps> = ({ document: doc, transactions, onClose }) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState<"full" | "overview" | "charts" | "table">("full");

  // State for generated JPEG preview (Fallback for iframe download restrictions)
  const [generatedImgUrl, setGeneratedImgUrl] = useState<string | null>(null);
  const [showImgPreviewModal, setShowImgPreviewModal] = useState(false);

  // Column-specific filtering states for "Clean Ledger Table"
  const [colFilterDate, setColFilterDate] = useState("");
  const [colFilterDesc, setColFilterDesc] = useState("");
  const [colFilterCategory, setColFilterCategory] = useState("all");
  const [colFilterAmountType, setColFilterAmountType] = useState("all"); // 'all' | 'positive' | 'negative'

  // Format currency helper
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(val);
  };

  // Chronologically sorted transactions
  const chronologicalTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  }, [transactions]);

  // Apply column-specific filters
  const filteredChronologicalTransactions = useMemo(() => {
    return chronologicalTransactions.filter((tx) => {
      // 1. Date Filter
      const matchesDate = !colFilterDate || tx.date.toLowerCase().includes(colFilterDate.toLowerCase());
      
      // 2. Description Filter
      const matchesDesc = !colFilterDesc || tx.description.toLowerCase().includes(colFilterDesc.toLowerCase());

      // 3. Category Filter
      const matchesCategory = colFilterCategory === "all" || tx.category === colFilterCategory;

      // 4. Amount Type Filter
      let matchesAmount = true;
      if (colFilterAmountType === "positive") {
        matchesAmount = tx.amount >= 0;
      } else if (colFilterAmountType === "negative") {
        matchesAmount = tx.amount < 0;
      }

      return matchesDate && matchesDesc && matchesCategory && matchesAmount;
    });
  }, [chronologicalTransactions, colFilterDate, colFilterDesc, colFilterCategory, colFilterAmountType]);

  // Check if any column filter is active
  const isAnyColumnFilterActive = colFilterDate || colFilterDesc || colFilterCategory !== "all" || colFilterAmountType !== "all";

  // Reset all column filters
  const handleResetColumnFilters = () => {
    setColFilterDate("");
    setColFilterDesc("");
    setColFilterCategory("all");
    setColFilterAmountType("all");
  };

  // 1. Calculate Cumulative Balance timeline data
  const balanceTimeline = useMemo(() => {
    let currentBalance = 0;
    return chronologicalTransactions.map((tx) => {
      currentBalance += tx.amount;
      return {
        date: tx.date,
        amount: tx.amount,
        balance: Number(currentBalance.toFixed(2)),
        description: tx.description,
      };
    });
  }, [chronologicalTransactions]);

  // 2. Group transactions by Category
  const categoryChartData = useMemo(() => {
    const data: Record<string, number> = {};
    transactions.forEach(t => {
      data[t.category] = (data[t.category] || 0) + Math.abs(t.amount);
    });
    return Object.entries(data).map(([name, value]) => ({
      name,
      value: Number(value.toFixed(2))
    }));
  }, [transactions]);

  // 3. Group transactions by month
  const monthlyFlowData = useMemo(() => {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const flow: Record<string, { income: number; expenses: number; net: number }> = {};
    
    // Initialize months
    monthNames.forEach(m => {
      flow[m] = { income: 0, expenses: 0, net: 0 };
    });

    transactions.forEach(t => {
      const d = new Date(t.date);
      if (!isNaN(d.getTime())) {
        const mName = monthNames[d.getMonth()];
        if (t.amount > 0) {
          flow[mName].income += t.amount;
        } else {
          flow[mName].expenses += Math.abs(t.amount);
        }
        flow[mName].net += t.amount;
      }
    });

    return monthNames.map(name => ({
      name,
      Income: Number(flow[name].income.toFixed(2)),
      Expenses: Number(flow[name].expenses.toFixed(2)),
      Net: Number(flow[name].net.toFixed(2))
    })).filter(item => item.Income > 0 || item.Expenses > 0);
  }, [transactions]);

  // 4. Calculate stats highlights
  const highlights = useMemo(() => {
    let highestIncome = { amount: 0, desc: "N/A", date: "N/A" };
    let highestExpense = { amount: 0, desc: "N/A", date: "N/A" };
    let tradingWins = 0;
    let tradingTotal = 0;

    transactions.forEach(t => {
      if (t.amount > 0) {
        if (t.amount > highestIncome.amount) {
          highestIncome = { amount: t.amount, desc: t.description, date: t.date };
        }
      } else {
        const absVal = Math.abs(t.amount);
        if (absVal > highestExpense.amount) {
          highestExpense = { amount: absVal, desc: t.description, date: t.date };
        }
      }

      if (t.category === Category.Trading) {
        tradingTotal++;
        if (t.amount > 0) tradingWins++;
      }
    });

    const winRate = tradingTotal > 0 ? (tradingWins / tradingTotal) * 100 : 0;

    return {
      highestIncome,
      highestExpense,
      tradingWins,
      tradingTotal,
      winRate
    };
  }, [transactions]);

  // Image capture handler using html2canvas with a bulletproof iframe-compatible fallback
  const captureReport = async () => {
    const reportElement = document.getElementById("full-pdf-report-print-container");
    if (!reportElement) return;

    // Capture the original getComputedStyle of the main window to restore it later
    const originalGetComputedStyle = window.getComputedStyle;

    try {
      setDownloading(true);

      // Temporary override on the main window's getComputedStyle during html2canvas generation.
      // This is crucial because html2canvas queries computed styles which return oklch values
      // natively on modern browsers, throwing color parser errors.
      window.getComputedStyle = function(el: any, pseudo: any) {
        const style = originalGetComputedStyle(el, pseudo);
        return new Proxy(style, {
          get(target: any, prop: any) {
            if (prop === "getPropertyValue") {
              return function(p: string) {
                const val = target.getPropertyValue(p);
                if (typeof val === "string" && (val.includes("oklch") || val.includes("oklab"))) {
                  return replaceModernColorWithRgb(val);
                }
                return val;
              };
            }
            const val = target[prop];
            if (typeof val === "string" && (val.includes("oklch") || val.includes("oklab"))) {
              return replaceModernColorWithRgb(val);
            }
            if (typeof val === "function") {
              return val.bind(target);
            }
            return val;
          }
        });
      };
      
      // Configure canvas with maximum standard settings for crisp rendering
      const canvas = await html2canvas(reportElement, {
        scale: 2, // 2x high resolution
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#f8fafc",
        logging: true,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 1200, // Fixed width virtual desktop viewport to render layout correctly
        onclone: (clonedDoc) => {
          // Replace oklch and oklab in all style tags inside the cloned document head
          const styleElements = clonedDoc.querySelectorAll("style");
          styleElements.forEach((styleEl: any) => {
            if (styleEl.innerHTML && (styleEl.innerHTML.includes("oklch") || styleEl.innerHTML.includes("oklab"))) {
              styleEl.innerHTML = replaceModernColorWithRgb(styleEl.innerHTML);
            }
          });

          // Replace oklch and oklab in any inline style attributes
          const styledElements = clonedDoc.querySelectorAll("[style]");
          styledElements.forEach((el: any) => {
            const styleAttr = el.getAttribute("style");
            if (styleAttr && (styleAttr.includes("oklch") || styleAttr.includes("oklab"))) {
              el.setAttribute("style", replaceModernColorWithRgb(styleAttr));
            }
          });

          // Force layout container to have perfect desktop proportions inside the canvas rendering engine
          const clonedContainer = clonedDoc.getElementById("full-pdf-report-print-container");
          if (clonedContainer) {
            clonedContainer.style.width = "1100px";
            clonedContainer.style.height = "auto";
            clonedContainer.style.padding = "32px";
            clonedContainer.style.boxShadow = "none";
          }
          
          // Recharts ResponsiveContainers inside cloned document must be forced to visible dimensions
          const responsiveContainers = clonedDoc.querySelectorAll(".recharts-responsive-container");
          responsiveContainers.forEach((el: any) => {
            el.style.width = "1000px";
            el.style.height = "400px";
            el.style.minWidth = "1000px";
            el.style.minHeight = "400px";
          });

          // Ensure SVG elements have absolute dimensions so html2canvas renders them
          const svgElements = clonedDoc.querySelectorAll("svg");
          svgElements.forEach((svg: any) => {
            if (!svg.getAttribute("width")) {
              svg.setAttribute("width", svg.clientWidth || svg.getBoundingClientRect().width || "800");
            }
            if (!svg.getAttribute("height")) {
              svg.setAttribute("height", svg.clientHeight || svg.getBoundingClientRect().height || "350");
            }
          });

          // Intercept oklch and oklab in the iframe window's getComputedStyle
          if (clonedDoc.defaultView) {
            const originalClonedGetComputedStyle = clonedDoc.defaultView.getComputedStyle;
            clonedDoc.defaultView.getComputedStyle = function(el: any, pseudo: any) {
              const style = originalClonedGetComputedStyle(el, pseudo);
              return new Proxy(style, {
                get(target: any, prop: any) {
                  if (prop === "getPropertyValue") {
                    return function(p: string) {
                      const val = target.getPropertyValue(p);
                      if (typeof val === "string" && (val.includes("oklch") || val.includes("oklab"))) {
                        return replaceModernColorWithRgb(val);
                      }
                      return val;
                    };
                  }
                  const val = target[prop];
                  if (typeof val === "string" && (val.includes("oklch") || val.includes("oklab"))) {
                    return replaceModernColorWithRgb(val);
                  }
                  if (typeof val === "function") {
                    return val.bind(target);
                  }
                  return val;
                }
              });
            };
          }
        }
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      setGeneratedImgUrl(imgData);
      setShowImgPreviewModal(true); // Open the visual display dialog immediately

      // Attempt standard download trigger
      try {
        const link = document.createElement("a");
        link.href = imgData;
        link.download = `Report_${doc.filename.replace(/\.[^/.]+$/, "")}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err) {
        console.warn("Direct file download restricted in sandbox iframe; rendering image preview instead.", err);
      }
    } catch (e) {
      console.error("Failed to generate image canvas:", e);
    } finally {
      // Always restore the original main window getComputedStyle function
      window.getComputedStyle = originalGetComputedStyle;
      setDownloading(false);
    }
  };

  const downloadPdf = async () => {
    const reportElement = document.getElementById("full-pdf-report-print-container");
    if (!reportElement) return;

    const originalGetComputedStyle = window.getComputedStyle;

    try {
      setDownloading(true);

      // Temporary override on the main window's getComputedStyle during html2canvas generation.
      window.getComputedStyle = function(el: any, pseudo: any) {
        const style = originalGetComputedStyle(el, pseudo);
        return new Proxy(style, {
          get(target: any, prop: any) {
            if (prop === "getPropertyValue") {
              return function(p: string) {
                const val = target.getPropertyValue(p);
                if (typeof val === "string" && (val.includes("oklch") || val.includes("oklab"))) {
                  return replaceModernColorWithRgb(val);
                }
                return val;
              };
            }
            const val = target[prop];
            if (typeof val === "string" && (val.includes("oklch") || val.includes("oklab"))) {
              return replaceModernColorWithRgb(val);
            }
            if (typeof val === "function") {
              return val.bind(target);
            }
            return val;
          }
        });
      };
      
      const canvas = await html2canvas(reportElement, {
        scale: 2, // 2x high resolution
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#f8fafc",
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 1200,
        onclone: (clonedDoc) => {
          // Replace oklch and oklab in styles
          const styleElements = clonedDoc.querySelectorAll("style");
          styleElements.forEach((styleEl: any) => {
            if (styleEl.innerHTML && (styleEl.innerHTML.includes("oklch") || styleEl.innerHTML.includes("oklab"))) {
              styleEl.innerHTML = replaceModernColorWithRgb(styleEl.innerHTML);
            }
          });

          const styledElements = clonedDoc.querySelectorAll("[style]");
          styledElements.forEach((el: any) => {
            const styleAttr = el.getAttribute("style");
            if (styleAttr && (styleAttr.includes("oklch") || styleAttr.includes("oklab"))) {
              el.setAttribute("style", replaceModernColorWithRgb(styleAttr));
            }
          });

          const clonedContainer = clonedDoc.getElementById("full-pdf-report-print-container");
          if (clonedContainer) {
            clonedContainer.style.width = "1100px";
            clonedContainer.style.height = "auto";
            clonedContainer.style.padding = "32px";
            clonedContainer.style.boxShadow = "none";
          }
          
          const responsiveContainers = clonedDoc.querySelectorAll(".recharts-responsive-container");
          responsiveContainers.forEach((el: any) => {
            el.style.width = "1000px";
            el.style.height = "400px";
            el.style.minWidth = "1000px";
            el.style.minHeight = "400px";
          });

          const svgElements = clonedDoc.querySelectorAll("svg");
          svgElements.forEach((svg: any) => {
            if (!svg.getAttribute("width")) {
              svg.setAttribute("width", svg.clientWidth || svg.getBoundingClientRect().width || "800");
            }
            if (!svg.getAttribute("height")) {
              svg.setAttribute("height", svg.clientHeight || svg.getBoundingClientRect().height || "350");
            }
          });

          if (clonedDoc.defaultView) {
            const originalClonedGetComputedStyle = clonedDoc.defaultView.getComputedStyle;
            clonedDoc.defaultView.getComputedStyle = function(el: any, pseudo: any) {
              const style = originalClonedGetComputedStyle(el, pseudo);
              return new Proxy(style, {
                get(target: any, prop: any) {
                  if (prop === "getPropertyValue") {
                    return function(p: string) {
                      const val = target.getPropertyValue(p);
                      if (typeof val === "string" && (val.includes("oklch") || val.includes("oklab"))) {
                        return replaceModernColorWithRgb(val);
                      }
                      return val;
                    };
                  }
                  const val = target[prop];
                  if (typeof val === "string" && (val.includes("oklch") || val.includes("oklab"))) {
                    return replaceModernColorWithRgb(val);
                  }
                  if (typeof val === "function") {
                    return val.bind(target);
                  }
                  return val;
                }
              });
            };
          }
        }
      });

      const imgData = canvas.toDataURL("image/jpeg", 1.0);
      
      // Calculate standard PDF dimensions (A4 size is 210mm x 297mm)
      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight, undefined, "FAST");
      heightLeft -= pageHeight;

      // Slice remaining pages
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight, undefined, "FAST");
        heightLeft -= pageHeight;
      }

      const safeFilename = doc.filename.replace(/\.[^/.]+$/, "").replace(/[^a-z0-9_-]/gi, "_");
      pdf.save(`Report_${safeFilename}.pdf`);
      
    } catch (e) {
      console.error("Failed to generate PDF using jsPDF:", e);
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
      setDownloading(false);
    }
  };

  const triggerNativePrint = () => {
    try {
      window.focus();
      window.print();
    } catch (e) {
      console.error("Native print command failed:", e);
    }
  };

  const isNetPositive = doc.summary.net_pl >= 0;

  return (
    <div id="report-screen-modal" className="fixed inset-0 z-50 bg-slate-50 overflow-y-auto flex flex-col animate-fade-in">
      {/* Dynamic Style Block for Native/Perfect PDF Printing override */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          /* Hide main app contents completely, showing only our modal root */
          body > :not(#report-screen-modal) {
            display: none !important;
          }
          #report-screen-modal {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            background: white !important;
            backdrop-filter: none !important;
            padding: 0 !important;
            margin: 0 !important;
            z-index: 9999 !important;
          }
          /* Hide parent layout overlays, borders, buttons and non-printable blocks */
          #report-screen-modal .bg-slate-900.text-white, 
          #report-screen-modal .bg-white.border-b,
          #report-screen-modal .no-print,
          #report-screen-modal button,
          #report-screen-modal select,
          #report-screen-modal input {
            display: none !important;
          }
          /* Expand the capture element to fill the physical page naturally */
          #capture-report-container {
            display: block !important;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            padding: 24px !important;
            margin: 0 !important;
            height: auto !important;
            overflow: visible !important;
            width: 100% !important;
          }
          body, html {
            background: white !important;
            color: black !important;
            height: auto !important;
            overflow: visible !important;
          }
        }
      `}} />

      <div className="w-full flex flex-col min-h-screen">
        
        {/* Actions bar above the canvas */}
        <div className="bg-slate-900 text-white px-8 py-5 flex items-center justify-between border-b border-slate-800 shadow-lg shrink-0">
          <div className="flex items-center space-x-3">
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-slate-800 rounded-xl transition-colors text-slate-400 hover:text-white cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <p className="text-xxs font-extrabold text-blue-400 uppercase tracking-widest">Active Document Screen</p>
              <h2 className="text-sm font-bold truncate max-w-xs md:max-w-md">{doc.filename}</h2>
            </div>
          </div>

          <div className="flex items-center space-x-3" id="report-header-actions">
            <button
              onClick={downloadPdf}
              disabled={downloading}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50 text-white text-xs font-extrabold rounded-xl transition-all shadow-md shadow-emerald-950/30 cursor-pointer"
            >
              {downloading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating Full PDF...</span>
                </>
              ) : (
                <>
                  <FileText className="w-3.5 h-3.5" />
                  <span>Download Full Report (PDF)</span>
                </>
              )}
            </button>

            <button
              onClick={captureReport}
              disabled={downloading}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white text-xs font-extrabold rounded-xl transition-all shadow-md shadow-blue-950/30 cursor-pointer"
              title="Convert as Image"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Convert as Image (JPG)</span>
            </button>
            
            <button
              onClick={onClose}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="bg-white border-b border-slate-100 flex px-8 shrink-0 shadow-sm no-print overflow-x-auto">
          <button
            onClick={() => setActiveTab("full")}
            className={`py-3 px-4 font-extrabold text-xs border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "full" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            Full Report View
          </button>
          <button
            onClick={() => setActiveTab("overview")}
            className={`py-3 px-4 font-bold text-xs border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "overview" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            Executive Summary
          </button>
          <button
            onClick={() => setActiveTab("charts")}
            className={`py-3 px-4 font-bold text-xs border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "charts" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            Advanced Visualizations (10/10)
          </button>
          <button
            onClick={() => setActiveTab("table")}
            className={`py-3 px-4 font-bold text-xs border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "table" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            Clean Ledger Table & Column Filters
          </button>
        </div>

        {/* Main Canvas Area */}
        <div 
          ref={reportRef} 
          className="bg-slate-50 flex-1 overflow-y-auto p-6 md:p-10 relative"
        >
          {/* Inner capture wrapper: Has NO overflow restrictions to allow HTML2Canvas to capture full height perfectly! */}
          <div id="capture-report-container" className="bg-slate-50 overflow-visible h-auto w-full max-w-5xl mx-auto">
          {/* Executive Stamp / Header */}
          <div className="border-b border-slate-200 pb-6 mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="inline-flex items-center space-x-2 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-full text-xxs font-bold uppercase mb-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Verified Clean Report</span>
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Auto Journal Ledger Analysis</h1>
              <p className="text-xs text-slate-500 mt-1 flex items-center">
                <FileText className="w-3.5 h-3.5 mr-1" />
                Document: <span className="font-semibold text-slate-700 ml-1">{doc.filename}</span>
                <span className="mx-2">•</span>
                Parsed: <span className="font-semibold text-slate-700">{new Date(doc.uploaded_at).toLocaleString()}</span>
              </p>
            </div>

            <div className="text-left md:text-right">
              <div className="text-xxs font-extrabold text-slate-400 uppercase tracking-widest">Net Balance Summary</div>
              <div className={`text-2xl font-black ${isNetPositive ? "text-emerald-600" : "text-rose-600"}`}>
                {isNetPositive ? "+" : ""}{formatCurrency(doc.summary.net_pl)}
              </div>
              <p className="text-xxs font-bold text-slate-500">Includes {transactions.length} verified operations</p>
            </div>
          </div>

          {activeTab === "full" && (
            <div className="space-y-8 animate-fade-in">
              {/* Scorecard Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200/60 p-5 rounded-2xl shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xxs font-extrabold text-slate-400 uppercase tracking-wider">Total Inflow</span>
                    <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                      <ArrowUpRight className="w-4 h-4" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">{formatCurrency(doc.summary.total_income)}</h3>
                  <p className="text-xxs text-slate-500 mt-1">Total revenue, deposits, or gains</p>
                </div>

                <div className="bg-white border border-slate-200/60 p-5 rounded-2xl shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xxs font-extrabold text-slate-400 uppercase tracking-wider">Total Outflow</span>
                    <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
                      <ArrowDownRight className="w-4 h-4" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">{formatCurrency(doc.summary.total_expenses)}</h3>
                  <p className="text-xxs text-slate-500 mt-1">Total withdrawals, debits, or fees</p>
                </div>

                <div className="bg-white border border-slate-200/60 p-5 rounded-2xl shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xxs font-extrabold text-slate-400 uppercase tracking-wider">Net Result</span>
                    <div className={`p-1.5 rounded-lg ${isNetPositive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                      <TrendingUp className="w-4 h-4" />
                    </div>
                  </div>
                  <h3 className={`text-xl font-bold ${isNetPositive ? "text-emerald-600" : "text-rose-600"}`}>
                    {isNetPositive ? "+" : ""}{formatCurrency(doc.summary.net_pl)}
                  </h3>
                  <p className="text-xxs text-slate-500 mt-1">Net surplus/deficit after calculation</p>
                </div>

                <div className="bg-white border border-slate-200/60 p-5 rounded-2xl shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xxs font-extrabold text-slate-400 uppercase tracking-wider">Performance / Win Rate</span>
                    <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                      <Activity className="w-4 h-4" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">
                    {highlights.tradingTotal > 0 ? `${highlights.winRate.toFixed(1)}%` : `${doc.win_rate || 0}%`}
                  </h3>
                  <p className="text-xxs text-slate-500 mt-1">
                    {highlights.tradingTotal > 0 ? `${highlights.tradingWins} wins out of ${highlights.tradingTotal} trades` : "No trading category trades found"}
                  </p>
                </div>
              </div>

              {/* Advanced Interactive Cashflow (10/10 Visual) */}
              <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
                <div className="mb-4">
                  <span className="text-xxs font-extrabold text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-md">Interactive Visualizer</span>
                  <h3 className="text-base font-extrabold text-slate-800 mt-1.5">Cumulative Balance Flow & Volatility Timeline</h3>
                  <p className="text-xs text-slate-500">Tracks how your cumulative balance fluctuates in real-time as transactions occur</p>
                </div>
                
                <div className="h-80 w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={balanceTimeline} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorBalanceFullView" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={isNetPositive ? "#10b981" : "#3b82f6"} stopOpacity={0.25}/>
                          <stop offset="95%" stopColor={isNetPositive ? "#10b981" : "#3b82f6"} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: "#64748b", fontSize: 10 }}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: "#64748b", fontSize: 10 }}
                        tickFormatter={(v) => `$${v}`}
                      />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-lg border border-slate-800 text-xs max-w-xs">
                                <p className="text-xxs text-slate-400 font-bold uppercase">{data.date}</p>
                                <p className="font-extrabold mt-1 text-sm">Balance: {formatCurrency(data.balance)}</p>
                                <div className="border-t border-slate-800 mt-2 pt-1.5">
                                  <p className="text-xxs text-slate-400 truncate font-semibold">Change: 
                                    <span className={`ml-1 font-bold ${data.amount >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                      {data.amount >= 0 ? "+" : ""}{formatCurrency(data.amount)}
                                    </span>
                                  </p>
                                  <p className="text-xxs text-slate-400 truncate font-medium mt-0.5">Note: {data.description}</p>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="balance" 
                        stroke={isNetPositive ? "#10b981" : "#2563eb"} 
                        strokeWidth={2.5}
                        fillOpacity={1} 
                        fill="url(#colorBalanceFullView)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Observations & Highlights Box */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm">
                  <h4 className="text-sm font-extrabold text-slate-800 mb-4 flex items-center">
                    <ArrowUpRight className="text-emerald-600 w-5 h-5 mr-1.5" />
                    Major Cash Flow Surges
                  </h4>
                  {highlights.highestIncome.amount > 0 ? (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100">
                        <p className="text-xxs text-emerald-800 font-extrabold uppercase tracking-wider">Peak Surplus Entry</p>
                        <p className="text-lg font-black text-slate-900 mt-1">{formatCurrency(highlights.highestIncome.amount)}</p>
                        <p className="text-xs text-slate-600 font-semibold mt-1">{highlights.highestIncome.desc}</p>
                        <p className="text-xxs text-slate-400 mt-1">Recorded on {highlights.highestIncome.date}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No surplus/positive cash flow operations detected.</p>
                  )}
                </div>

                <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm">
                  <h4 className="text-sm font-extrabold text-slate-800 mb-4 flex items-center">
                    <ArrowDownRight className="text-rose-600 w-5 h-5 mr-1.5" />
                    Largest Outflow Drain
                  </h4>
                  {highlights.highestExpense.amount > 0 ? (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-100">
                        <p className="text-xxs text-rose-800 font-extrabold uppercase tracking-wider">Peak Outflow Entry</p>
                        <p className="text-lg font-black text-slate-900 mt-1">{formatCurrency(highlights.highestExpense.amount)}</p>
                        <p className="text-xs text-slate-600 font-semibold mt-1">{highlights.highestExpense.desc}</p>
                        <p className="text-xxs text-slate-400 mt-1">Recorded on {highlights.highestExpense.date}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No negative/debit transactions detected.</p>
                  )}
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Categorical Allocation Donut */}
                <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm">
                  <div className="mb-4">
                    <h3 className="text-sm font-extrabold text-slate-800">Categorical Allocation Breakdown</h3>
                    <p className="text-xs text-slate-500">Distribution of absolute transaction sums by category</p>
                  </div>
                  <div className="h-64 w-full flex flex-col sm:flex-row items-center justify-center">
                    <div className="h-full w-full sm:w-1/2">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categoryChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {categoryChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="w-full sm:w-1/2 space-y-2 max-h-48 overflow-y-auto pr-2 mt-4 sm:mt-0">
                      {categoryChartData.map((entry, index) => {
                        const total = categoryChartData.reduce((acc, curr) => acc + curr.value, 0);
                        const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0";
                        return (
                          <div key={entry.name} className="flex items-center justify-between text-xs font-semibold text-slate-700">
                            <div className="flex items-center space-x-2">
                              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                              <span>{entry.name}</span>
                            </div>
                            <span>{formatCurrency(entry.value)} ({pct}%)</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Monthly Flow Chart */}
                <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm">
                  <div className="mb-4">
                    <h3 className="text-sm font-extrabold text-slate-800">Monthly Inflow vs Outflow</h3>
                    <p className="text-xs text-slate-500">Comparison of monthly income and expenses</p>
                  </div>
                  <div className="h-64 w-full">
                    {monthlyFlowData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyFlowData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 10 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                          <Legend wrapperStyle={{ fontSize: 11, fontWeight: "bold" }} />
                          <Bar dataKey="Income" fill="#10b981" radius={[3, 3, 0, 0]} />
                          <Bar dataKey="Expenses" fill="#f43f5e" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-slate-400">
                        Insufficient monthly intervals to construct Comparison chart.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Complete Chronological Ledger Table */}
              <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
                <div className="mb-4">
                  <h3 className="text-base font-extrabold text-slate-800">Chronological Ledger Log</h3>
                  <p className="text-xs text-slate-500">All transaction history records for this document statement</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-xxs font-extrabold text-white uppercase tracking-widest bg-blue-600 rounded-xl">
                        <th className="py-3.5 px-4 rounded-l-xl">Date</th>
                        <th className="py-3.5 px-4">Description</th>
                        <th className="py-3.5 px-4">Category</th>
                        <th className="py-3.5 px-4 text-right rounded-r-xl">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chronologicalTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center py-10 text-slate-400 font-bold text-xs">
                            No ledger transactions recorded in this document.
                          </td>
                        </tr>
                      ) : (
                        chronologicalTransactions.map((tx) => {
                          const isPositive = tx.amount >= 0;
                          return (
                            <tr key={tx.id} className="border-b border-slate-50 hover:bg-slate-50/40 transition-colors">
                              <td className="py-3 px-4 text-xs font-bold text-slate-600 font-mono whitespace-nowrap">
                                {tx.date}
                              </td>
                              <td className="py-3 px-4 text-xs font-semibold text-slate-800 font-sans max-w-sm truncate" title={tx.description}>
                                {tx.description}
                              </td>
                              <td className="py-3 px-4">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xxs font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
                                  {tx.category}
                                </span>
                              </td>
                              <td className={`py-3 px-4 text-xs font-mono font-bold text-right whitespace-nowrap ${isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                                {isPositive ? "+" : ""}{formatCurrency(tx.amount)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Scorecard Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200/60 p-5 rounded-2xl shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xxs font-extrabold text-slate-400 uppercase tracking-wider">Total Inflow</span>
                    <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                      <ArrowUpRight className="w-4 h-4" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">{formatCurrency(doc.summary.total_income)}</h3>
                  <p className="text-xxs text-slate-500 mt-1">Total revenue, deposits, or gains</p>
                </div>

                <div className="bg-white border border-slate-200/60 p-5 rounded-2xl shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xxs font-extrabold text-slate-400 uppercase tracking-wider">Total Outflow</span>
                    <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
                      <ArrowDownRight className="w-4 h-4" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">{formatCurrency(doc.summary.total_expenses)}</h3>
                  <p className="text-xxs text-slate-500 mt-1">Total withdrawals, debits, or fees</p>
                </div>

                <div className="bg-white border border-slate-200/60 p-5 rounded-2xl shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xxs font-extrabold text-slate-400 uppercase tracking-wider">Net Result</span>
                    <div className={`p-1.5 rounded-lg ${isNetPositive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                      <TrendingUp className="w-4 h-4" />
                    </div>
                  </div>
                  <h3 className={`text-xl font-bold ${isNetPositive ? "text-emerald-600" : "text-rose-600"}`}>
                    {isNetPositive ? "+" : ""}{formatCurrency(doc.summary.net_pl)}
                  </h3>
                  <p className="text-xxs text-slate-500 mt-1">Net surplus/deficit after calculation</p>
                </div>

                <div className="bg-white border border-slate-200/60 p-5 rounded-2xl shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xxs font-extrabold text-slate-400 uppercase tracking-wider">Performance / Win Rate</span>
                    <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                      <Activity className="w-4 h-4" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">
                    {highlights.tradingTotal > 0 ? `${highlights.winRate.toFixed(1)}%` : `${doc.win_rate || 0}%`}
                  </h3>
                  <p className="text-xxs text-slate-500 mt-1">
                    {highlights.tradingTotal > 0 ? `${highlights.tradingWins} wins out of ${highlights.tradingTotal} trades` : "No trading category trades found"}
                  </p>
                </div>
              </div>

              {/* Advanced Interactive Cashflow (10/10 Visual) */}
              <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
                <div className="mb-4">
                  <span className="text-xxs font-extrabold text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-md">Interactive Visualizer</span>
                  <h3 className="text-base font-extrabold text-slate-800 mt-1.5">Cumulative Balance Flow & Volatility Timeline</h3>
                  <p className="text-xs text-slate-500">Tracks how your cumulative balance fluctuates in real-time as transactions occur</p>
                </div>
                
                <div className="h-80 w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={balanceTimeline} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={isNetPositive ? "#10b981" : "#3b82f6"} stopOpacity={0.25}/>
                          <stop offset="95%" stopColor={isNetPositive ? "#10b981" : "#3b82f6"} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: "#64748b", fontSize: 10 }}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: "#64748b", fontSize: 10 }}
                        tickFormatter={(v) => `$${v}`}
                      />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-lg border border-slate-800 text-xs max-w-xs">
                                <p className="text-xxs text-slate-400 font-bold uppercase">{data.date}</p>
                                <p className="font-extrabold mt-1 text-sm">Balance: {formatCurrency(data.balance)}</p>
                                <div className="border-t border-slate-800 mt-2 pt-1.5">
                                  <p className="text-xxs text-slate-400 truncate font-semibold">Change: 
                                    <span className={`ml-1 font-bold ${data.amount >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                      {data.amount >= 0 ? "+" : ""}{formatCurrency(data.amount)}
                                    </span>
                                  </p>
                                  <p className="text-xxs text-slate-400 truncate font-medium mt-0.5">Note: {data.description}</p>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="balance" 
                        stroke={isNetPositive ? "#10b981" : "#2563eb"} 
                        strokeWidth={2.5}
                        fillOpacity={1} 
                        fill="url(#colorBalance)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Observations & Highlights Box */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm">
                  <h4 className="text-sm font-extrabold text-slate-800 mb-4 flex items-center">
                    <ArrowUpRight className="text-emerald-600 w-5 h-5 mr-1.5" />
                    Major Cash Flow Surges
                  </h4>
                  {highlights.highestIncome.amount > 0 ? (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100">
                        <p className="text-xxs text-emerald-800 font-extrabold uppercase tracking-wider">Peak Surplus Entry</p>
                        <p className="text-lg font-black text-slate-900 mt-1">{formatCurrency(highlights.highestIncome.amount)}</p>
                        <p className="text-xs text-slate-600 font-semibold mt-1">{highlights.highestIncome.desc}</p>
                        <p className="text-xxs text-slate-400 mt-1">Recorded on {highlights.highestIncome.date}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No surplus/positive cash flow operations detected.</p>
                  )}
                </div>

                <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm">
                  <h4 className="text-sm font-extrabold text-slate-800 mb-4 flex items-center">
                    <ArrowDownRight className="text-rose-600 w-5 h-5 mr-1.5" />
                    Largest Outflow Drain
                  </h4>
                  {highlights.highestExpense.amount > 0 ? (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-100">
                        <p className="text-xxs text-rose-800 font-extrabold uppercase tracking-wider">Peak Outflow Entry</p>
                        <p className="text-lg font-black text-slate-900 mt-1">{formatCurrency(highlights.highestExpense.amount)}</p>
                        <p className="text-xs text-slate-600 font-semibold mt-1">{highlights.highestExpense.desc}</p>
                        <p className="text-xxs text-slate-400 mt-1">Recorded on {highlights.highestExpense.date}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No negative/debit transactions detected.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "charts" && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Categorical Allocation Donut */}
                <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm">
                  <div className="mb-4">
                    <h3 className="text-sm font-extrabold text-slate-800">Categorical Allocation Breakdown</h3>
                    <p className="text-xs text-slate-500">Distribution of extracted absolute activity sums by category</p>
                  </div>
                  <div className="h-64 w-full flex flex-col sm:flex-row items-center justify-center">
                    <div className="h-full w-full sm:w-1/2">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categoryChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {categoryChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="w-full sm:w-1/2 space-y-2 max-h-48 overflow-y-auto pr-2 mt-4 sm:mt-0">
                      {categoryChartData.map((entry, index) => {
                        const total = categoryChartData.reduce((acc, curr) => acc + curr.value, 0);
                        const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0";
                        return (
                          <div key={entry.name} className="flex items-center justify-between text-xs font-semibold text-slate-700">
                            <div className="flex items-center space-x-2">
                              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                              <span>{entry.name}</span>
                            </div>
                            <span>{formatCurrency(entry.value)} ({pct}%)</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Monthly Flow Chart */}
                <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm">
                  <div className="mb-4">
                    <h3 className="text-sm font-extrabold text-slate-800">Monthly Inflow vs Outflow</h3>
                    <p className="text-xs text-slate-500">Comparison of income streams and expenses by calendar month</p>
                  </div>
                  <div className="h-64 w-full">
                    {monthlyFlowData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyFlowData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 10 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                          <Tooltip formatter={(value: number) => formatCurrency(value)} />
                          <Legend wrapperStyle={{ fontSize: 11, fontWeight: "bold" }} />
                          <Bar dataKey="Income" fill="#10b981" radius={[3, 3, 0, 0]} />
                          <Bar dataKey="Expenses" fill="#f43f5e" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-slate-400">
                        Insufficient monthly ledger intervals to construct inflow comparison.
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {activeTab === "table" && (
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm animate-fade-in">
              
              {/* Header section with Reset filter controls */}
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">Detailed Verified Operations</h3>
                  <p className="text-xs text-slate-500">Use the column filter inputs below to isolate specific ledger entries</p>
                </div>
                
                <div className="flex items-center space-x-3">
                  <span className="text-xxs font-extrabold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-xl whitespace-nowrap">
                    {filteredChronologicalTransactions.length} of {transactions.length} shown
                  </span>
                  {isAnyColumnFilterActive && (
                    <button
                      onClick={handleResetColumnFilters}
                      className="px-2.5 py-1 text-xxs font-extrabold text-blue-600 hover:text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer whitespace-nowrap border border-blue-100"
                    >
                      Clear Column Filters
                    </button>
                  )}
                </div>
              </div>

              {/* Column Filters Input Panel */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6 p-4 bg-slate-50 border border-slate-100 rounded-2xl no-print">
                {/* 1. Date Column Input */}
                <div>
                  <label className="block text-xxs font-bold text-slate-400 uppercase tracking-wider mb-1">Filter Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="e.g. 2026-06"
                      value={colFilterDate}
                      onChange={(e) => setColFilterDate(e.target.value)}
                      className="w-full pl-8 pr-2.5 py-1.5 border border-slate-200 rounded-xl bg-white text-xxs text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* 2. Description Column Input */}
                <div>
                  <label className="block text-xxs font-bold text-slate-400 uppercase tracking-wider mb-1">Filter Description</label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search keywords..."
                      value={colFilterDesc}
                      onChange={(e) => setColFilterDesc(e.target.value)}
                      className="w-full pl-8 pr-2.5 py-1.5 border border-slate-200 rounded-xl bg-white text-xxs text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* 3. Category Column Selector */}
                <div>
                  <label className="block text-xxs font-bold text-slate-400 uppercase tracking-wider mb-1">Filter Category</label>
                  <div className="relative">
                    <Filter className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <select
                      value={colFilterCategory}
                      onChange={(e) => setColFilterCategory(e.target.value)}
                      className="w-full pl-8 pr-2.5 py-1.5 border border-slate-200 rounded-xl bg-white text-xxs text-slate-800 focus:outline-none focus:border-blue-500 appearance-none"
                    >
                      <option value="all">All Categories</option>
                      {Object.values(Category).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 4. Amount Column Selector */}
                <div>
                  <label className="block text-xxs font-bold text-slate-400 uppercase tracking-wider mb-1">Filter Amount</label>
                  <div className="relative">
                    <TrendingUp className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <select
                      value={colFilterAmountType}
                      onChange={(e) => setColFilterAmountType(e.target.value)}
                      className="w-full pl-8 pr-2.5 py-1.5 border border-slate-200 rounded-xl bg-white text-xxs text-slate-800 focus:outline-none focus:border-blue-500 appearance-none"
                    >
                      <option value="all">All Amounts</option>
                      <option value="positive">Inflows (+) Only</option>
                      <option value="negative">Outflows (-) Only</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Clean Ledger Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-xxs font-extrabold text-white uppercase tracking-widest bg-blue-600 rounded-xl">
                      <th className="py-3.5 px-4 rounded-l-xl">Date</th>
                      <th className="py-3.5 px-4">Description</th>
                      <th className="py-3.5 px-4">Category</th>
                      <th className="py-3.5 px-4 text-right rounded-r-xl">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredChronologicalTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-10 text-slate-400 font-bold text-xs">
                          No matching ledger entries found with active column filters.
                        </td>
                      </tr>
                    ) : (
                      filteredChronologicalTransactions.map((tx) => {
                        const isPositive = tx.amount >= 0;
                        return (
                          <tr key={tx.id} className="border-b border-slate-50 hover:bg-slate-50/40 transition-colors">
                            <td className="py-3 px-4 text-xs font-bold text-slate-600 font-mono whitespace-nowrap">
                              {tx.date}
                            </td>
                            <td className="py-3 px-4 text-xs font-semibold text-slate-800 font-sans max-w-sm truncate" title={tx.description}>
                              {tx.description}
                            </td>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xxs font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
                                {tx.category}
                              </span>
                            </td>
                            <td className={`py-3 px-4 text-xs font-mono font-bold text-right whitespace-nowrap ${isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                              {isPositive ? "+" : ""}{formatCurrency(tx.amount)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          </div>

          {/* Off-screen high-fidelity full report container for PDF and Image exports */}
          <div 
            id="full-pdf-report-print-container" 
            style={{ 
              position: "absolute", 
              left: "-9999px", 
              top: "-9999px", 
              width: "1100px", 
              backgroundColor: "#f8fafc",
            }}
            className="p-10 space-y-8 font-sans text-slate-800"
          >
            {/* Header Block */}
            <div className="border-b border-slate-200 pb-6 flex justify-between items-center">
              <div>
                <div className="inline-flex items-center space-x-2 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-full text-xxs font-bold uppercase mb-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Verified Clean Full Executive Report</span>
                </div>
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Auto Journal Ledger Analysis</h1>
                <p className="text-xs text-slate-500 mt-1 flex items-center">
                  <FileText className="w-3.5 h-3.5 mr-1" />
                  Document: <span className="font-semibold text-slate-700 ml-1">{doc.filename}</span>
                  <span className="mx-2">•</span>
                  Parsed: <span className="font-semibold text-slate-700">{new Date(doc.uploaded_at).toLocaleString()}</span>
                </p>
              </div>

              <div className="text-right">
                <div className="text-xxs font-extrabold text-slate-400 uppercase tracking-widest">Net Balance Summary</div>
                <div className={`text-2xl font-black ${isNetPositive ? "text-emerald-600" : "text-rose-600"}`}>
                  {isNetPositive ? "+" : ""}{formatCurrency(doc.summary.net_pl)}
                </div>
                <p className="text-xxs font-bold text-slate-500">Includes {transactions.length} verified operations</p>
              </div>
            </div>

            {/* Scorecard Cards */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200/60 p-5 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xxs font-extrabold text-slate-400 uppercase tracking-wider">Total Inflow</span>
                  <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-slate-900">{formatCurrency(doc.summary.total_income)}</h3>
                <p className="text-xxs text-slate-500 mt-1">Total revenue, deposits, or gains</p>
              </div>

              <div className="bg-white border border-slate-200/60 p-5 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xxs font-extrabold text-slate-400 uppercase tracking-wider">Total Outflow</span>
                  <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
                    <ArrowDownRight className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-slate-900">{formatCurrency(doc.summary.total_expenses)}</h3>
                <p className="text-xxs text-slate-500 mt-1">Total withdrawals, debits, or fees</p>
              </div>

              <div className="bg-white border border-slate-200/60 p-5 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xxs font-extrabold text-slate-400 uppercase tracking-wider">Net Result</span>
                  <div className={`p-1.5 rounded-lg ${isNetPositive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <h3 className={`text-xl font-bold ${isNetPositive ? "text-emerald-600" : "text-rose-600"}`}>
                  {isNetPositive ? "+" : ""}{formatCurrency(doc.summary.net_pl)}
                </h3>
                <p className="text-xxs text-slate-500 mt-1">Net surplus/deficit after calculation</p>
              </div>

              <div className="bg-white border border-slate-200/60 p-5 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xxs font-extrabold text-slate-400 uppercase tracking-wider">Performance / Win Rate</span>
                  <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                    <Activity className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-slate-900">
                  {highlights.tradingTotal > 0 ? `${highlights.winRate.toFixed(1)}%` : `${doc.win_rate || 0}%`}
                </h3>
                <p className="text-xxs text-slate-500 mt-1">
                  {highlights.tradingTotal > 0 ? `${highlights.tradingWins} wins out of ${highlights.tradingTotal} trades` : "No trading category trades found"}
                </p>
              </div>
            </div>

            {/* I. Cumulative Balance Flow Visualizer */}
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
              <div className="mb-4">
                <span className="text-xxs font-extrabold text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-md">Visual Analytics</span>
                <h3 className="text-base font-extrabold text-slate-800 mt-1.5">I. Cumulative Balance Flow & Volatility Timeline</h3>
                <p className="text-xs text-slate-500">Tracks how your cumulative balance fluctuates in real-time as transactions occur</p>
              </div>
              
              <div className="w-[1000px] h-[320px] mt-4 flex items-center justify-center">
                <AreaChart width={1000} height={320} data={balanceTimeline} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorBalancePrint" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={isNetPositive ? "#10b981" : "#3b82f6"} stopOpacity={0.25}/>
                      <stop offset="95%" stopColor={isNetPositive ? "#10b981" : "#3b82f6"} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                  <Area type="monotone" dataKey="balance" stroke={isNetPositive ? "#10b981" : "#2563eb"} strokeWidth={2.5} fillOpacity={1} fill="url(#colorBalancePrint)" />
                </AreaChart>
              </div>
            </div>

            {/* Observations & Highlights Box */}
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm">
                <h4 className="text-sm font-extrabold text-slate-800 mb-4 flex items-center">
                  <ArrowUpRight className="text-emerald-600 w-5 h-5 mr-1.5" />
                  Major Cash Flow Surges
                </h4>
                {highlights.highestIncome.amount > 0 ? (
                  <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100">
                    <p className="text-xxs text-emerald-800 font-extrabold uppercase tracking-wider">Peak Surplus Entry</p>
                    <p className="text-lg font-black text-slate-900 mt-1">{formatCurrency(highlights.highestIncome.amount)}</p>
                    <p className="text-xs text-slate-600 font-semibold mt-1">{highlights.highestIncome.desc}</p>
                    <p className="text-xxs text-slate-400 mt-1">Recorded on {highlights.highestIncome.date}</p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No surplus/positive cash flow operations detected.</p>
                )}
              </div>

              <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm">
                <h4 className="text-sm font-extrabold text-slate-800 mb-4 flex items-center">
                  <ArrowDownRight className="text-rose-600 w-5 h-5 mr-1.5" />
                  Largest Outflow Drain
                </h4>
                {highlights.highestExpense.amount > 0 ? (
                  <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-100">
                    <p className="text-xxs text-rose-800 font-extrabold uppercase tracking-wider">Peak Outflow Entry</p>
                    <p className="text-lg font-black text-slate-900 mt-1">{formatCurrency(highlights.highestExpense.amount)}</p>
                    <p className="text-xs text-slate-600 font-semibold mt-1">{highlights.highestExpense.desc}</p>
                    <p className="text-xxs text-slate-400 mt-1">Recorded on {highlights.highestExpense.date}</p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No negative/debit transactions detected.</p>
                )}
              </div>
            </div>

            {/* II. Visual Analytics & Categorical Allocation */}
            <div className="grid grid-cols-2 gap-6">
              {/* Categorical Allocation Donut */}
              <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm">
                <div className="mb-4">
                  <h3 className="text-sm font-extrabold text-slate-800">II. Categorical Allocation Breakdown</h3>
                  <p className="text-xs text-slate-500">Distribution of absolute activity sums by category</p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="w-[180px] h-[180px]">
                    <PieChart width={180} height={180}>
                      <Pie
                        data={categoryChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={65}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {categoryChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </div>
                  <div className="flex-1 ml-4 space-y-1 max-h-48 overflow-y-auto">
                    {categoryChartData.map((entry, index) => {
                      const total = categoryChartData.reduce((acc, curr) => acc + curr.value, 0);
                      const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0";
                      return (
                        <div key={entry.name} className="flex items-center justify-between text-[10px] font-semibold text-slate-700">
                          <div className="flex items-center space-x-1.5">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                            <span className="truncate max-w-[120px]">{entry.name}</span>
                          </div>
                          <span>{formatCurrency(entry.value)} ({pct}%)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Monthly Flow Chart */}
              <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm">
                <div className="mb-4">
                  <h3 className="text-sm font-extrabold text-slate-800">III. Monthly Flow Comparison</h3>
                  <p className="text-xs text-slate-500">Comparison of monthly income and expenses</p>
                </div>
                <div className="w-full h-[180px] flex items-center justify-center">
                  {monthlyFlowData.length > 0 ? (
                    <BarChart width={440} height={170} data={monthlyFlowData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 9 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 9 }} tickFormatter={(v) => `$${v}`} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend wrapperStyle={{ fontSize: 9, fontWeight: "bold" }} />
                      <Bar dataKey="Income" fill="#10b981" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="Expenses" fill="#f43f5e" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  ) : (
                    <div className="text-xs text-slate-400">
                      Insufficient monthly ledger intervals.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* III. Comprehensive Chronological Transaction Ledger */}
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
              <div className="mb-4">
                <h3 className="text-base font-extrabold text-slate-800">IV. Comprehensive Chronological Ledger Table</h3>
                <p className="text-xs text-slate-500">Chronological ledger log of all verified financial activities</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10px] font-extrabold text-white uppercase tracking-widest bg-blue-600 rounded-xl">
                      <th className="py-3 px-4 rounded-l-xl">Date</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4 text-right rounded-r-xl">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chronologicalTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-6 text-slate-400 font-bold text-xs">
                          No transaction records to display.
                        </td>
                      </tr>
                    ) : (
                      chronologicalTransactions.map((tx) => {
                        const isPositive = tx.amount >= 0;
                        return (
                          <tr key={tx.id} className="border-b border-slate-50 hover:bg-slate-50/40 transition-colors">
                            <td className="py-2.5 px-4 text-xxs font-bold text-slate-600 font-mono whitespace-nowrap">
                              {tx.date}
                            </td>
                            <td className="py-2.5 px-4 text-xs font-semibold text-slate-800 font-sans max-w-md truncate" title={tx.description}>
                              {tx.description}
                            </td>
                            <td className="py-2.5 px-4">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
                                {tx.category}
                              </span>
                            </td>
                            <td className={`py-2.5 px-4 text-xxs font-mono font-bold text-right whitespace-nowrap ${isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                              {isPositive ? "+" : ""}{formatCurrency(tx.amount)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* High-Fidelity Snapshot Export Modal (Ensures sandbox environment compatibility) */}
      {showImgPreviewModal && generatedImgUrl && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-4xl w-full max-h-[90vh] flex flex-col justify-between shadow-2xl relative">
            <button 
              onClick={() => setShowImgPreviewModal(false)}
              className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-4">
              <div className="inline-flex items-center space-x-1.5 text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full text-xxs font-extrabold uppercase mb-2">
                <ImageIcon className="w-4 h-4" />
                <span>Export Snapshot Prepared</span>
              </div>
              <h3 className="text-base font-extrabold text-slate-900">Your Clean Visual Report is Ready</h3>
              <p className="text-xs text-slate-500 mt-1">
                Since direct file triggers might be isolated by sandbox controls, you can right-click the preview below and select <span className="font-bold text-slate-800">"Save Image As..."</span> to export it!
              </p>
            </div>

            {/* Simulated scroll container displaying high quality base64 image */}
            <div className="flex-1 overflow-y-auto border border-slate-150 rounded-2xl bg-slate-50 p-4 mb-4 flex items-center justify-center">
              <img 
                src={generatedImgUrl} 
                alt="Generated Ledger Report" 
                className="max-w-full h-auto rounded-lg shadow-md border border-slate-200"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <p className="text-xxs text-slate-400 font-bold uppercase tracking-wider">
                Resolution: Super crisp Retina 2x JPEG Snapshot
              </p>
              <div className="flex space-x-3 w-full sm:w-auto">
                <button
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = generatedImgUrl;
                    link.download = `Report_${doc.filename.replace(/\.[^/.]+$/, "")}.jpg`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center space-x-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Retry Automatic Download</span>
                </button>
                <button
                  onClick={() => setShowImgPreviewModal(false)}
                  className="flex-1 sm:flex-none px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
