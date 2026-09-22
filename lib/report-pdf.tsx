// Server-only — never import from client components.
//
// MODULE : Report PDF — renders the shared report model (lib/report-export.ts)
// with @react-pdf/renderer, the same engine and fonts as the invoice PDF. Used
// by the Sheet and Reports downloads through /api/v1/branch-admin/reports/pdf.
//
// Pagination: a long table gets its own page run with a header row that repeats
// on every page; short tables flow together so a summary doesn't waste paper.
//
// Orientation is decided per page run, not per report: pages are portrait
// unless a table is too wide to read that way (the sales register, the
// appointment list, a sheet with many workers), and only those pages turn
// landscape — so a summary can mix both.

import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { PDF_FONT } from "@/lib/pdf-fonts";
import { inr, money, type Cell, type Column, type LinesCell, type Report, type ReportMeta, type Table } from "@/lib/report-export";

const INK = "#111827";
const MUTED = "#6B7280";
const FAINT = "#D1D5DB";
const RULE = "#E5E7EB";
const HEAD_BG = "#F3F4F6";
const ZEBRA = "#FAFAFA";
const ACCENT = "#059669";

/** Rows above which a table gets its own pages with a repeating header. */
const LONG_TABLE = 25;

/**
 * Total column weight above which a table goes landscape. Portrait A4 is ~543pt
 * of usable width, so at 11 a money column still gets ~55pt — enough for
 * "₹1,00,000"; any wider and columns start wrapping mid-number.
 */
const LANDSCAPE_WEIGHT = 11;

const s = StyleSheet.create({
  page: { fontFamily: PDF_FONT, fontSize: 8, color: INK, paddingTop: 26, paddingBottom: 34, paddingHorizontal: 26 },

  docHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end",
             borderBottomWidth: 1.5, borderBottomColor: INK, paddingBottom: 7, marginBottom: 10 },
  brand: { fontSize: 7.5, fontWeight: 700, letterSpacing: 1.2, color: MUTED, textTransform: "uppercase" },
  title: { fontSize: 16, fontWeight: 700, marginTop: 2 },
  metaRight: { alignItems: "flex-end" },
  period: { fontSize: 10, fontWeight: 700 },
  meta: { fontSize: 7.5, color: MUTED, marginTop: 2 },

  stats: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12, marginHorizontal: -3 },
  stat: { flexGrow: 1, flexBasis: 100, margin: 3, borderWidth: 0.75, borderColor: RULE, borderRadius: 4,
          backgroundColor: "#F9FAFB", paddingVertical: 5, paddingHorizontal: 7 },
  statK: { fontSize: 6, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 },
  statV: { fontSize: 9.5, fontWeight: 700, marginTop: 2 },

  section: { marginBottom: 14 },
  h2: { fontSize: 10.5, fontWeight: 700, marginBottom: 2 },
  note: { fontSize: 7, color: MUTED, marginBottom: 4 },

  tHead: { flexDirection: "row", backgroundColor: HEAD_BG, borderTopWidth: 0.75, borderBottomWidth: 0.75, borderColor: FAINT },
  th: { fontSize: 6.5, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: 0.3,
        paddingVertical: 4, paddingHorizontal: 4 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: RULE },
  td: { paddingVertical: 3, paddingHorizontal: 4 },
  num: { textAlign: "right" },
  dim: { color: FAINT },
  foot: { flexDirection: "row", backgroundColor: HEAD_BG, borderTopWidth: 1.25, borderTopColor: INK, borderBottomWidth: 0.75, borderBottomColor: FAINT },
  footTd: { paddingVertical: 4, paddingHorizontal: 4, fontWeight: 700 },
  empty: { paddingVertical: 12, textAlign: "center", color: MUTED },

  ln: { flexDirection: "row", justifyContent: "space-between" },
  lbl: { flexGrow: 1, flexShrink: 1, fontSize: 6.5, color: MUTED, marginRight: 3 },
  amt: { fontWeight: 700 },
  tag: { fontSize: 5.5, fontWeight: 700, color: ACCENT },
  sub: { marginTop: 1.5, paddingTop: 1, borderTopWidth: 0.5, borderTopColor: "#9CA3AF", borderStyle: "dashed", textAlign: "right", fontWeight: 700 },

  pageFoot: { position: "absolute", bottom: 14, left: 26, right: 26, flexDirection: "row", justifyContent: "space-between",
              fontSize: 6.5, color: MUTED },
});

// ─── Cells ────────────────────────────────────────────────────────────────────

/** Relative column width: wide for free text, narrow for counts. */
function weight(c: Column, itemised: boolean, index: number): number {
  if (c.weight) return c.weight;
  if (itemised) return index === 0 ? 1.25 : 1.5;
  if (c.label === "#") return 0.45;
  switch (c.kind) {
    case "money": return 1.15;
    case "int":
    case "pct":   return 0.8;
    default:      return 1.5;
  }
}

const tableWeight = (t: Table) => t.columns.reduce((n, c, i) => n + weight(c, !!t.itemised, i), 0);
const isWide = (t: Table) => tableWeight(t) > LANDSCAPE_WEIGHT;

const isLines = (c: Cell): c is LinesCell => typeof c === "object" && c !== null;

function text(c: Cell, kind: Column["kind"]): string {
  if (c === null || c === "") return "";
  if (isLines(c)) return money(c.total);
  if (typeof c === "number") {
    if (kind === "money") return money(c);
    if (kind === "pct")   return `${c.toFixed(1)}%`;
    return inr.format(c);
  }
  return c;
}

function Lines({ cell }: { cell: LinesCell }) {
  return (
    <View>
      {cell.lines.map((p, i) => (
        <View key={i} style={s.ln}>
          {p.label ? <Text style={[s.lbl, { maxLines: 1, textOverflow: "ellipsis" }]}>{p.label}</Text> : <Text style={s.lbl}> </Text>}
          {p.amount !== null ? (
            <Text style={s.amt}>
              {inr.format(p.amount)}
              {p.tag ? <Text style={s.tag}> {p.tag}</Text> : null}
            </Text>
          ) : null}
        </View>
      ))}
      {cell.lines.length > 1 ? <Text style={s.sub}>{money(cell.total)}</Text> : null}
    </View>
  );
}

// ─── Tables ───────────────────────────────────────────────────────────────────

function TableView({ t, repeatHeader }: { t: Table; repeatHeader: boolean }) {
  const itemised = !!t.itemised;
  const widths = t.columns.map((c, i) => weight(c, itemised, i));
  const cellStyle = (i: number) => ({ flexGrow: widths[i], flexBasis: 0 });
  const alignOf = (i: number) => (t.columns[i]?.kind && t.columns[i]!.kind !== "text" ? s.num : {});

  return (
    <View style={s.section} wrap={t.rows.length > 12}>
      <View minPresenceAhead={40}>
        <Text style={s.h2}>{t.title}</Text>
        {t.note ? <Text style={s.note}>{t.note}</Text> : null}
      </View>

      <View style={s.tHead} fixed={repeatHeader}>
        {t.columns.map((c, i) => (
          <Text key={i} style={[s.th, cellStyle(i), alignOf(i)]}>{c.label}</Text>
        ))}
      </View>

      {t.rows.length === 0 ? (
        <Text style={s.empty}>Nothing recorded in this period.</Text>
      ) : (
        t.rows.map((r, ri) => (
          <View key={ri} style={[s.row, ri % 2 === 1 ? { backgroundColor: ZEBRA } : {}]} wrap={false}>
            {r.map((c, i) =>
              itemised && isLines(c) ? (
                <View key={i} style={[s.td, cellStyle(i)]}><Lines cell={c} /></View>
              ) : (
                <Text key={i} style={[s.td, cellStyle(i), alignOf(i), c === null ? s.dim : {},
                                      itemised && i === 0 ? { fontWeight: 700 } : {}]}>
                  {c === null ? "—" : text(c, t.columns[i]?.kind)}
                </Text>
              )
            )}
          </View>
        ))
      )}

      {t.footer ? (
        <View style={s.foot} wrap={false}>
          {t.footer.map((c, i) => (
            <Text key={i} style={[s.footTd, cellStyle(i), alignOf(i)]}>{text(c, t.columns[i]?.kind)}</Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ─── Document ─────────────────────────────────────────────────────────────────

function ReportDocument({ r, meta, generatedAt }: { r: Report; meta: ReportMeta; generatedAt: string }) {
  // Long tables start a fresh page run so their header can repeat (a `fixed`
  // element repeats on every page of its <Page>); short ones share a page as
  // long as they want the same orientation.
  type Run = { tables: Table[]; repeat: boolean; wide: boolean };
  const runs: Run[] = [];
  let flow: Run | null = null;
  // A sheet split into worker groups keeps one orientation across its parts.
  const gridWide = r.tables.some((t) => t.itemised && isWide(t));
  for (const t of r.tables) {
    const wide = t.itemised ? gridWide : isWide(t);
    if (t.rows.length > LONG_TABLE) {
      if (flow) runs.push(flow);
      flow = null;
      runs.push({ tables: [t], repeat: true, wide });
    } else if (flow && flow.wide === wide) {
      flow.tables.push(t);
    } else {
      if (flow) runs.push(flow);
      flow = { tables: [t], repeat: false, wide };
    }
  }
  if (flow) runs.push(flow);
  if (runs.length === 0) runs.push({ tables: [], repeat: false, wide: false });

  const docTitle = `${meta.orgName} - ${r.title} - ${meta.from} to ${meta.to}`;

  return (
    <Document title={docTitle} author={meta.orgName} creator="Renzo">
      {runs.map((run, pi) => (
        <Page key={pi} size="A4" orientation={run.wide ? "landscape" : "portrait"} style={s.page} wrap>
          {pi === 0 ? (
            <>
              <View style={s.docHead}>
                <View>
                  <Text style={s.brand}>{meta.orgName}</Text>
                  <Text style={s.title}>{r.title}</Text>
                </View>
                <View style={s.metaRight}>
                  <Text style={s.period}>{meta.periodLabel}</Text>
                  <Text style={s.meta}>{meta.subtitle ? `${meta.subtitle} · ` : ""}Generated {generatedAt}</Text>
                </View>
              </View>
              {r.stats.length ? (
                <View style={s.stats}>
                  {r.stats.map((st) => (
                    <View key={st.label} style={s.stat}>
                      <Text style={s.statK}>{st.label}</Text>
                      <Text style={s.statV}>{st.value}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          ) : null}

          {run.tables.map((t, ti) => <TableView key={ti} t={t} repeatHeader={run.repeat} />)}

          <View style={s.pageFoot} fixed>
            <Text>{meta.orgName} · {r.title} · {meta.periodLabel} · Amounts in ₹</Text>
            <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
          </View>
        </Page>
      ))}
    </Document>
  );
}

export async function generateReportPdf(r: Report, meta: ReportMeta): Promise<Buffer> {
  const generatedAt = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata",
  }).format(new Date());
  return renderToBuffer(<ReportDocument r={r} meta={meta} generatedAt={generatedAt} />);
}
