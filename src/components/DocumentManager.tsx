import React, { useState } from "react";
import { FileText, Trash2, Database, Upload, RefreshCw, CheckCircle, AlertTriangle, Eye } from "lucide-react";
import { DocumentRecord } from "../types";

interface DocumentManagerProps {
  documents: DocumentRecord[];
  selectedDocId: string;
  onSelectDoc: (id: string) => void;
  onDeleteDoc: (id: string) => void;
  onResetDB: () => void;
  onFileUpload: (file: File) => Promise<void>;
  isUploading: boolean;
  uploadStatus: { heading: string; details: string; percent: number; type: "idle" | "loading" | "success" | "error" };
  onViewReport?: (id: string) => void;
}

export const DocumentManager: React.FC<DocumentManagerProps> = ({
  documents,
  selectedDocId,
  onSelectDoc,
  onDeleteDoc,
  onResetDB,
  onFileUpload,
  isUploading,
  uploadStatus,
  onViewReport,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Drag handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await onFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      await onFileUpload(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      {/* 1. File Upload / Drag Box */}
      <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-800">Analyze Document Statement</h3>
          <p className="text-xs text-slate-500 mb-4">Upload PDF, Excel, CSV, Word, or Text files to extract ledger transactions</p>
        </div>

        {/* Upload Drop Zone */}
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={onButtonClick}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            dragActive ? "border-blue-500 bg-blue-50/40" : "border-slate-200 hover:border-blue-400 bg-slate-50/20"
          } ${isUploading ? "pointer-events-none opacity-80" : ""}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf, .csv, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, text/plain, .docx, application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="flex flex-col items-center">
            <Upload className="w-8 h-8 text-slate-400 mb-2" />
            <p className="text-xs font-bold text-slate-700">Drag & Drop Statement File Here</p>
            <p className="text-xxs text-slate-400 mt-0.5">or click to browse files</p>
            <p className="text-xxs text-slate-400 mt-2 bg-slate-100 px-2 py-0.5 rounded font-medium">Max 12MB</p>
          </div>
        </div>

        {/* Upload Progress details */}
        {uploadStatus.type !== "idle" && (
          <div className="mt-4 p-3 rounded-xl border border-slate-100 bg-slate-50/50">
            <div className="flex items-center space-x-2">
              {uploadStatus.type === "loading" && <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />}
              {uploadStatus.type === "success" && <CheckCircle className="w-4 h-4 text-emerald-500" />}
              {uploadStatus.type === "error" && <AlertTriangle className="w-4 h-4 text-rose-500" />}
              
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{uploadStatus.heading}</p>
                <p className="text-xxs text-slate-500 truncate">{uploadStatus.details}</p>
              </div>
            </div>
            
            {uploadStatus.type === "loading" && (
              <div className="mt-2.5">
                <div className="w-full bg-slate-100 rounded-full h-1">
                  <div className="bg-blue-500 h-1 rounded-full transition-all duration-300" style={{ width: `${uploadStatus.percent}%` }}></div>
                </div>
                <p className="text-right text-xxs text-slate-400 font-semibold mt-1">{uploadStatus.percent}%</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Uploaded Document List */}
      <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-bold text-slate-800">Your Documents</h3>
            <button
              onClick={onResetDB}
              className="inline-flex items-center space-x-1 px-2.5 py-1 text-slate-500 hover:text-rose-600 border border-slate-200 rounded-lg text-xxs font-bold hover:bg-rose-50 transition-colors"
              title="Delete all data and start over"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Clear Database</span>
            </button>
          </div>
          <p className="text-xs text-slate-500 mb-4">Select an active statement below to filter the analytics dashboard</p>
        </div>

        {/* List scrollbox */}
        <div className="flex-1 overflow-y-auto max-h-48 space-y-2 pr-1">
          {documents.length === 0 ? (
            <div className="text-center text-xs text-slate-400 py-10">
              No parsed financial documents in the database. Upload one above or via the Chrome Extension to get started.
            </div>
          ) : (
            <>
              {/* Aggregated All Documents option */}
              <div
                onClick={() => onSelectDoc("all")}
                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                  selectedDocId === "all" || !selectedDocId
                    ? "border-blue-500 bg-blue-50/20 ring-1 ring-blue-500"
                    : "border-slate-100 hover:border-slate-200 bg-slate-50/30"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">All Consolidated Documents</h4>
                    <p className="text-xxs text-slate-500">Aggregates performance across {documents.length} sources</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-800">
                    {formatCurrency(documents.reduce((acc, d) => acc + d.summary.net_pl, 0))}
                  </p>
                  <p className="text-xxs text-slate-400 font-semibold uppercase">Net Gain</p>
                </div>
              </div>

              {/* Individual documents */}
              {documents.map((doc) => {
                const isSelected = selectedDocId === doc.id;
                const isDocNetPositive = doc.summary.net_pl >= 0;
                return (
                  <div
                    key={doc.id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      isSelected
                        ? "border-blue-500 bg-blue-50/20 ring-1 ring-blue-500"
                        : "border-slate-100 hover:border-slate-200 bg-white"
                    }`}
                  >
                    <div
                      onClick={() => onSelectDoc(doc.id)}
                      className="flex-1 flex items-center space-x-3 cursor-pointer min-w-0"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"}`}>
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-800 truncate" title={doc.filename}>
                          {doc.filename}
                        </h4>
                        <p className="text-xxs text-slate-500">
                          Uploaded on {new Date(doc.uploaded_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4 pl-3 shrink-0">
                      <div className="text-right">
                        <p className={`text-xs font-bold ${isDocNetPositive ? "text-emerald-600" : "text-rose-600"}`}>
                          {isDocNetPositive ? "+" : ""}{formatCurrency(doc.summary.net_pl)}
                        </p>
                        <p className="text-xxs text-slate-400 font-semibold uppercase">P&L</p>
                      </div>

                      {/* View Report button */}
                      {onViewReport && (
                        <button
                          onClick={() => onViewReport(doc.id)}
                          className="p-1.5 hover:bg-blue-50 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"
                          title="Open Interactive Report Screen"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}

                      {/* Delete button */}
                      <button
                        onClick={() => onDeleteDoc(doc.id)}
                        className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-500 transition-colors"
                        title="Delete document and related transactions"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
