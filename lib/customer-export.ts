// ============================================================================
// MODULE : Customers — export serialiser
//
// The column spec only. CSV and Excel mechanics come from lib/table-export.ts,
// shared with the attendance exports, so quoting and encoding behave identically
// in both downloads.
// ============================================================================

import {
  serialiseCsv,
  serialiseExcelXml,
  type ExportColumn,
} from "@/lib/table-export";
import { ageFromDob, customerName, type CustomerRecord } from "@/lib/customer-schema";

export type CustomerExportRow = {
  name: string;
  phone: string;
  alternatePhone: string;
  email: string;
  gender: string;
  dateOfBirth: string;
  age: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  branch: string;
  customerType: string;
  source: string;
  entryType: string;
  membership: string;
  visits: number;
  totalSpend: number;
  status: string;
  createdAt: string;
};

const COLUMNS: ExportColumn<CustomerExportRow>[] = [
  { header: "Name", key: "name", type: "text" },
  { header: "Phone", key: "phone", type: "text" },
  { header: "Alternate Phone", key: "alternatePhone", type: "text" },
  { header: "Email", key: "email", type: "text" },
  { header: "Gender", key: "gender", type: "text" },
  { header: "Date of Birth", key: "dateOfBirth", type: "text" },
  { header: "Age", key: "age", type: "text" },
  { header: "Address", key: "address", type: "text" },
  { header: "City", key: "city", type: "text" },
  { header: "State", key: "state", type: "text" },
  { header: "Pincode", key: "pincode", type: "text" },
  { header: "Branch", key: "branch", type: "text" },
  { header: "Customer Type", key: "customerType", type: "text" },
  { header: "Source", key: "source", type: "text" },
  { header: "Entry Type", key: "entryType", type: "text" },
  { header: "Membership", key: "membership", type: "text" },
  { header: "Visits", key: "visits", type: "number" },
  { header: "Total Spend", key: "totalSpend", type: "number" },
  { header: "Status", key: "status", type: "text" },
  { header: "Created", key: "createdAt", type: "text" },
];

export const CUSTOMER_EXPORT_HEADERS = COLUMNS.map((c) => c.header);

/** Turn an enum-ish token into a label: "PHONE_CALL" → "Phone Call". */
export function labelise(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

const isoDate = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

export function toCustomerExportRow(record: CustomerRecord): CustomerExportRow {
  const age = ageFromDob(record.dateOfBirth);
  const membership = record.memberships[0];

  return {
    name: customerName(record),
    phone: record.phone ?? "",
    alternatePhone: record.alternatePhone ?? "",
    email: record.email ?? "",
    gender: labelise(record.gender),
    dateOfBirth: isoDate(record.dateOfBirth),
    age: age === null ? "" : String(age),
    address: record.address ?? "",
    city: record.city ?? "",
    state: record.state ?? "",
    pincode: record.pincode ?? "",
    branch: record.branch?.name ?? "",
    customerType: labelise(record.customerType),
    source: labelise(record.entrySource),
    entryType: record.isManualEntry ? "Manual" : "Registered",
    membership: membership ? `${membership.plan.name} (${labelise(membership.plan.tier)})` : "",
    visits: record.totalVisits,
    totalSpend: record.totalSpend,
    status: record.deletedAt ? "Deleted" : record.isActive ? "Active" : "Inactive",
    createdAt: isoDate(record.createdAt),
  };
}

export function customersToCsv(rows: CustomerExportRow[]): string {
  return serialiseCsv(COLUMNS, rows);
}

export function customersToExcelXml(rows: CustomerExportRow[]): string {
  return serialiseExcelXml(COLUMNS, rows, "Customers");
}

/**
 * The header row an import file is expected to carry.
 *
 * Deliberately the same spelling as the EXPORT headers for the columns they share,
 * so the natural workflow — export, edit in Excel, re-import — works without the
 * user having to rename anything.
 */
export const IMPORT_TEMPLATE_HEADERS = [
  "Name",
  "Phone",
  "Alternate Phone",
  "Email",
  "Gender",
  "Date of Birth",
  "Address",
  "City",
  "State",
  "Pincode",
  "Customer Type",
  "Source",
] as const;
