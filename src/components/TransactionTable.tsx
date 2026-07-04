import React, { useState, useMemo } from "react";
import { 
  Search, 
  Calendar, 
  ChevronDown, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  FileSpreadsheet,
  X 
} from "lucide-react";
import { Trade, Category } from "../types";

interface TransactionTableProps {
  transactions: Trade[];
  onExportCSV: () => void;
}

export const TransactionTable: React.FC<TransactionTableProps> = ({ transactions, onExportCSV }) => {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // New Per-Column Filter States
  const [showColFilters, setShowColFilters] = useState(false);
  const [colDate, setColDate] = useState("");
  const [colCategory, setColCategory] = useState("all");
  const [colDesc, setColDesc] = useState("");
  const [colAmountType, setColAmountType] = useState<"all" | "positive" | "negative">("all");

  // Filtering logic combining global and per-column filters
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      // 1. Global Search Query
      const matchesSearch =
        !search ||
        t.description.toLowerCase().includes(search.toLowerCase()) ||
        t.category.toLowerCase().includes(search.toLowerCase()) ||
        t.amount.toString().includes(search);

      // 2. Global Category Filter
      const matchesCategory = categoryFilter === "all" || t.category === categoryFilter;

      // 3. Global Date Range Filter
      let matchesDate = true;
      if (dateRange !== "all") {
        const txDate = new Date(t.date);
        const today = new Date();
        if (dateRange === "today") {
          matchesDate = txDate.toDateString() === today.toDateString();
        } else if (dateRange === "7days") {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(today.getDate() - 7);
          matchesDate = txDate >= sevenDaysAgo;
        } else if (dateRange === "30days") {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(today.getDate() - 30);
          matchesDate = txDate >= thirtyDaysAgo;
        } else if (dateRange === "year") {
          matchesDate = txDate.getFullYear() === today.getFullYear();
        }
      }

      // 4. Column Date Filter
      const matchesColDate = !colDate || t.date.toLowerCase().includes(colDate.toLowerCase());

      // 5. Column Category Filter
      const matchesColCategory = colCategory === "all" || t.category === colCategory;

      // 6. Column Description Filter
      const matchesColDesc = !colDesc || t.description.toLowerCase().includes(colDesc.toLowerCase());

      // 7. Column Amount Type Filter
      let matchesColAmount = true;
      if (colAmountType === "positive") {
        matchesColAmount = t.amount >= 0;
      } else if (colAmountType === "negative") {
        matchesColAmount = t.amount < 0;
      }

      return (
        matchesSearch && 
        matchesCategory && 
        matchesDate && 
        matchesColDate && 
        matchesColCategory && 
        matchesColDesc && 
        matchesColAmount
      );
    });
  }, [transactions, search, categoryFilter, dateRange, colDate, colCategory, colDesc, colAmountType]);

  // Pagination logic
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage) || 1;
  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredTransactions.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredTransactions, currentPage]);

  // Reset page when filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, categoryFilter, dateRange, colDate, colCategory, colDesc, colAmountType]);

  const isAnyFilterActive = 
    search || 
    categoryFilter !== "all" || 
    dateRange !== "all" || 
    colDate || 
    colCategory !== "all" || 
    colDesc || 
    colAmountType !== "all";

  const handleClearAllFilters = () => {
    setSearch("");
    setCategoryFilter("all");
    setDateRange("all");
    setColDate("");
    setColCategory("all");
    setColDesc("");
    setColAmountType("all");
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(val);
  };

  const getCategoryBadgeClass = (category: Category) => {
    switch (category) {
      case Category.Trading:
        return "bg-indigo-50 text-indigo-700 border-indigo-100";
      case Category.Income:
        return "bg-emerald-50 text-emerald-700 border-emerald-100";
      case Category.Expense:
        return "bg-rose-50 text-rose-700 border-rose-100";
      case Category.Transfer:
        return "bg-blue-50 text-blue-700 border-blue-100";
      default:
        return "bg-slate-50 text-slate-700 border-slate-100";
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-8">
      {/* Header and Controls */}
      <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-800">Transaction History</h3>
          <p className="text-xs text-slate-500">Search, filter, and review parsed ledger records</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Clear Filters Button */}
          {isAnyFilterActive && (
            <button
              onClick={handleClearAllFilters}
              className="inline-flex items-center space-x-1 px-3 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-100 rounded-xl text-xs font-semibold text-rose-700 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear Filters</span>
            </button>
          )}

          {/* Toggle Column Filters */}
          <button
            onClick={() => setShowColFilters(!showColFilters)}
            className={`inline-flex items-center space-x-1.5 px-3 py-2 border rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              showColFilters 
                ? "bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700" 
                : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600"
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>{showColFilters ? "Hide Column Filters" : "Column Filters"}</span>
          </button>

          {/* Export CSV button */}
          <button
            onClick={onExportCSV}
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filters bar */}
      <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-2.5 h-4.5 w-4.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search descriptions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl bg-white text-xs text-slate-800 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Category Filter */}
        <div className="relative">
          <Filter className="absolute left-3.5 top-2.5 h-4.5 w-4.5 text-slate-400" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full pl-10 pr-8 py-2 border border-slate-200 rounded-xl bg-white text-xs text-slate-800 appearance-none focus:outline-none focus:border-blue-500 transition-colors"
          >
            <option value="all">All Categories</option>
            {Object.values(Category).map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-3.5 pointer-events-none">
            <ChevronDown className="h-3 w-3 text-slate-500" />
          </div>
        </div>

        {/* Date Filter */}
        <div className="relative">
          <Calendar className="absolute left-3.5 top-2.5 h-4.5 w-4.5 text-slate-400" />
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="w-full pl-10 pr-8 py-2 border border-slate-200 rounded-xl bg-white text-xs text-slate-800 appearance-none focus:outline-none focus:border-blue-500 transition-colors"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
            <option value="year">This Year (2026)</option>
          </select>
          <div className="absolute right-3 top-3.5 pointer-events-none">
            <ChevronDown className="h-3 w-3 text-slate-500" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-blue-600 text-white text-xxs font-bold uppercase tracking-wider rounded-xl">
              <th className="py-3.5 px-6 rounded-l-xl">Date</th>
              <th className="py-3.5 px-6">Category</th>
              <th className="py-3.5 px-6">Description</th>
              <th className="py-3.5 px-6 text-right rounded-r-xl">Amount</th>
            </tr>
          </thead>
          <tbody>
            {/* Expanded Row of Column Filters if Toggled Active */}
            {showColFilters && (
              <tr className="bg-slate-50/60 border-b border-slate-100">
                {/* 1. Date filter input */}
                <th className="py-2.5 px-6">
                  <input
                    type="text"
                    placeholder="Filter date..."
                    value={colDate}
                    onChange={(e) => setColDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-xxs font-normal text-slate-800 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </th>
                {/* 2. Category filter select */}
                <th className="py-2.5 px-6">
                  <select
                    value={colCategory}
                    onChange={(e) => setColCategory(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded-lg bg-white text-xxs font-normal text-slate-800 focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    <option value="all">All Categories</option>
                    {Object.values(Category).map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </th>
                {/* 3. Description filter input */}
                <th className="py-2.5 px-6">
                  <input
                    type="text"
                    placeholder="Filter description..."
                    value={colDesc}
                    onChange={(e) => setColDesc(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-xxs font-normal text-slate-800 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </th>
                {/* 4. Amount filter select */}
                <th className="py-2.5 px-6 text-right">
                  <select
                    value={colAmountType}
                    onChange={(e) => setColAmountType(e.target.value as any)}
                    className="w-full max-w-[120px] ml-auto px-2 py-1.5 border border-slate-200 rounded-lg bg-white text-xxs font-normal text-slate-800 focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    <option value="all">All Amounts</option>
                    <option value="positive">Inflows (+)</option>
                    <option value="negative">Outflows (-)</option>
                  </select>
                </th>
              </tr>
            )}

            {paginatedTransactions.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-10 text-slate-400 font-medium">
                  No matching transaction records found. Try modifying your filter settings.
                </td>
              </tr>
            ) : (
              paginatedTransactions.map((t) => {
                const isPositive = t.amount >= 0;
                return (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6 font-medium text-slate-600">
                      {t.date}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xxs font-bold border ${getCategoryBadgeClass(t.category)}`}>
                        {t.category}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-800 max-w-xs truncate" title={t.description}>
                      {t.description}
                    </td>
                    <td className={`py-4 px-6 text-right font-mono font-bold ${isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                      {isPositive ? "+" : ""}{formatCurrency(t.amount)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xxs text-slate-400 font-bold uppercase">
            Showing {paginatedTransactions.length} of {filteredTransactions.length} records
          </span>
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 border border-slate-200 rounded-lg bg-white text-slate-600 disabled:opacity-40 disabled:hover:bg-white hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-slate-600 font-bold px-2">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 border border-slate-200 rounded-lg bg-white text-slate-600 disabled:opacity-40 disabled:hover:bg-white hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
