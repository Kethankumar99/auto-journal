import fs from "fs";
import path from "path";
import initSqlJs, { Database as SqlJsDatabase } from "sql.js";
import { Trade, DocumentRecord, Category, DashboardData } from "./types";

export interface User {
  id: string;
  username: string;
}

export class Database {
  private static dbInstance: SqlJsDatabase | null = null;
  private static initPromise: Promise<SqlJsDatabase> | null = null;

  private static async getDB(): Promise<SqlJsDatabase> {
    if (this.dbInstance) return this.dbInstance;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const SQL = await initSqlJs();
        let db: SqlJsDatabase;

        const cwdPath = path.join(process.cwd(), "auto_journal.sqlite");
        const tmpPath = path.join("/tmp", "auto_journal.sqlite");

        if (fs.existsSync(cwdPath)) {
          try {
            const fileBuffer = fs.readFileSync(cwdPath);
            db = new SQL.Database(fileBuffer);
          } catch (e) {
            db = new SQL.Database();
          }
        } else if (fs.existsSync(tmpPath)) {
          try {
            const fileBuffer = fs.readFileSync(tmpPath);
            db = new SQL.Database(fileBuffer);
          } catch (e) {
            db = new SQL.Database();
          }
        } else {
          db = new SQL.Database();
        }

        // Initialize SQLite schema
        db.run(`
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE,
            password_hash TEXT
          );
          CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id TEXT
          );
          CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            filename TEXT,
            uploaded_at TEXT,
            summary_json TEXT,
            monthly_json TEXT,
            categories_json TEXT,
            win_rate REAL
          );
          CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY,
            user_id TEXT,
            date TEXT,
            amount REAL,
            category TEXT,
            description TEXT,
            uploaded_at TEXT,
            document_id TEXT
          );
        `);

        // Migrate any existing JSON data into SQLite tables if users table is empty
        const res = db.exec("SELECT COUNT(*) FROM users");
        const cnt = res[0]?.values?.[0]?.[0] || 0;
        if (cnt === 0) {
          const oldJsonPath = path.join(process.cwd(), "trading_db.json");
          const tmpJsonPath = path.join("/tmp", "trading_db.json");
          let oldState: any = null;
          if (fs.existsSync(oldJsonPath)) {
            try { oldState = JSON.parse(fs.readFileSync(oldJsonPath, "utf-8")); } catch (e) {}
          } else if (fs.existsSync(tmpJsonPath)) {
            try { oldState = JSON.parse(fs.readFileSync(tmpJsonPath, "utf-8")); } catch (e) {}
          }
          if (oldState && Array.isArray(oldState.users) && oldState.users.length > 0) {
            for (const u of oldState.users) {
              db.run("INSERT OR IGNORE INTO users (id, username, password_hash) VALUES (?, ?, ?)", [u.id, u.username, u.passwordHash]);
            }
            if (oldState.sessions) {
              for (const [t, uid] of Object.entries(oldState.sessions)) {
                db.run("INSERT OR REPLACE INTO sessions (token, user_id) VALUES (?, ?)", [t, String(uid)]);
              }
            }
            if (Array.isArray(oldState.documents)) {
              for (const d of oldState.documents) {
                db.run("INSERT OR REPLACE INTO documents (id, user_id, filename, uploaded_at, summary_json, monthly_json, categories_json, win_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
                  d.id, d.userId, d.filename, d.uploaded_at, JSON.stringify(d.summary), JSON.stringify(d.monthly), JSON.stringify(d.categories), d.win_rate || 0
                ]);
              }
            }
            if (Array.isArray(oldState.transactions)) {
              for (const tx of oldState.transactions) {
                db.run("INSERT OR REPLACE INTO transactions (id, user_id, date, amount, category, description, uploaded_at, document_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
                  tx.id, tx.userId, tx.date, tx.amount, tx.category, tx.description, tx.uploaded_at, tx.documentId
                ]);
              }
            }
            this.saveToFile(db);
          }
        }

        this.dbInstance = db;
        return db;
      } catch (e) {
        console.error("Failed to initialize sql.js SQLite database:", e);
        throw e;
      }
    })();

    return this.initPromise;
  }

  private static saveToFile(db: SqlJsDatabase): void {
    try {
      const data = db.export();
      const buffer = Buffer.from(data);

      try {
        const cwdPath = path.join(process.cwd(), "auto_journal.sqlite");
        fs.writeFileSync(cwdPath, buffer);
      } catch (e) {
        // Read-only filesystem in serverless container
      }

      try {
        const tmpPath = path.join("/tmp", "auto_journal.sqlite");
        fs.writeFileSync(tmpPath, buffer);
      } catch (e) {
        // Ignore
      }
    } catch (e) {
      console.error("Error saving SQLite database file:", e);
    }
  }

  public static async registerUser(username: string, password: string) {
    const db = await this.getDB();
    const cleanUsername = username.trim();
    if (!cleanUsername || !password) {
      return { success: false, error: "Username and password are required" };
    }

    const checkRes = db.exec("SELECT id FROM users WHERE LOWER(username) = LOWER(?)", [cleanUsername]);
    if (checkRes.length > 0 && checkRes[0].values.length > 0) {
      return { success: false, error: "Username is already taken" };
    }

    const userId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const passwordHash = Buffer.from(password).toString("base64");

    db.run("INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)", [userId, cleanUsername, passwordHash]);

    const token = `token-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    db.run("INSERT INTO sessions (token, user_id) VALUES (?, ?)", [token, userId]);

    this.saveToFile(db);
    return { success: true, token, user: { id: userId, username: cleanUsername } };
  }

  public static async loginUser(username: string, password: string) {
    const db = await this.getDB();
    const cleanUsername = username.trim();
    const passwordHash = Buffer.from(password).toString("base64");

    const res = db.exec("SELECT id, username FROM users WHERE LOWER(username) = LOWER(?) AND password_hash = ?", [cleanUsername, passwordHash]);
    if (res.length === 0 || res[0].values.length === 0) {
      return { success: false, error: "Invalid username or password" };
    }

    const userId = String(res[0].values[0][0]);
    const actualUsername = String(res[0].values[0][1]);

    const token = `token-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    db.run("INSERT INTO sessions (token, user_id) VALUES (?, ?)", [token, userId]);

    this.saveToFile(db);
    return { success: true, token, user: { id: userId, username: actualUsername } };
  }

  public static async getUserByToken(token: string) {
    const db = await this.getDB();
    const res = db.exec(`
      SELECT u.id, u.username
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ?
    `, [token]);

    if (res.length === 0 || res[0].values.length === 0) {
      return null;
    }

    return { id: String(res[0].values[0][0]), username: String(res[0].values[0][1]) };
  }

  public static async getDashboardData(userId: string, documentId?: string): Promise<DashboardData> {
    const db = await this.getDB();

    const docsRes = db.exec("SELECT id, filename, uploaded_at, summary_json, monthly_json, categories_json, win_rate FROM documents WHERE user_id = ? ORDER BY uploaded_at DESC", [userId]);
    const userDocuments: (DocumentRecord & { userId: string })[] = [];
    if (docsRes.length > 0) {
      for (const row of docsRes[0].values) {
        userDocuments.push({
          id: String(row[0]),
          userId,
          filename: String(row[1]),
          uploaded_at: String(row[2]),
          summary: JSON.parse(String(row[3])),
          monthly: JSON.parse(String(row[4])),
          categories: JSON.parse(String(row[5])),
          win_rate: Number(row[6])
        });
      }
    }

    let query = "SELECT id, date, amount, category, description, uploaded_at, document_id FROM transactions WHERE user_id = ?";
    const params: any[] = [userId];
    if (documentId && documentId !== "all") {
      query += " AND document_id = ?";
      params.push(documentId);
    }
    query += " ORDER BY date DESC, id DESC";

    const txRes = db.exec(query, params);
    const filteredTransactions: (Trade & { userId: string })[] = [];
    if (txRes.length > 0) {
      for (const row of txRes[0].values) {
        filteredTransactions.push({
          id: Number(row[0]),
          userId,
          date: String(row[1]),
          amount: Number(row[2]),
          category: (String(row[3]) as Category) || Category.Other,
          description: String(row[4]),
          uploaded_at: String(row[5]),
          documentId: String(row[6])
        });
      }
    }

    let total_income = 0;
    let total_expenses = 0;
    const categories: Record<string, number> = {};
    const monthly: Record<string, number> = {
      Jan: 0, Feb: 0, Mar: 0, Apr: 0, May: 0, Jun: 0,
      Jul: 0, Aug: 0, Sep: 0, Oct: 0, Nov: 0, Dec: 0
    };
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let tradingWins = 0;
    let tradingTotal = 0;

    for (const tx of filteredTransactions) {
      if (tx.amount > 0) {
        total_income += tx.amount;
      } else {
        total_expenses += Math.abs(tx.amount);
      }

      categories[tx.category] = (categories[tx.category] || 0) + Math.abs(tx.amount);

      const txDate = new Date(tx.date);
      if (!isNaN(txDate.getTime())) {
        const monthName = monthNames[txDate.getMonth()];
        monthly[monthName] = (monthly[monthName] || 0) + tx.amount;
      }

      if (tx.category === Category.Trading) {
        tradingTotal++;
        if (tx.amount > 0) {
          tradingWins++;
        }
      }
    }

    const net_pl = total_income - total_expenses;
    const win_rate = tradingTotal > 0 ? Number(((tradingWins / tradingTotal) * 100).toFixed(1)) : 0;

    return {
      transactions: filteredTransactions,
      summary: { total_income, total_expenses, net_pl },
      monthly,
      categories,
      win_rate: documentId && documentId !== "all"
        ? (userDocuments.find(d => d.id === documentId)?.win_rate ?? win_rate)
        : (tradingTotal > 0 ? win_rate : (userDocuments[0]?.win_rate ?? 0)),
      documents: userDocuments
    };
  }

  public static async addDocument(userId: string, filename: string, extracted: any): Promise<DocumentRecord> {
    const db = await this.getDB();
    const docId = `doc-${Date.now()}`;
    const uploadedAt = new Date().toISOString();

    const summary = {
      total_income: Number(extracted.summary?.total_income || 0),
      total_expenses: Number(extracted.summary?.total_expenses || 0),
      net_pl: Number(extracted.summary?.net_pl || 0),
    };
    const monthly = extracted.monthly || {};
    const categories = extracted.categories || {};
    const win_rate = Number(extracted.win_rate || 0);

    db.run(`INSERT INTO documents (id, user_id, filename, uploaded_at, summary_json, monthly_json, categories_json, win_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
      docId, userId, filename, uploadedAt, JSON.stringify(summary), JSON.stringify(monthly), JSON.stringify(categories), win_rate
    ]);

    const transactions = extracted.transactions || [];
    for (let idx = 0; idx < transactions.length; idx++) {
      const t = transactions[idx];
      const txId = Date.now() + idx;
      const date = t.date || new Date().toISOString().split("T")[0];
      const amount = Number(t.amount || 0);
      const category = (t.category && Object.values(Category).includes(t.category as Category)) ? (t.category as Category) : Category.Other;
      const description = t.description || "Unspecified transaction";

      db.run(`INSERT INTO transactions (id, user_id, date, amount, category, description, uploaded_at, document_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
        txId, userId, date, amount, category, description, uploadedAt, docId
      ]);
    }

    this.saveToFile(db);
    return { id: docId, filename, uploaded_at: uploadedAt, summary, monthly, categories, win_rate };
  }

  public static async deleteDocument(userId: string, id: string): Promise<void> {
    const db = await this.getDB();
    db.run("DELETE FROM documents WHERE id = ? AND user_id = ?", [id, userId]);
    db.run("DELETE FROM transactions WHERE document_id = ? AND user_id = ?", [id, userId]);
    this.saveToFile(db);
  }

  public static async clearAll(userId: string): Promise<void> {
    const db = await this.getDB();
    db.run("DELETE FROM documents WHERE user_id = ?", [userId]);
    db.run("DELETE FROM transactions WHERE user_id = ?", [userId]);
    this.saveToFile(db);
  }
}

