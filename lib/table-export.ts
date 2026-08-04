// ============================================================================
// MODULE : Tabular export — CSV and Excel serialisers
//
// Extracted from lib/attendance-export.ts when Customers needed the same two
// formats. The serialisation rules that matter (RFC 4180 quoting, the UTF-8 BOM,
// XML escaping, real numeric cells) are identical for any table; only the COLUMN
// SPEC differs. Keeping one copy means a quoting bug is fixed once rather than
// found twice, months apart, in two files that had drifted.
//
// WHY NOT AN XLSX LIBRARY: the project has no spreadsheet dependency, and adding
// one (`xlsx`, `exceljs`) for a download button is a large surface for a small
// feature. SpreadsheetML 2003 is an XML dialect Excel, LibreOffice, Numbers and
// Google Sheets all open natively, and it carries real cell TYPES — so hours land
// as numbers a user can sum, not text. That is a genuine Excel file, not a CSV
// with the extension changed.
// ============================================================================

export type ColumnType = "text" | "number";

/** One column: where the value comes from, what it is called, how Excel types it. */
export type ExportColumn<Row> = {
  header: string;
  key: keyof Row;
  type: ColumnType;
};

// ============================================================================
// CSV
// ============================================================================

/**
 * RFC 4180 field quoting.
 *
 * A field is quoted when it contains a comma, a quote or a newline, and embedded
 * quotes are doubled. A customer note containing a comma would otherwise shift
 * every later column by one — silently, and only for that row.
 */
function csvField(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Serialise to CSV, prefixed with a UTF-8 BOM.
 *
 * Without the BOM, Excel on Windows reads the file as the local ANSI codepage and
 * mangles every non-ASCII name — which for an Indian salon is most of them.
 */
export function serialiseCsv<Row>(columns: readonly ExportColumn<Row>[], rows: Row[]): string {
  const lines = [columns.map((c) => csvField(c.header)).join(",")];

  for (const row of rows) {
    lines.push(columns.map((c) => csvField(row[c.key])).join(","));
  }

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

// ============================================================================
// EXCEL — SpreadsheetML 2003
// ============================================================================

function xmlEscape(value: unknown): string {
  return (value === null || value === undefined ? "" : String(value))
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    // Control characters are illegal in XML 1.0 and make Excel reject the file.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

function cell(value: unknown, type: ColumnType, styleId?: string): string {
  const style = styleId ? ` ss:StyleID="${styleId}"` : "";

  if (type === "number") {
    const numeric = typeof value === "number" && Number.isFinite(value) ? value : 0;
    return `<Cell${style}><Data ss:Type="Number">${numeric}</Data></Cell>`;
  }

  return `<Cell${style}><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`;
}

/**
 * Serialise to a SpreadsheetML workbook.
 *
 * Numeric columns are emitted as `ss:Type="Number"` so figures arrive as real
 * numbers — AutoSum works on the downloaded file, which is the entire point of
 * offering Excel alongside CSV.
 */
export function serialiseExcelXml<Row>(
  columns: readonly ExportColumn<Row>[],
  rows: Row[],
  sheetName: string
): string {
  const header = `<Row>${columns.map((c) => cell(c.header, "text", "hdr")).join("")}</Row>`;

  const body = rows
    .map((row) => `<Row>${columns.map((c) => cell(row[c.key], c.type)).join("")}</Row>`)
    .join("");

  // Excel refuses a worksheet name containing : \ / ? * [ ] or longer than 31 chars.
  const safeName = xmlEscape(sheetName.replace(/[:\\/?*[\]]/g, "-").slice(0, 31));

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Bottom"/><Font ss:FontName="Calibri" ss:Size="11"/></Style>
  <Style ss:ID="hdr"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/><Interior ss:Color="#F2F2F2" ss:Pattern="Solid"/><Alignment ss:Vertical="Bottom"/></Style>
 </Styles>
 <Worksheet ss:Name="${safeName}">
  <Table>${header}${body}</Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane><ActivePane>2</ActivePane></WorksheetOptions>
 </Worksheet>
</Workbook>`;
}

// ============================================================================
// CSV PARSING — for imports
// ============================================================================

/**
 * Parse RFC 4180 CSV into rows of raw strings.
 *
 * Hand-written for the same reason the writer is: the project has no CSV
 * dependency. Handles quoted fields containing commas, escaped `""` quotes and
 * newlines inside quotes — all three appear in real address columns, and a naive
 * `split(",")` silently corrupts those rows rather than failing loudly.
 *
 * A leading UTF-8 BOM (present in every file Excel exports) is stripped, since it
 * would otherwise become part of the first header name.
 */
export function parseCsv(text: string): string[][] {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\r") {
      // Swallow; the \n that follows ends the record.
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  // A file not ending in a newline still has a final record to flush.
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Drop entirely blank lines, which trailing newlines and Excel both produce.
  return rows.filter((r) => r.some((cellValue) => cellValue.trim() !== ""));
}
