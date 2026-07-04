import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface MonthlyChartProps {
  monthlyData: Record<string, number>;
}

export const MonthlyChart: React.FC<MonthlyChartProps> = ({ monthlyData }) => {
  // Convert Record<string, number> to array for Recharts
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
  const chartData = months.map((month) => ({
    name: month,
    "P&L": monthlyData[month] || 0,
  }));

  // Custom tool-tip formatter
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-bold text-slate-800">Monthly Performance & Trends</h3>
        <p className="text-xs text-slate-500">Net monthly balance (Income - Expense) over the calendar year</p>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#64748b", fontSize: 11 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#64748b", fontSize: 11 }}
              tickFormatter={(val) => (val >= 0 ? `$${val}` : `-$${Math.abs(val)}`)}
            />
            <Tooltip
              cursor={{ fill: "#f8fafc" }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const val = payload[0].value as number;
                  return (
                    <div className="bg-slate-900 text-white p-3 rounded-lg shadow-lg border border-slate-800 text-xs">
                      <p className="font-semibold">{payload[0].payload.name}</p>
                      <p className={`font-bold mt-1 ${val >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {formatCurrency(val)}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <ReferenceLine y={0} stroke="#cbd5e1" strokeDasharray="3 3" />
            <Bar
              dataKey="P&L"
              radius={[4, 4, 0, 0]}
              fill="#2563eb"
              // Dynamic coloring: positive = emerald, negative = rose
              cell={({ name }) => {
                const val = monthlyData[name] || 0;
                return {
                  fill: val >= 0 ? "#10b981" : "#f43f5e",
                };
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
