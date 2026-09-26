import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";

const FIELDS = [
  { key: "supplierName",  label: "Supplier Name",     width: 160 },
  { key: "invoiceNumber", label: "Invoice No.",        width: 120 },
  { key: "invoiceDate",   label: "Invoice Date",       width: 110 },
  { key: "description",   label: "Description",        width: 200 },
  { key: "unitPrice",     label: "Unit Price (RM)",    width: 110 },
  { key: "quantity",      label: "Qty",                width: 70  },
  { key: "amount",        label: "Amount (RM)",        width: 110 },
  { key: "sstAmount",     label: "SST Amount (RM)",    width: 120 },
  { key: "totalAmount",   label: "Total Amount (RM)",  width: 130 },
];

const SCAN_LIMIT = 5;

const SYSTEM_PROMPT = `You are an expert invoice data extractor. Extract invoice data from the provided image or document.
Return ONLY a valid JSON array (no markdown, no explanation, no backticks) with this exact structure:
[
  {
    "supplierName": "...",
    "invoiceNumber": "...",
    "invoiceDate": "date as shown on invoice",
    "description": "item description",
    "unitPrice": "numeric only, no currency symbol",
    "quantity": "numeric only",
    "amount": "numeric only, no currency symbol",
    "sstAmount": "numeric only, no currency symbol",
    "totalAmount": "numeric only, no currency symbol"
  }
]
Rules:
- If invoice has multiple line items, return one object per line item
- Remove all currency symbols (RM, MYR, $) from numeric fields
- If a field is not found, use empty string ""
- SST = Sales and Service Tax (Malaysia 8%)
- totalAmount = amount + sstAmount (if applicable)`;

const emptyRow = () => ({
  id: crypto.randomUUID(),
  supplierName: "", invoiceNumber: "", invoiceDate: "",
  description: "", unitPrice: "", quantity: "",
  amount: "", sstAmount: "", totalAmount: "",
});

export default function Home() {
  const [rows, setRows] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const fileRef = useRef();

  const scanFile = useCallback(async (file) => {
    if (scanCount >= SCAN_LIMIT) return;

    const isImage = file.type.startsWith("image/");
    const isPDF = file.type === "application/pdf";
    if (!isImage && !isPDF) {
      setError(`"${file.name}" — only JPG, PNG, or PDF supported.`);
      return;
    }

    setScanning(true);
    setError("");
    setScanMsg(`Reading ${file.name}...`);

    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(",")[1]);
        r.onerror = () => rej(new Error("File read failed"));
        r.readAsDataURL(file);
      });

      setScanMsg(`Analysing ${file.name} with AI...`);

      const contentBlock = isPDF
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
        : { type: "image",    source: { type: "base64", media_type: file.type, data: base64 } };

      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: [contentBlock, { type: "text", text: "Extract all invoice data. Return JSON array only." }] }],
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error.message || data.error);

      const raw = data.content.map((c) => c.text || "").join("").replace(/```json|```/g, "").trim();
      const extracted = JSON.parse(raw);
      if (!Array.isArray(extracted)) throw new Error("Unexpected AI response format");

      const newRows = extracted.map((r) => ({ id: crypto.randomUUID(), ...r }));
      setRows((prev) => [...prev, ...newRows]);
      setScanCount((prev) => prev + 1);
      setScanMsg(`✓ Extracted ${newRows.length} line item(s) from ${file.name}`);
    } catch (e) {
      setError(e.message);
      setScanMsg("");
    } finally {
      setScanning(false);
    }
  }, [scanCount]);

  const handleFiles = (files) => {
    const remaining = SCAN_LIMIT - scanCount;
    Array.from(files).slice(0, remaining).forEach(scanFile);
  };

  const updateCell = (id, key, val) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: val } : r)));

  const deleteRow = (id) => setRows((prev) => prev.filter((r) => r.id !== id));

  const exportExcel = () => {
    const headers = FIELDS.map((f) => f.label);
    const body = rows.map((r) => FIELDS.map((f) => r[f.key] || ""));
    const ws = XLSX.utils.aoa_to_sheet([headers, ...body]);
    ws["!cols"] = FIELDS.map((f) => ({ wch: Math.round(f.width / 7) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Invoices");
    XLSX.writeFile(wb, `invoices_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const limitReached = scanCount >= SCAN_LIMIT;

  return (
    <div style={{ minHeight: "100vh", background: "#0f1117", color: "#e8eaf0", fontFamily: "inherit" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid #1e2130", padding: "18px 32px", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: 9, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
          📄
        </div>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.3px" }}>Invoice Scanner</h1>
          <p style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>AI-powered • Export to Excel • SST-ready</p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {/* Scan counter badge */}
          <div style={{ fontSize: 12, color: limitReached ? "#f87171" : "#6b7280", background: "#1e2130", padding: "6px 12px", borderRadius: 6, border: `1px solid ${limitReached ? "#f87171" : "#2a2d3e"}` }}>
            {limitReached ? "Trial limit reached" : `${scanCount} / ${SCAN_LIMIT} free scans used`}
          </div>
          {rows.length > 0 && (
            <>
              <Btn onClick={() => setRows((p) => [...p, emptyRow()])} color="#1e2130" text="#a5b4fc">+ Add Row</Btn>
              <Btn onClick={() => { setRows([]); setScanMsg(""); setError(""); }} color="#1e2130" text="#f87171">Clear All</Btn>
              <Btn onClick={exportExcel} color="#6366f1" text="#fff" bold>⬇ Export Excel</Btn>
            </>
          )}
        </div>
      </header>

      <main style={{ padding: "28px 32px" }}>
        {/* Drop Zone */}
        {!limitReached ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => !scanning && fileRef.current.click()}
            style={{
              border: `2px dashed ${dragOver ? "#6366f1" : "#2a2d3e"}`,
              borderRadius: 12, padding: "40px 24px", textAlign: "center",
              cursor: scanning ? "wait" : "pointer",
              background: dragOver ? "rgba(99,102,241,0.06)" : "#13151f",
              transition: "border-color 0.2s, background 0.2s",
              marginBottom: 24,
            }}
          >
            <input ref={fileRef} type="file" accept="image/*,.pdf" multiple style={{ display: "none" }}
              onChange={(e) => handleFiles(e.target.files)} />
            {scanning ? (
              <div style={{ color: "#a5b4fc" }}>
                <Spinner />
                <p style={{ marginTop: 12, fontWeight: 500 }}>{scanMsg || "Scanning…"}</p>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 34, marginBottom: 10 }}>🧾</div>
                <p style={{ fontWeight: 600, fontSize: 15, color: "#c7d2fe" }}>Drop invoices here or click to upload</p>
                <p style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>JPG · PNG · PDF &nbsp;|&nbsp; {SCAN_LIMIT - scanCount} free scan{SCAN_LIMIT - scanCount !== 1 ? "s" : ""} remaining</p>
              </>
            )}
          </div>
        ) : (
          /* Limit reached banner */
          <div style={{ background: "#13151f", border: "2px dashed #374151", borderRadius: 12, padding: "40px 24px", textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 34, marginBottom: 10 }}>🔒</div>
            <p style={{ fontWeight: 600, fontSize: 15, color: "#f87171", marginBottom: 8 }}>Free trial limit reached (5/5 scans used)</p>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>You've used all your free scans. To continue scanning invoices, please contact us.</p>
            <a
              href="mailto:scy0932@gmail.com?subject=Invoice Scanner - Upgrade Request"
              style={{ display: "inline-block", background: "#6366f1", color: "#fff", padding: "10px 24px", borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: "none" }}
            >
              Contact to Upgrade →
            </a>
          </div>
        )}

        {/* Status messages */}
        {scanMsg && !scanning && (
          <Banner color="rgba(99,102,241,0.12)" border="rgba(99,102,241,0.35)" text="#a5b4fc">{scanMsg}</Banner>
        )}
        {error && (
          <Banner color="rgba(248,113,113,0.1)" border="rgba(248,113,113,0.35)" text="#f87171">⚠ {error}</Banner>
        )}

        {/* Table */}
        {rows.length > 0 && (
          <>
            <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid #1e2130" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#13151f", borderBottom: "2px solid #1e2130" }}>
                    {FIELDS.map((f) => (
                      <th key={f.key} style={{ padding: "11px 10px", textAlign: "left", color: "#818cf8", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>
                        {f.label}
                      </th>
                    ))}
                    <th style={{ padding: "11px 8px", color: "#818cf8", fontSize: 11, textTransform: "uppercase" }}>Del</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row.id} style={{ background: i % 2 === 0 ? "#0f1117" : "#12141e", borderBottom: "1px solid #1a1d2b" }}>
                      {FIELDS.map((f) => (
                        <td key={f.key} style={{ padding: "3px 4px" }}>
                          <input
                            value={row[f.key] || ""}
                            onChange={(e) => updateCell(row.id, f.key, e.target.value)}
                            style={{ background: "transparent", border: "1px solid transparent", color: "#e8eaf0", fontSize: 13, padding: "5px 8px", borderRadius: 5, width: "100%", minWidth: f.width, transition: "border-color 0.15s" }}
                            onFocus={(e) => (e.target.style.borderColor = "#6366f1")}
                            onBlur={(e) => (e.target.style.borderColor = "transparent")}
                          />
                        </td>
                      ))}
                      <td style={{ textAlign: "center", padding: "3px 8px" }}>
                        <button onClick={() => deleteRow(row.id)} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 16, padding: "4px 6px", borderRadius: 4, lineHeight: 1 }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#4b5563" }}>{rows.length} row{rows.length !== 1 ? "s" : ""}</span>
              <Btn onClick={exportExcel} color="#6366f1" text="#fff" bold large>⬇ Export to Excel</Btn>
            </div>
          </>
        )}

        {!scanning && rows.length === 0 && !error && (
          <p style={{ textAlign: "center", color: "#2d3148", fontSize: 14, marginTop: 48 }}>
            Upload your first invoice to get started
          </p>
        )}
      </main>
    </div>
  );
}

function Btn({ onClick, color, text, bold, large, children }) {
  return (
    <button onClick={onClick} style={{ background: color, color: text, border: "none", borderRadius: 7, padding: large ? "10px 22px" : "8px 16px", fontSize: large ? 14 : 13, cursor: "pointer", fontWeight: bold ? 600 : 500 }}>
      {children}
    </button>
  );
}

function Banner({ color, border, text, children }) {
  return (
    <div style={{ background: color, border: `1px solid ${border}`, borderRadius: 8, padding: "10px 16px", marginBottom: 18, fontSize: 13, color: text }}>
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: "inline-block", width: 28, height: 28, border: "3px solid rgba(99,102,241,0.3)", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
