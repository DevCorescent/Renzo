// ============================================================================
// MODULE : Customers — export
// ROUTE  : /api/v1/admin/customers/export?format=csv|excel|pdf
//
// Honours exactly the same filters as the list endpoint, so what downloads is
// what the operator is looking at. Branch-scoped like every other customer route.
//
// ACCESS: SUPER_ADMIN, OWNER, BRANCH_ADMIN. The front desk does not export the
//   customer book — that is a data-extraction capability, not a service one.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { requireBranchScope } from "@/lib/branch-scope";
import prisma from "@/lib/db";
import { CUSTOMER_SELECT } from "@/lib/customer-schema";
import {
  buildCustomerWhere,
  customerOrderBy,
  parseCustomerFilters,
} from "@/lib/customer-service";
import {
  customersToCsv,
  customersToExcelXml,
  toCustomerExportRow,
} from "@/lib/customer-export";
import { generateCustomerPdf } from "@/lib/customer-pdf";

const FORMATS = ["csv", "excel", "pdf"] as const;
type Format = (typeof FORMATS)[number];

/** PDF is capped hardest: it renders every row, and a 20k-row PDF helps nobody. */
const MAX_ROWS: Record<Format, number> = { csv: 20000, excel: 20000, pdf: 2000 };

const CONTENT_TYPE: Record<Format, string> = {
  csv: "text/csv; charset=utf-8",
  excel: "application/vnd.ms-excel; charset=utf-8",
  pdf: "application/pdf",
};

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  const url = new URL(req.url);
  const { scope, error: scopeError } = requireBranchScope(user, url);
  if (scopeError) return scopeError;

  try {
    const formatRaw = (url.searchParams.get("format")?.trim().toLowerCase() ?? "csv") as Format;
    if (!FORMATS.includes(formatRaw)) {
      return err("Validation failed", 422, { format: ["Must be csv, excel or pdf"] });
    }

    const filters = parseCustomerFilters(url);
    const where = buildCustomerWhere(filters, scope);
    const cap = MAX_ROWS[formatRaw];

    const records = await prisma.customer.findMany({
      where,
      orderBy: customerOrderBy(filters),
      take: cap + 1,
      select: CUSTOMER_SELECT,
    });

    const truncated = records.length > cap;
    const page = truncated ? records.slice(0, cap) : records;
    const rows = page.map(toCustomerExportRow);

    const stamp = new Date().toISOString().slice(0, 10);
    const extension = formatRaw === "excel" ? "xls" : formatRaw;
    const filename = `Customers-${stamp}.${extension}`;

    const headers: Record<string, string> = {
      "Content-Type": CONTENT_TYPE[formatRaw],
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Total-Rows": String(page.length),
      ...(truncated ? { "X-Truncated": "true" } : {}),
    };

    if (formatRaw === "pdf") {
      const branchLabel = scope.branchId
        ? (await prisma.branch.findUnique({
            where: { id: scope.branchId },
            select: { name: true },
          }))?.name ?? "Selected branch"
        : "All branches";

      const pdf = await generateCustomerPdf({
        rows,
        branchLabel,
        generatedAt: new Date(),
        truncated,
      });
      return new NextResponse(pdf as BodyInit, { headers });
    }

    const body =
      formatRaw === "csv" ? customersToCsv(rows) : customersToExcelXml(rows);

    return new NextResponse(body, { headers });
  } catch {
    return err("Internal server error", 500);
  }
}
