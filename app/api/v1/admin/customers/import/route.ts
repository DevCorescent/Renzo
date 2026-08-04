// ============================================================================
// MODULE : Customers — bulk import
// ROUTE  : /api/v1/admin/customers/import
//
// METHODS
//   GET  — Download a CSV template with the expected header row.
//   POST — Import customers from a pasted CSV body.
//          { csv: "<file contents>", dryRun?: boolean, skipDuplicates?: boolean }
//
// EXCEL FILES: an .xlsx is a ZIP of XML and cannot be parsed without a spreadsheet
//   dependency this project deliberately does not carry. The Excel path is
//   therefore "Save As → CSV", which Excel, Numbers, LibreOffice and Sheets all
//   offer — and the .xls we EXPORT is SpreadsheetML, which round-trips through the
//   same Save As. The UI says exactly this rather than accepting a file it would
//   silently fail to read.
//
// EVERY ROW IS VALIDATED against the same Zod schema the single-create endpoint
// uses, and duplicates are detected on the same normalised phone key, so an import
// cannot introduce a record the manual form would have rejected.
//
// ACCESS: SUPER_ADMIN, OWNER, BRANCH_ADMIN.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { err, ok } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { requireBranchScope } from "@/lib/branch-scope";
import { readJson } from "@/lib/validate";
import { writeAudit } from "@/lib/audit";
import { parseCsv } from "@/lib/table-export";
import { IMPORT_TEMPLATE_HEADERS } from "@/lib/customer-export";
import {
  CUSTOMER_GENDERS,
  CUSTOMER_SOURCES,
  CUSTOMER_TYPES,
  CustomerCreateSchema,
} from "@/lib/customer-schema";
import { createCustomer, phoneKey, splitName } from "@/lib/customer-service";

const MODULE = "CUSTOMER";
const MAX_ROWS = 2000;

export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  // A template plus one worked example: an empty header row leaves people guessing
  // what "Source" will accept.
  const body =
    `﻿${IMPORT_TEMPLATE_HEADERS.join(",")}\r\n` +
    `Priya Sharma,9876543210,,priya@example.com,FEMALE,1994-05-12,"12 MG Road, Flat 4",Bengaluru,Karnataka,560001,WALK_IN,INSTAGRAM\r\n`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="Customer-Import-Template.csv"',
      "Cache-Control": "no-store",
    },
  });
}

/** Header name → the field it feeds. Case- and space-insensitive on the way in. */
const HEADER_MAP: Record<string, string> = {
  name: "name",
  customername: "name",
  firstname: "name",
  phone: "phone",
  mobile: "phone",
  mobilenumber: "phone",
  alternatephone: "alternatePhone",
  alternatenumber: "alternatePhone",
  email: "email",
  gender: "gender",
  dateofbirth: "dateOfBirth",
  dob: "dateOfBirth",
  address: "address",
  city: "city",
  state: "state",
  pincode: "pincode",
  customertype: "customerType",
  type: "customerType",
  source: "source",
  entrysource: "source",
};

const normaliseHeader = (h: string) => h.trim().toLowerCase().replace(/[\s_-]/g, "");

type RowError = { row: number; field: string; message: string };

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  const { scope, error: scopeError } = requireBranchScope(user);
  if (scopeError) return scopeError;

  const body = await readJson(req);
  if (typeof body !== "object" || body === null) return err("Invalid request body");

  const { csv, dryRun, skipDuplicates } = body as {
    csv?: unknown;
    dryRun?: unknown;
    skipDuplicates?: unknown;
  };

  if (typeof csv !== "string" || csv.trim() === "") {
    return err("Validation failed", 422, { csv: ["Paste or upload a CSV file"] });
  }

  try {
    const table = parseCsv(csv);
    if (table.length < 2) {
      return err("Validation failed", 422, {
        csv: ["The file needs a header row and at least one customer"],
      });
    }

    const [headerRow, ...dataRows] = table;
    if (dataRows.length > MAX_ROWS) {
      return err("Validation failed", 422, {
        csv: [`At most ${MAX_ROWS} rows per import — split the file`],
      });
    }

    const columns = headerRow.map((h) => HEADER_MAP[normaliseHeader(h)] ?? null);
    if (!columns.includes("name") || !columns.includes("phone")) {
      return err("Validation failed", 422, {
        csv: ["The file must have a Name column and a Phone column"],
      });
    }

    const cellOf = (row: string[], field: string): string => {
      const index = columns.indexOf(field);
      return index === -1 ? "" : (row[index] ?? "").trim();
    };

    const errors: RowError[] = [];
    const prepared: { line: number; input: ReturnType<typeof buildInput> }[] = [];
    // Catches duplicates WITHIN the file itself, which a per-row DB lookup cannot.
    const seenInFile = new Map<string, number>();

    function buildInput(row: string[]) {
      const { firstName, lastName } = splitName(cellOf(row, "name"));
      const upper = (v: string) => v.trim().toUpperCase().replace(/[\s-]/g, "_");

      const gender = upper(cellOf(row, "gender"));
      const customerType = upper(cellOf(row, "customerType"));
      const source = upper(cellOf(row, "source"));
      const dob = cellOf(row, "dateOfBirth");

      return {
        firstName,
        lastName,
        phone: cellOf(row, "phone"),
        alternatePhone: cellOf(row, "alternatePhone") || null,
        email: cellOf(row, "email") || null,
        gender: (CUSTOMER_GENDERS as readonly string[]).includes(gender)
          ? (gender as (typeof CUSTOMER_GENDERS)[number])
          : null,
        dateOfBirth: dob || null,
        address: cellOf(row, "address") || null,
        city: cellOf(row, "city") || null,
        state: cellOf(row, "state") || null,
        pincode: cellOf(row, "pincode") || null,
        customerType: (CUSTOMER_TYPES as readonly string[]).includes(customerType)
          ? (customerType as (typeof CUSTOMER_TYPES)[number])
          : undefined,
        entrySource: (CUSTOMER_SOURCES as readonly string[]).includes(source)
          ? (source as (typeof CUSTOMER_SOURCES)[number])
          : undefined,
      };
    }

    dataRows.forEach((row, index) => {
      const line = index + 2; // 1-based, and the header occupies line 1.
      const raw = buildInput(row);

      const parsed = CustomerCreateSchema.safeParse(raw);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          errors.push({
            row: line,
            field: String(issue.path[0] ?? "row"),
            message: issue.message,
          });
        }
        return;
      }

      const key = phoneKey(parsed.data.phone);
      const firstSeen = seenInFile.get(key);
      if (firstSeen !== undefined) {
        errors.push({
          row: line,
          field: "phone",
          message: `Duplicate of row ${firstSeen} in this file`,
        });
        return;
      }
      seenInFile.set(key, line);

      prepared.push({ line, input: raw });
    });

    // An import is all-or-nothing on VALIDITY: a half-imported file is worse than a
    // rejected one, because the operator cannot tell which half landed.
    if (errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `${errors.length} row(s) could not be imported`,
          data: { errors: errors.slice(0, 50), totalErrors: errors.length, imported: 0 },
        },
        { status: 422 }
      );
    }

    const branchId = scope.isGlobal ? null : scope.branchId;

    if (dryRun === true) {
      return ok(
        { valid: prepared.length, errors: [], imported: 0, dryRun: true },
        `${prepared.length} row(s) ready to import`
      );
    }

    const importedIds: string[] = [];
    const skipped: { row: number; reason: string }[] = [];

    for (const { line, input } of prepared) {
      const result = await createCustomer({
        input: { ...input, allowDuplicate: false },
        createdByUserId: user.userId,
        branchId,
        isManualEntry: true,
      });

      if (result.ok) {
        importedIds.push(result.customer.id);
        continue;
      }

      // A phone already in the database is a skip, not a failure — re-importing a
      // list that overlaps the existing book is the normal case.
      if (result.conflict === "DUPLICATE" && skipDuplicates !== false) {
        skipped.push({ row: line, reason: "Already exists" });
        continue;
      }

      skipped.push({ row: line, reason: result.message });
    }

    await writeAudit(user, {
      action: "IMPORT",
      module: MODULE,
      refId: null,
      refType: "Customer",
      newValue: {
        imported: importedIds.length,
        skipped: skipped.length,
        branchId,
      },
    });

    return ok(
      { imported: importedIds.length, skipped, errors: [] },
      skipped.length > 0
        ? `Imported ${importedIds.length} customer(s); ${skipped.length} skipped`
        : `Imported ${importedIds.length} customer(s)`
    );
  } catch {
    return err("Internal server error", 500);
  }
}
