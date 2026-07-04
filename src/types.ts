export enum Category {
  Trading = "Trading",
  Income = "Income",
  Expense = "Expense",
  Transfer = "Transfer",
  Other = "Other",
}

export interface Trade {
  id: number;
  date: string;
  amount: number;
  category: Category;
  description: string;
  uploaded_at: string;
  documentId: string;
  userId?: string;
}

export interface DocumentSummary {
  total_income: number;
  total_expenses: number;
  net_pl: number;
}

export interface DocumentRecord {
  id: string;
  filename: string;
  uploaded_at: string;
  summary: DocumentSummary;
  monthly: Record<string, number>;
  categories: Record<string, number>;
  win_rate: number;
  userId?: string;
}

export interface DashboardData {
  transactions: Trade[];
  summary: DocumentSummary;
  monthly: Record<string, number>;
  categories: Record<string, number>;
  win_rate: number;
  documents: DocumentRecord[];
}
