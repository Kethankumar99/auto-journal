import React from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface CategoryChartProps {
  categoriesData: Record<string, number>;
}

export const CategoryChart: React.FC<CategoryChartProps> = ({ categoriesData }) => {
  // Convert Record<string, number> to array for Recharts
  const data = Object.entries(categoriesData)
    .filter(([_, value]) => (value as number) > 0)
    .map(([key, value]) => ({
      name: key,
      value: value as number,
    }));

  const COLORS: Record<string, string> = {
    Trading: "#6366f1", // Indigo
    Income: "#10b981",  // Emerald
    Expense: "#f43f5e", // Rose
    Transfer: "#3b82f6", // Blue
    Other: "#64748b",    // Slate
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between">
      <div>
        <h3 className="text-base font-bold text-slate-800">Category Distribution</h3>
        <p className="text-xs text-slate-500">Breakdown of absolute cash flow by transaction category</p>
      </div>

      <div className="h-60 w-full my-4 relative flex items-center justify-center">
        {data.length === 0 ? (
          <div className="text-center text-slate-400 text-xs py-10">
            No data available for selected document.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[entry.name] || COLORS.Other} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const entry = payload[0];
                    return (
                      <div className="bg-slate-900 text-white p-2.5 rounded-lg shadow-lg border border-slate-800 text-xs font-medium">
                        <p className="flex items-center space-x-2">
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: COLORS[entry.name] || COLORS.Other }}
                          ></span>
                          <span>{entry.name}:</span>
                          <span className="font-bold">{formatCurrency(entry.value as number)}</span>
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Custom Legend for control and custom design */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {Object.keys(COLORS).map((cat) => {
          const val = categoriesData[cat] || 0;
          if (val === 0) return null;
          return (
            <div key={cat} className="flex items-center space-x-2 text-slate-600">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: COLORS[cat] }}
              ></span>
              <span className="font-medium truncate">{cat}:</span>
              <span className="font-bold text-slate-800 shrink-0">{formatCurrency(val)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
