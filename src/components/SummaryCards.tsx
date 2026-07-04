import React from "react";
import { ArrowUpRight, ArrowDownRight, DollarSign, Percent, TrendingUp } from "lucide-react";
import { DocumentSummary } from "../types";

interface SummaryCardsProps {
  summary: DocumentSummary;
  winRate: number;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ summary, winRate }) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const isNetPositive = summary.net_pl >= 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
      {/* Total Income Card */}
      <div id="card-income" className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-slate-500">Total Income</span>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>
        <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
          {formatCurrency(summary.total_income)}
        </h3>
        <p className="text-xs text-emerald-600 font-medium mt-1">
          + All deposit & revenue transactions
        </p>
      </div>

      {/* Total Expenses Card */}
      <div id="card-expenses" className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-slate-500">Total Expenses</span>
          <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
            <ArrowDownRight className="w-5 h-5" />
          </div>
        </div>
        <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
          {formatCurrency(summary.total_expenses)}
        </h3>
        <p className="text-xs text-rose-600 font-medium mt-1">
          - Outflow, charges & trading losses
        </p>
      </div>

      {/* Net P&L Card */}
      <div id="card-net-pl" className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-slate-500">Net Profit / Loss</span>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isNetPositive ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"}`}>
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
        <h3 className={`text-2xl font-bold tracking-tight ${isNetPositive ? "text-blue-600" : "text-amber-600"}`}>
          {isNetPositive ? "" : "-"}{formatCurrency(Math.abs(summary.net_pl))}
        </h3>
        <p className="text-xs text-slate-500 font-medium mt-1">
          {isNetPositive ? "Overall positive cash balance" : "Net negative balance in selected filter"}
        </p>
      </div>

      {/* Win Rate Card */}
      <div id="card-win-rate" className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-slate-500">Trading Win Rate</span>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Percent className="w-5 h-5" />
          </div>
        </div>
        <h3 className="text-2xl font-bold text-indigo-600 tracking-tight">
          {winRate > 0 ? `${winRate}%` : "N/A"}
        </h3>
        <p className="text-xs text-indigo-500 font-medium mt-1">
          {winRate > 0 ? "Percentage of profitable trades" : "No trading transactions found"}
        </p>
      </div>
    </div>
  );
};
