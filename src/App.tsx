import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  TrendingUp, 
  RefreshCw, 
  Layers, 
  FileText, 
  CheckCircle2, 
  Download, 
  HelpCircle, 
  X, 
  LogOut, 
  Eye, 
  Trash2, 
  AlertTriangle 
} from "lucide-react";
import { Trade, DocumentRecord, DashboardData } from "./types";
import { SummaryCards } from "./components/SummaryCards";
import { MonthlyChart } from "./components/MonthlyChart";
import { CategoryChart } from "./components/CategoryChart";
import { TransactionTable } from "./components/TransactionTable";
import { DocumentManager } from "./components/DocumentManager";
import { Auth } from "./components/Auth";
import { ReportScreen } from "./components/ReportScreen";

export default function App() {
  const [sessionToken, setSessionToken] = useState<string | null>(localStorage.getItem("auto_journal_session"));
  const [username, setUsername] = useState<string | null>(localStorage.getItem("auto_journal_username"));
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  
  // Custom states for 10/10 Report and Confirmation Modal
  const [viewingReportDocId, setViewingReportDocId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    onConfirm: () => void;
  } | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState({
    type: "idle" as "idle" | "loading" | "success" | "error",
    heading: "",
    details: "",
    percent: 0,
  });

  // 1. Fetch dashboard data
  const fetchDashboard = async (docId?: string) => {
    if (!sessionToken) return;
    try {
      setLoading(true);
      const url = docId && docId !== "all" ? `/api/dashboard?documentId=${docId}` : "/api/dashboard";
      const res = await fetch(url, {
        headers: {
          "x-session-token": sessionToken,
        },
      });
      if (res.status === 401) {
        // Session expired or invalid
        handleLogOut();
        return;
      }
      if (!res.ok) throw new Error("Failed to load dashboard data");
      const data = await res.json();
      setDashboardData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionToken) {
      fetchDashboard(selectedDocId);
    }
  }, [selectedDocId, sessionToken]);

  // Handle Login Success
  const handleLoginSuccess = (token: string, user: string) => {
    setSessionToken(token);
    setUsername(user);
  };

  // Handle Sign Out
  const handleLogOut = () => {
    localStorage.removeItem("auto_journal_session");
    localStorage.removeItem("auto_journal_username");
    setSessionToken(null);
    setUsername(null);
    setDashboardData(null);
    setSelectedDocId("all");
    setViewingReportDocId(null);
  };

  // 2. Handle File Upload (directly from Web Dashboard)
  const handleFileUpload = async (file: File) => {
    if (!sessionToken) return;
    const fileExt = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    const allowedExtensions = [".pdf", ".csv", ".xlsx", ".xls", ".txt", ".docx"];
    if (!allowedExtensions.includes(fileExt)) {
      setUploadStatus({
        type: "error",
        heading: "Invalid File Format",
        details: "Please upload PDF, CSV, Excel, Word (.docx) or Text statement files only.",
        percent: 0,
      });
      return;
    }

    const maxSize = 12 * 1024 * 1024; // 12MB
    if (file.size > maxSize) {
      setUploadStatus({
        type: "error",
        heading: "File Too Large",
        details: "Auto Journal supports statement files up to 12MB.",
        percent: 0,
      });
      return;
    }

    try {
      setIsUploading(true);
      setUploadStatus({
        type: "loading",
        heading: "Processing Document...",
        details: `Converting ${file.name} to binary...`,
        percent: 15,
      });

      // Convert file to Base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result?.toString().split(",")[1];
        if (!base64Data) {
          throw new Error("Failed to encode file data to base64");
        }

        setUploadStatus({
          type: "loading",
          heading: "Extracting ledger contents...",
          details: "Analyzing transaction rows, columns, dates, and category details...",
          percent: 55,
        });

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "x-session-token": sessionToken
          },
          body: JSON.stringify({
            filename: file.name,
            fileData: base64Data,
          }),
        });

        const uploadResult = await uploadRes.json();

        if (uploadRes.ok && uploadResult.success) {
          setUploadStatus({
            type: "success",
            heading: "Document Processed!",
            details: `${file.name} successfully parsed and categorized into your private ledger.`,
            percent: 100,
          });
          // Automatically focus the newly uploaded document
          setSelectedDocId(uploadResult.document.id);
          // Set to view the report immediately
          setViewingReportDocId(uploadResult.document.id);
          // Re-fetch
          fetchDashboard(uploadResult.document.id);
        } else {
          setUploadStatus({
            type: "error",
            heading: "Extraction Failed",
            details: uploadResult.error || "Unable to recognize tabular ledger columns in this file.",
            percent: 0,
          });
        }
        setIsUploading(false);
      };

      reader.onerror = () => {
        throw new Error("Failed to read file from disk");
      };

      reader.readAsDataURL(file);
    } catch (e: any) {
      console.error(e);
      setUploadStatus({
        type: "error",
        heading: "Processing Error",
        details: e.message || "An unexpected error occurred during extraction.",
        percent: 0,
      });
      setIsUploading(false);
    }
  };

  // 3. Delete individual document with Custom Confirmation Modal
  const handleDeleteDoc = (id: string) => {
    setConfirmModal({
      title: "Delete Document Record",
      message: "Are you sure you want to permanently delete this document and all its parsed transactions? This action cannot be undone.",
      confirmText: "Delete Record",
      cancelText: "Keep Document",
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/documents/${id}`, { 
            method: "DELETE",
            headers: {
              "x-session-token": sessionToken || ""
            }
          });
          if (res.ok) {
            if (selectedDocId === id) {
              setSelectedDocId("all");
            } else {
              fetchDashboard(selectedDocId);
            }
          }
        } catch (e) {
          console.error(e);
        }
        setConfirmModal(null);
      }
    });
  };

  // 4. Reset/Clear entire database with Custom Confirmation Modal
  const handleResetDB = () => {
    setConfirmModal({
      title: "Reset Private Ledger",
      message: "CRITICAL WARNING: This will delete ALL documents and ALL transaction records from your private database. This action is completely irreversible. Proceed?",
      confirmText: "Clear All Data",
      cancelText: "Keep My Data",
      onConfirm: async () => {
        try {
          const res = await fetch("/api/reset", { 
            method: "POST",
            headers: {
              "x-session-token": sessionToken || ""
            }
          });
          if (res.ok) {
            setSelectedDocId("all");
            fetchDashboard("all");
          }
        } catch (e) {
          console.error(e);
        }
        setConfirmModal(null);
      }
    });
  };

  // 5. Export filtered report as CSV
  const handleExportCSV = () => {
    if (!sessionToken) return;
    const reportUrl = selectedDocId && selectedDocId !== "all" 
      ? `/api/report?documentId=${selectedDocId}&token=${sessionToken}` 
      : `/api/report?token=${sessionToken}`;
    window.open(reportUrl, "_blank");
  };

  // If not authenticated, show elegant Auth Page
  if (!sessionToken) {
    return <Auth onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased font-sans flex flex-col justify-between">
      {/* Top Banner Header */}
      <header className="sticky top-0 z-10 backdrop-blur-md bg-white/85 border-b border-slate-100 shadow-sm px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-100">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">
                Auto Journal
              </h1>
              <p className="text-xxs text-slate-500 font-medium">Universal Document Ledger & Statement Analysis</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* User welcome message */}
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl hidden sm:inline">
              Session: <span className="text-blue-600 font-extrabold">{username}</span>
            </span>

            {/* Refresh button */}
            <button
              onClick={() => fetchDashboard(selectedDocId)}
              disabled={loading}
              className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-600 transition-colors shadow-sm cursor-pointer"
              title="Refresh ledger state"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>

            {/* Sign Out button */}
            <button
              onClick={handleLogOut}
              className="p-2 bg-rose-50 hover:bg-rose-100 border border-rose-100 rounded-xl text-rose-600 transition-colors shadow-sm cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="max-w-7xl w-full mx-auto p-6 flex-1">
        {/* Loading overlay for data refreshing */}
        {loading && !dashboardData && (
          <div className="flex flex-col items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-3" />
            <p className="text-xs font-bold text-slate-500">Retrieving ledger details...</p>
          </div>
        )}

        {dashboardData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {/* If no documents are uploaded, show beautiful landing state with direct upload center */}
            {dashboardData.documents.length === 0 ? (
              <div className="max-w-4xl mx-auto py-10">
                <div className="text-center mb-10">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 mb-4 shadow-sm">
                    <TrendingUp className="w-8 h-8" />
                  </div>
                  <h2 className="text-3xl font-extrabold text-slate-950 tracking-tight mb-3">
                    Your Private Ledger is Empty
                  </h2>
                  <p className="text-sm text-slate-600 max-w-xl mx-auto leading-relaxed">
                    Instantly convert any lists, logs, statements, PDFs, CSVs, Word documents (.docx), or Excel spreadsheets into a clean, categorized transaction ledger.
                  </p>
                </div>

                <div className="bg-white border border-slate-100 rounded-3xl p-6 md:p-8 shadow-sm">
                  <DocumentManager
                    documents={dashboardData.documents}
                    selectedDocId={selectedDocId}
                    onSelectDoc={setSelectedDocId}
                    onDeleteDoc={handleDeleteDoc}
                    onResetDB={handleResetDB}
                    onFileUpload={handleFileUpload}
                    isUploading={isUploading}
                    uploadStatus={uploadStatus}
                    onViewReport={(id) => setViewingReportDocId(id)}
                  />
                </div>
              </div>
            ) : (
              // If documents exist, show full powerful visual dashboard
              <>
                {/* Document Selector & Direct Upload Control strip */}
                <DocumentManager
                  documents={dashboardData.documents}
                  selectedDocId={selectedDocId}
                  onSelectDoc={setSelectedDocId}
                  onDeleteDoc={handleDeleteDoc}
                  onResetDB={handleResetDB}
                  onFileUpload={handleFileUpload}
                  isUploading={isUploading}
                  uploadStatus={uploadStatus}
                  onViewReport={(id) => setViewingReportDocId(id)}
                />

                {/* Banner alert when a specific document is active to trigger the 10/10 Report Screen */}
                {selectedDocId !== "all" && (
                  <div className="mb-6 bg-blue-50/50 border border-blue-100 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center space-x-3 text-blue-800">
                      <div className="p-2 bg-blue-100 rounded-xl shrink-0">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold">Comprehensive Analysis Ready</h4>
                        <p className="text-xxs text-blue-600 font-medium">
                          Interactive 10/10 detailed visualization screen is compiled for:{" "}
                          <span className="font-extrabold text-blue-900">
                            {dashboardData.documents.find(d => d.id === selectedDocId)?.filename || "Active Document"}
                          </span>
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setViewingReportDocId(selectedDocId)}
                      className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer shrink-0"
                    >
                      <Eye className="w-4 h-4" />
                      <span>Open Clean Report Screen (JPG Export)</span>
                    </button>
                  </div>
                )}

                {/* Summary Cards */}
                <SummaryCards
                  summary={dashboardData.summary}
                  winRate={dashboardData.win_rate}
                />

                {/* Charts Section Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                  {/* Bar Chart (Monthly Performance) */}
                  <div className="lg:col-span-2">
                    <MonthlyChart monthlyData={dashboardData.monthly} />
                  </div>

                  {/* Pie Chart (Category Distribution) */}
                  <div className="lg:col-span-1">
                    <CategoryChart categoriesData={dashboardData.categories} />
                  </div>
                </div>

                {/* Interactive Transaction History Table */}
                <TransactionTable
                  transactions={dashboardData.transactions}
                  onExportCSV={handleExportCSV}
                />
              </>
            )}
          </motion.div>
        )}
      </main>

      {/* Footer credit branding */}
      <footer className="border-t border-slate-100 bg-white py-4 px-6 text-center">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xxs text-slate-400 font-semibold uppercase tracking-wider">
            Auto Journal © 2026 • Universal Document Ledger Platform
          </p>
        </div>
      </footer>

      {/* Render 10/10 Detailed Report View Screen */}
      <AnimatePresence>
        {viewingReportDocId && dashboardData && (() => {
          const doc = dashboardData.documents.find(d => d.id === viewingReportDocId);
          // Show transactions related to this document
          const txs = dashboardData.transactions.filter(t => t.documentId === viewingReportDocId);
          if (doc) {
            return (
              <ReportScreen
                document={doc}
                transactions={txs}
                onClose={() => setViewingReportDocId(null)}
              />
            );
          }
          return null;
        })()}
      </AnimatePresence>

      {/* Custom Confirmation Modal (Bypasses window.confirm iframe restriction) */}
      <AnimatePresence>
        {confirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xl max-w-sm w-full"
            >
              <div className="flex items-center space-x-3 text-rose-600 mb-4">
                <div className="p-2 bg-rose-50 rounded-xl">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">{confirmModal.title}</h3>
              </div>
              
              <p className="text-xs text-slate-600 font-semibold leading-relaxed mb-6">
                {confirmModal.message}
              </p>

              <div className="flex space-x-3 justify-end">
                <button
                  onClick={() => setConfirmModal(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                >
                  {confirmModal.cancelText}
                </button>
                <button
                  onClick={confirmModal.onConfirm}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  {confirmModal.confirmText}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
