import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import * as XLSX from "xlsx";
import * as pdfParseModule from "pdf-parse";
import mammoth from "mammoth";
import { Database } from "./src/database";

dotenv.config();

// Universal handler for pdf-parse compatibility across ESM, CJS, Render esbuild, and Vercel serverless builds
async function parsePdfBuffer(buffer: Buffer): Promise<{ text: string }> {
  let mod: any = pdfParseModule;
  while (mod && mod.default && mod !== mod.default) {
    mod = mod.default;
  }

  // Check if mod has PDFParse class constructor (V2 API)
  if (mod && mod.PDFParse && typeof mod.PDFParse === "function") {
    const parser = new mod.PDFParse({ data: buffer });
    const result = await parser.getText();
    return { text: result?.text || "" };
  } else if (mod && typeof mod === "function") {
    // If mod itself is the PDFParse class constructor
    if (mod.prototype && typeof mod.prototype.getText === "function") {
      const parser = new mod({ data: buffer });
      const result = await parser.getText();
      return { text: result?.text || "" };
    }
    // Standard V1 function call
    return await mod(buffer);
  }

  // Fallback dynamic require
  try {
    const dynamicRequire = eval("require");
    let reqMod = dynamicRequire("pdf-parse");
    while (reqMod && reqMod.default && reqMod !== reqMod.default) {
      reqMod = reqMod.default;
    }
    if (reqMod.PDFParse && typeof reqMod.PDFParse === "function") {
      const parser = new reqMod.PDFParse({ data: buffer });
      const result = await parser.getText();
      return { text: result?.text || "" };
    } else if (typeof reqMod === "function") {
      if (reqMod.prototype && typeof reqMod.prototype.getText === "function") {
        const parser = new reqMod({ data: buffer });
        const result = await parser.getText();
        return { text: result?.text || "" };
      }
      return await reqMod(buffer);
    }
  } catch (e) {
    // Ignore
  }

  throw new Error("Could not initialize pdf-parse library.");
}

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Increase body size limit for large statement file base64 uploads
app.use(express.json({ limit: "15mb" }));

// Helper to call Groq API with fallback models
async function callGroqAPI(prompt: string, textContent: string) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not defined in environment variables. Please configure your Groq key.");
  }

  // Prevent token overflow by truncating massive files while preserving context
  let cleanText = textContent;
  if (cleanText.length > 25000) {
    console.log(`Truncating document text from ${cleanText.length} to 25000 characters to stay within AI token limits.`);
    cleanText = cleanText.slice(0, 25000) + "\n\n[Note: Statement truncated to prevent token limit overflow. Please summarize all above transactions.]";
  }

  // Support fallback to active Groq models
  const models = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "qwen-2.5-32b", "gemma2-9b-it"];
  let lastError: any = null;

  for (const model of models) {
    try {
      console.log(`Calling Groq API using model: ${model}`);
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          max_tokens: 8192,
          messages: [
            {
              role: "system",
              content: `You are a financial document parser and transaction data extractor. You must extract transaction details and aggregate them according to the requested JSON structure.
CRITICAL TOKEN LIMIT RULE: If the document contains over 50 rows, aggregate or combine smaller similar items by category and month so the JSON output stays under 40 transaction items and finishes cleanly without hitting max completion tokens.
You MUST respond with a single valid JSON object. Do not include markdown blocks, text explanations, or triple backticks. Return ONLY the JSON object.

JSON SCHEMA STRUCTURE TO COMPLY WITH:
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "amount": number (positive for income/credits/gains, negative for expenses/debits/losses),
      "category": "Trading" | "Income" | "Expense" | "Transfer" | "Other",
      "description": "brief summary or merchant/counterparty description"
    }
  ],
  "summary": {
    "total_income": number,
    "total_expenses": number,
    "net_pl": number
  },
  "monthly": {
    "Jan": number, "Feb": number, "Mar": number, "Apr": number,
    "May": number, "Jun": number, "Jul": number, "Aug": number,
    "Sep": number, "Oct": number, "Nov": number, "Dec": number
  },
  "categories": {
    "Trading": number, "Income": number, "Expense": number, "Transfer": number, "Other": number
  },
  "win_rate": number (percentage of positive transactions in the "Trading" category out of total "Trading" transactions, or 0 if none)
}`
            },
            {
              role: "user",
              content: `SOURCE DOCUMENT DATA:\n${cleanText}\n\n${prompt}`
            }
          ],
          response_format: { type: "json_object" },
          temperature: 0.1
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Groq API returned status ${res.status}: ${errorText}`);
      }

      const responseJSON = await res.json();
      const content = responseJSON.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("Empty message content returned from Groq API.");
      }
      return content;
    } catch (err: any) {
      console.warn(`Groq API call to ${model} failed:`, err.message || err);
      lastError = err;
    }
  }

  throw lastError;
}

// Robust Multi-format Text Extractor
async function extractTextFromBuffer(buffer: Buffer, fileExt: string, isActualPdf: boolean): Promise<string> {
  if (isActualPdf || fileExt === ".pdf") {
    try {
      const parsed = await parsePdfBuffer(buffer);
      const text = (parsed.text || "").trim();
      if (text) {
        return text;
      }
    } catch (err: any) {
      console.warn("pdf-parse notice:", err.message);
    }
    // Fallback to string extraction if binary pdf-parse returned empty or threw an error (e.g. text/test files uploaded as .pdf)
    return buffer.toString("utf-8");
  } else if (fileExt === ".xlsx" || fileExt === ".xls" || fileExt === ".csv") {
    let textContent = "";
    try {
      const workbook = XLSX.read(buffer, { type: "buffer" });
      workbook.SheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        const csvData = XLSX.utils.sheet_to_csv(worksheet);
        if (csvData.trim()) {
          textContent += `--- SHEET: ${sheetName} ---\n${csvData}\n\n`;
        }
      });
      return textContent;
    } catch (err: any) {
      console.warn("XLSX parsing failed, falling back to direct string extraction:", err.message);
      return buffer.toString("utf-8");
    }
  } else if (fileExt === ".docx") {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value || "";
    } catch (err: any) {
      console.warn("mammoth docx parsing failed, falling back to direct string extraction:", err.message);
      return buffer.toString("utf-8");
    }
  } else {
    return buffer.toString("utf-8");
  }
}

// Middleware for checking user session authentication
const authMiddleware = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const token = req.headers["x-session-token"] as string || 
                    (req.headers["authorization"] as string)?.replace("Bearer ", "") ||
                    req.query.token as string;
      if (!token) {
        return res.status(401).json({ error: "Unauthorized: No session token provided" });
      }
      const user = await Database.getUserByToken(token);
      if (!user) {
        return res.status(401).json({ error: "Unauthorized: Invalid or expired session" });
      }
      (req as any).user = user;
      next();
    } catch (err: any) {
      res.status(500).json({ error: "Authentication check failed" });
    }
  };

  // --- AUTH ENDPOINTS ---
  
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password } = req.body;
      const result = await Database.registerUser(username, password);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed to register" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      const result = await Database.loginUser(username, password);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed to login" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      const token = req.headers["x-session-token"] as string || (req.headers["authorization"] as string)?.replace("Bearer ", "");
      if (!token) {
        return res.status(401).json({ error: "Not logged in" });
      }
      const user = await Database.getUserByToken(token);
      if (!user) {
        return res.status(401).json({ error: "Invalid session" });
      }
      res.json({ success: true, user });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Session validation failed" });
    }
  });


  // --- APPLICATION ENDPOINTS (USER ISOLATED) ---

  // Fetch dashboard stats and transactions
  app.get("/api/dashboard", authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const documentId = req.query.documentId as string | undefined;
      const data = await Database.getDashboardData(user.id, documentId);
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed to fetch dashboard data" });
    }
  });

  // Fetch transactions list
  app.get("/api/transactions", authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const documentId = req.query.documentId as string | undefined;
      const data = await Database.getDashboardData(user.id, documentId);
      res.json(data.transactions);
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed to fetch transactions" });
    }
  });

  // Delete a document and its related transactions
  app.delete("/api/documents/:id", authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      await Database.deleteDocument(user.id, id);
      res.json({ success: true, message: `Document successfully deleted` });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed to delete document" });
    }
  });

  // Clear all data and reset database for active user
  app.post("/api/reset", authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      await Database.clearAll(user.id);
      res.json({ success: true, message: "Database successfully cleared" });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed to reset database" });
    }
  });

  // Upload document file as base64 and parse using Groq API
  app.post("/api/upload", authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const { filename, fileData } = req.body;

      if (!filename || !fileData) {
        return res.status(400).json({ error: "Missing required fields: filename or fileData" });
      }

      // Check if fileData has standard mime headers and remove them
      const cleanBase64 = fileData.replace(/^data:[a-zA-Z0-9/.-]+;base64,/, "");

      const prompt = `Extract all transaction details. Analyze tables, deposits, withdrawals, debits, credits, charges, or trades.

Extract ALL transactions with:
- Date: standardized to YYYY-MM-DD
- Amount: positive = income/credit/gain, negative = expense/debit/loss
- Category: Must be exactly one of: Trading, Income, Expense, Transfer, Other. If it looks like a trading profit/loss, label as "Trading". If it's salary or sales income, label as "Income". If it's utilities/services/fees/merchant buys, label as "Expense".
- Description: brief summary or name

Calculate:
- Total income (sum of positive amounts)
- Total expenses (sum of negative amounts as a positive number)
- Net P&L (total_income - total_expenses)
- Monthly trends (Jan-Dec) for all months represented
- Category breakdown with positive aggregated values per category
- win_rate (percentage of positive transactions in the "Trading" category out of total "Trading" transactions)

You MUST respond with a single, raw, and valid JSON object complying with the schema specified in the system instructions.`;

      // Detect file format based on extension and header signature
      const buffer = Buffer.from(cleanBase64, "base64");
      const isActualPdf = buffer.toString("utf-8", 0, 5) === "%PDF-";
      const fileExt = path.extname(filename).toLowerCase();

      // Step 5 & 6: Extract plain-text from any file format
      const textContent = await extractTextFromBuffer(buffer, fileExt, isActualPdf);

      if (!textContent || !textContent.trim()) {
        throw new Error("Unable to extract any text content from the uploaded statement. Please check the file.");
      }

      // Step 7: Call Groq API to parse the text data
      const responseText = await callGroqAPI(prompt, textContent);

      if (!responseText) {
        throw new Error("Empty response from Groq parsing model.");
      }

      let extractedData;
      try {
        extractedData = JSON.parse(responseText.trim());
      } catch (parseErr) {
        // Fallback: try finding a JSON block if some conversational text sneaked in
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          extractedData = JSON.parse(jsonMatch[0].trim());
        } else {
          throw new Error("Failed to parse AI response into structured JSON data.");
        }
      }

      // Save to database linked to active user session
      const docRecord = await Database.addDocument(user.id, filename, extractedData);

      res.json({
        success: true,
        document: docRecord,
        message: "Financial document successfully parsed and categorized by Groq AI.",
      });
    } catch (e: any) {
      console.error("Upload error:", e);
      let errMsg = e.message || "Failed to process and parse document";
      res.status(500).json({ error: errMsg });
    }
  });

  // Export transactions report as CSV
  app.get("/api/report", authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const documentId = req.query.documentId as string | undefined;
      const data = await Database.getDashboardData(user.id, documentId);
      
      // Generate CSV content
      const headers = ["ID", "Date", "Category", "Amount", "Description", "Uploaded At"];
      const rows = data.transactions.map(t => [
        t.id,
        t.date,
        t.category,
        t.amount,
        `"${t.description.replace(/"/g, '""')}"`,
        t.uploaded_at
      ]);

      const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      
      const filename = documentId && documentId !== "all" 
        ? `Auto_Journal_Report_${documentId}.csv` 
        : "Auto_Journal_All_Transactions.csv";

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
      res.status(200).send(csvContent);
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed to export report" });
    }
  });

// 2. Serve Client application or start server only when NOT running as a Vercel Serverless Function
if (!process.env.VERCEL) {
  if (process.env.NODE_ENV !== "production") {
    createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    }).then((vite) => {
      app.use(vite.middlewares);
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`Auto-Journal dev server running on http://localhost:${PORT}`);
      });
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Auto-Journal production server running on http://localhost:${PORT}`);
    });
  }
}

export default app;
