"use client";

// ============================================================================
// MODULE : Customers — dialogs
//
// Walk-in quick entry, edit, delete and import. Built on the same Modal/field
// primitives as the attendance dialogs so the two modules look and behave
// identically — same reset-on-open pattern, same field/error rendering, same
// button styles.
//
// THE 30-SECOND PATH: only Name and Phone are required, and both sit at the top
// with autofocus on the name. Everything else is optional and can be filled in
// later from the profile. A receptionist can tab-tab-Enter while the customer is
// still walking to the chair.
// ============================================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  UserPlus,
  AlertTriangle,
  CalendarPlus,
  Upload,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { INDIA_STATES, citiesForState } from "@/lib/india-locations";
import {
  CUSTOMER_GENDERS,
  CUSTOMER_SOURCES,
  CUSTOMER_TYPES,
  ageFromDob,
  dateInputValue,
  labelise,
  type BranchOption,
  type CustomerRow,
  type DuplicateCustomer,
} from "@/components/customers/types";

// ── Shared field styling (mirrors components/attendance/attendance-dialogs.tsx) ──
const inputCls =
  "h-9 w-full rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-400 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text) dark:focus:border-white/30";
const labelCls =
  "mb-1 block text-xs font-medium text-gray-600 dark:text-(--sa-text-2)";
const btnPrimary =
  "inline-flex items-center gap-1.5 rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-white/90";
const btnGhost =
  "inline-flex items-center gap-1.5 rounded border border-gray-200 px-3 py-1.5 text-xs text-gray-600 transition hover:bg-gray-50 dark:border-(--sa-border) dark:text-(--sa-text-2) dark:hover:bg-white/5";
const btnDanger =
  "inline-flex items-center gap-1.5 rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-50";

type SubmitResult =
  | { ok: true; data: unknown }
  | { ok: false; message: string; errors: Record<string, string[]>; data: unknown };

async function submitJson(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown
): Promise<SubmitResult> {
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.success) {
      return {
        ok: false,
        message: json?.message ?? "Something went wrong",
        errors: json?.errors ?? {},
        data: json?.data ?? null,
      };
    }
    return { ok: true, data: json.data };
  } catch {
    return { ok: false, message: "Network error — please try again", errors: {}, data: null };
  }
}

function Modal({
  open,
  onClose,
  title,
  subtitle,
  wide,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "my-auto w-full rounded-lg border border-gray-200 bg-white p-5 shadow-xl dark:border-(--sa-border) dark:bg-(--sa-surface)",
          wide ? "max-w-3xl" : "max-w-lg"
        )}
      >
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-(--sa-text)">{title}</h2>
          {subtitle && (
            <p className="mt-0.5 text-xs text-gray-500 dark:text-(--sa-text-2)">{subtitle}</p>
          )}
        </div>
        {children}
      </div>
      {/* Click-away layer sits BEHIND the panel so a click inside never closes it. */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 -z-10 cursor-default"
      />
    </div>
  );
}

function FieldError({ errors, name }: { errors: Record<string, string[]>; name: string }) {
  const message = errors[name]?.[0];
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600 dark:text-red-400">{message}</p>;
}

function FormBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="mb-3 rounded border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
      {message}
    </p>
  );
}

// ============================================================================
// SHARED FORM BODY
// ============================================================================

type FormState = {
  firstName: string;
  lastName: string;
  phone: string;
  alternatePhone: string;
  email: string;
  gender: string;
  dateOfBirth: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  branchId: string;
  customerType: string;
  entrySource: string;
};

const EMPTY_FORM: FormState = {
  firstName: "",
  lastName: "",
  phone: "",
  alternatePhone: "",
  email: "",
  gender: "",
  dateOfBirth: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  branchId: "",
  customerType: "WALK_IN",
  entrySource: "WALK_IN",
};

/** Strip the empty strings the API would rather receive as null/absent. */
function toPayload(form: FormState, canChooseBranch: boolean) {
  const text = (v: string) => (v.trim() === "" ? null : v.trim());

  return {
    firstName: form.firstName.trim(),
    lastName: text(form.lastName),
    phone: form.phone.trim(),
    alternatePhone: text(form.alternatePhone),
    email: text(form.email),
    gender: form.gender === "" ? null : form.gender,
    dateOfBirth: text(form.dateOfBirth),
    address: text(form.address),
    city: text(form.city),
    state: text(form.state),
    pincode: text(form.pincode),
    customerType: form.customerType,
    entrySource: form.entrySource,
    ...(canChooseBranch ? { branchId: text(form.branchId) } : {}),
  };
}

function CustomerFields({
  form,
  setForm,
  errors,
  branches,
  canChooseBranch,
  autoFocusName,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  errors: Record<string, string[]>;
  branches: BranchOption[];
  canChooseBranch: boolean;
  autoFocusName?: boolean;
}) {
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Age is DERIVED from the DOB rather than stored: an age column is wrong the day
  // after it is written.
  const age = ageFromDob(form.dateOfBirth || null);
  const cities = form.state ? citiesForState(form.state) : [];

  return (
    <>
      {/* ── The only two required fields, first and together. ── */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="cust-first">
            Customer name <span className="text-red-500">*</span>
          </label>
          <input
            id="cust-first"
            value={form.firstName}
            onChange={(e) => set("firstName", e.target.value)}
            className={inputCls}
            placeholder="Priya"
            required
            maxLength={60}
            autoFocus={autoFocusName}
          />
          <FieldError errors={errors} name="firstName" />
        </div>
        <div>
          <label className={labelCls} htmlFor="cust-last">Last name</label>
          <input
            id="cust-last"
            value={form.lastName}
            onChange={(e) => set("lastName", e.target.value)}
            className={inputCls}
            placeholder="Sharma"
            maxLength={60}
          />
          <FieldError errors={errors} name="lastName" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="cust-phone">
            Mobile number <span className="text-red-500">*</span>
          </label>
          <input
            id="cust-phone"
            type="tel"
            inputMode="tel"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            className={inputCls}
            placeholder="9876543210"
            required
          />
          <FieldError errors={errors} name="phone" />
        </div>
        <div>
          <label className={labelCls} htmlFor="cust-alt">Alternate number</label>
          <input
            id="cust-alt"
            type="tel"
            inputMode="tel"
            value={form.alternatePhone}
            onChange={(e) => set("alternatePhone", e.target.value)}
            className={inputCls}
            placeholder="Optional"
          />
          <FieldError errors={errors} name="alternatePhone" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={labelCls} htmlFor="cust-gender">Gender</label>
          <select
            id="cust-gender"
            value={form.gender}
            onChange={(e) => set("gender", e.target.value)}
            className={inputCls}
          >
            <option value="">Not specified</option>
            {CUSTOMER_GENDERS.map((g) => (
              <option key={g} value={g}>{labelise(g)}</option>
            ))}
          </select>
          <FieldError errors={errors} name="gender" />
        </div>
        <div>
          <label className={labelCls} htmlFor="cust-dob">Date of birth</label>
          <input
            id="cust-dob"
            type="date"
            value={form.dateOfBirth}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => set("dateOfBirth", e.target.value)}
            className={inputCls}
          />
          <FieldError errors={errors} name="dateOfBirth" />
        </div>
        <div>
          <label className={labelCls} htmlFor="cust-age">Age</label>
          <input
            id="cust-age"
            value={age === null ? "" : `${age} years`}
            readOnly
            disabled
            className={cn(inputCls, "bg-gray-50 text-gray-500 dark:bg-white/5")}
            placeholder="From date of birth"
          />
        </div>
      </div>

      <div>
        <label className={labelCls} htmlFor="cust-email">Email</label>
        <input
          id="cust-email"
          type="email"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          className={inputCls}
          placeholder="Optional — walk-ins are never asked to verify an email"
        />
        <FieldError errors={errors} name="email" />
      </div>

      <div>
        <label className={labelCls} htmlFor="cust-address">Address</label>
        <input
          id="cust-address"
          value={form.address}
          onChange={(e) => set("address", e.target.value)}
          className={inputCls}
          maxLength={300}
          placeholder="Optional"
        />
        <FieldError errors={errors} name="address" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={labelCls} htmlFor="cust-state">State</label>
          <select
            id="cust-state"
            value={form.state}
            onChange={(e) => {
              // Changing state invalidates the chosen city, so clear it rather than
              // leaving a Karnataka city sitting under Maharashtra.
              setForm((prev) => ({ ...prev, state: e.target.value, city: "", pincode: "" }));
            }}
            className={inputCls}
          >
            <option value="">Select…</option>
            {INDIA_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <FieldError errors={errors} name="state" />
        </div>
        <div>
          <label className={labelCls} htmlFor="cust-city">City</label>
          {cities.length > 0 ? (
            <select
              id="cust-city"
              value={form.city}
              onChange={(e) => {
                const city = e.target.value;
                const match = cities.find((c) => c.name === city);
                setForm((prev) => ({
                  ...prev,
                  city,
                  // Prefill the pincode we know for that city; still editable.
                  pincode: match?.pincode ?? prev.pincode,
                }));
              }}
              className={inputCls}
            >
              <option value="">Select…</option>
              {cities.map((c) => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          ) : (
            <input
              id="cust-city"
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
              className={inputCls}
              placeholder="Select a state first"
            />
          )}
          <FieldError errors={errors} name="city" />
        </div>
        <div>
          <label className={labelCls} htmlFor="cust-pin">Pincode</label>
          <input
            id="cust-pin"
            inputMode="numeric"
            value={form.pincode}
            onChange={(e) => set("pincode", e.target.value)}
            className={inputCls}
            maxLength={6}
            placeholder="560001"
          />
          <FieldError errors={errors} name="pincode" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={labelCls} htmlFor="cust-type">Customer type</label>
          <select
            id="cust-type"
            value={form.customerType}
            onChange={(e) => set("customerType", e.target.value)}
            className={inputCls}
          >
            {CUSTOMER_TYPES.map((t) => (
              <option key={t} value={t}>{labelise(t)}</option>
            ))}
          </select>
          <FieldError errors={errors} name="customerType" />
        </div>
        <div>
          <label className={labelCls} htmlFor="cust-source">Source</label>
          <select
            id="cust-source"
            value={form.entrySource}
            onChange={(e) => set("entrySource", e.target.value)}
            className={inputCls}
          >
            {CUSTOMER_SOURCES.map((srcValue) => (
              <option key={srcValue} value={srcValue}>{labelise(srcValue)}</option>
            ))}
          </select>
          <FieldError errors={errors} name="entrySource" />
        </div>
        <div>
          <label className={labelCls} htmlFor="cust-branch">Branch</label>
          {canChooseBranch ? (
            <select
              id="cust-branch"
              value={form.branchId}
              onChange={(e) => set("branchId", e.target.value)}
              className={inputCls}
            >
              <option value="">No specific branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          ) : (
            <input
              id="cust-branch"
              value={branches[0]?.name ?? "Your branch"}
              readOnly
              disabled
              className={cn(inputCls, "bg-gray-50 text-gray-500 dark:bg-white/5")}
            />
          )}
          <FieldError errors={errors} name="branchId" />
        </div>
      </div>
    </>
  );
}

// ============================================================================
// EXISTING-CUSTOMER PROMPT
// ============================================================================

/**
 * Shown when the phone already belongs to someone.
 *
 * The point is to give the front desk somewhere to GO — open the profile, or book
 * straight away — rather than a red error they will work around by inventing a
 * digit. "Create anyway" is offered only to roles that may force a duplicate.
 */
function DuplicatePrompt({
  existing,
  profileHref,
  bookingHref,
  onCreateAnyway,
  busy,
}: {
  existing: DuplicateCustomer;
  profileHref: string;
  bookingHref: string | null;
  onCreateAnyway: (() => void) | null;
  busy: boolean;
}) {
  const name = `${existing.firstName} ${existing.lastName ?? ""}`.trim();

  return (
    <div className="rounded border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/25 dark:bg-amber-500/10">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-900 dark:text-amber-300">
        <AlertTriangle className="size-3.5" aria-hidden="true" />
        Existing customer found
      </p>
      <p className="mt-1.5 text-sm text-gray-800 dark:text-(--sa-text)">{name}</p>
      <p className="text-xs text-gray-500 dark:text-(--sa-text-2)">
        {existing.phone}
        {existing.branch ? ` · ${existing.branch.name}` : ""} · {existing.totalVisits} visit
        {existing.totalVisits === 1 ? "" : "s"}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={profileHref} className={btnPrimary}>
          Open profile
        </Link>
        {bookingHref && (
          <Link href={bookingHref} className={btnGhost}>
            <CalendarPlus className="size-3.5" aria-hidden="true" />
            Book appointment
          </Link>
        )}
        {onCreateAnyway && (
          <button type="button" onClick={onCreateAnyway} disabled={busy} className={btnGhost}>
            {busy && <Loader2 className="size-3.5 animate-spin" />}
            Create new anyway
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// CREATE (WALK-IN QUICK ENTRY)
// ============================================================================

export function NewCustomerDialog({
  open,
  onClose,
  endpoint,
  branches,
  capability,
  profileBasePath,
  bookingPath,
}: {
  open: boolean;
  onClose: () => void;
  /** API.admin.customers or API.reception.customers. */
  endpoint: string;
  branches: BranchOption[];
  capability: { canChooseBranch: boolean; canForceDuplicate: boolean };
  /** e.g. "/super-admin/customers" — the duplicate prompt links here. */
  profileBasePath: string;
  /** Where "Book appointment" goes, or null for roles without a booking screen. */
  bookingPath: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [banner, setBanner] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [duplicate, setDuplicate] = React.useState<DuplicateCustomer | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);

  // Render-phase reset on open — the pattern the attendance dialogs use, which
  // avoids painting a stale form for one frame the way an effect would.
  const [wasOpen, setWasOpen] = React.useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setForm(EMPTY_FORM);
      setBanner(null);
      setErrors({});
      setDuplicate(null);
    }
  }

  async function send(allowDuplicate: boolean) {
    setBusy(true);
    setBanner(null);
    setErrors({});

    const result = await submitJson(endpoint, "POST", {
      ...toPayload(form, capability.canChooseBranch),
      ...(allowDuplicate ? { allowDuplicate: true } : {}),
    });

    setBusy(false);

    if (!result.ok) {
      const payload = result.data as { existing?: DuplicateCustomer } | null;
      if (payload?.existing) {
        setDuplicate(payload.existing);
        return;
      }
      setBanner(result.message);
      setErrors(result.errors);
      return;
    }

    router.refresh();
    onClose();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    await send(false);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="New walk-in customer"
      subtitle="Name and mobile number are all that is needed — everything else can wait."
    >
      <form onSubmit={submit} className="space-y-3">
        <FormBanner message={banner} />

        {duplicate && (
          <DuplicatePrompt
            existing={duplicate}
            profileHref={`${profileBasePath}/${duplicate.id}`}
            bookingHref={bookingPath}
            onCreateAnyway={
              capability.canForceDuplicate ? () => void send(true) : null
            }
            busy={busy}
          />
        )}

        <CustomerFields
          form={form}
          setForm={setForm}
          errors={errors}
          branches={branches}
          canChooseBranch={capability.canChooseBranch}
          autoFocusName
        />

        <p className="text-xs text-gray-400 dark:text-(--sa-muted)">
          Recorded as a manual entry against your name. Walk-ins are not asked to verify an
          email and can be booked immediately.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
          <button type="submit" disabled={busy} className={btnPrimary}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />}
            {busy ? "Saving…" : "Create customer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================================
// EDIT
// ============================================================================

export function EditCustomerDialog({
  customer,
  onClose,
  endpointBase,
  branches,
  canChooseBranch,
}: {
  customer: CustomerRow | null;
  onClose: () => void;
  /** Base URL; the id is appended. */
  endpointBase: string;
  branches: BranchOption[];
  canChooseBranch: boolean;
}) {
  const router = useRouter();
  const open = customer !== null;

  const [busy, setBusy] = React.useState(false);
  const [banner, setBanner] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);

  // Re-seed whenever a DIFFERENT customer opens the dialog.
  const [loadedId, setLoadedId] = React.useState<string | null>(null);
  if (customer && customer.id !== loadedId) {
    setLoadedId(customer.id);
    setForm({
      firstName: customer.firstName,
      lastName: customer.lastName ?? "",
      phone: customer.phone ?? "",
      alternatePhone: customer.alternatePhone ?? "",
      email: customer.email ?? "",
      gender: customer.gender ?? "",
      dateOfBirth: dateInputValue(customer.dateOfBirth),
      address: customer.address ?? "",
      city: customer.city ?? "",
      state: customer.state ?? "",
      pincode: customer.pincode ?? "",
      branchId: customer.branch?.id ?? "",
      customerType: customer.customerType,
      entrySource: customer.entrySource,
    });
    setBanner(null);
    setErrors({});
  } else if (!customer && loadedId !== null) {
    setLoadedId(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !customer) return;

    setBusy(true);
    setBanner(null);
    setErrors({});

    const result = await submitJson(
      `${endpointBase}/${customer.id}`,
      "PATCH",
      toPayload(form, canChooseBranch)
    );

    setBusy(false);

    if (!result.ok) {
      setBanner(result.message);
      setErrors(result.errors);
      return;
    }

    router.refresh();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Edit customer"
      subtitle={customer ? `${customer.firstName} ${customer.lastName ?? ""}`.trim() : undefined}
    >
      {customer && (
        <form onSubmit={submit} className="space-y-3">
          <FormBanner message={banner} />

          <CustomerFields
            form={form}
            setForm={setForm}
            errors={errors}
            branches={branches}
            canChooseBranch={canChooseBranch}
          />

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
            <button type="submit" disabled={busy} className={btnPrimary}>
              {busy && <Loader2 className="size-3.5 animate-spin" />}
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

// ============================================================================
// DELETE (SOFT)
// ============================================================================

export function DeleteCustomerDialog({
  customer,
  onClose,
  endpointBase,
}: {
  customer: CustomerRow | null;
  onClose: () => void;
  endpointBase: string;
}) {
  const router = useRouter();
  const open = customer !== null;

  const [busy, setBusy] = React.useState(false);
  const [banner, setBanner] = React.useState<string | null>(null);

  async function confirm() {
    if (busy || !customer) return;
    setBusy(true);
    setBanner(null);

    const result = await submitJson(`${endpointBase}/${customer.id}`, "DELETE");
    setBusy(false);

    if (!result.ok) {
      setBanner(result.message);
      return;
    }

    router.refresh();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Delete customer">
      {customer && (
        <div className="space-y-3">
          <FormBanner message={banner} />

          <p className="text-sm text-gray-700 dark:text-(--sa-text)">
            Remove <strong>{`${customer.firstName} ${customer.lastName ?? ""}`.trim()}</strong>{" "}
            from the active customer list?
          </p>
          <p className="rounded border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:border-(--sa-border) dark:bg-white/5 dark:text-(--sa-text-2)">
            This is a soft delete. Their {customer._count.appointments} appointment
            {customer._count.appointments === 1 ? "" : "s"}, invoices and loyalty history are
            kept — the record is only hidden from the active list and can be restored.
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className={btnGhost}>Cancel</button>
            <button type="button" onClick={confirm} disabled={busy} className={btnDanger}>
              {busy && <Loader2 className="size-3.5 animate-spin" />}
              {busy ? "Deleting…" : "Delete customer"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ============================================================================
// IMPORT
// ============================================================================

export function ImportCustomersDialog({
  open,
  onClose,
  endpoint,
}: {
  open: boolean;
  onClose: () => void;
  endpoint: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [banner, setBanner] = React.useState<string | null>(null);
  const [okMessage, setOkMessage] = React.useState<string | null>(null);
  const [rowErrors, setRowErrors] = React.useState<
    { row: number; field: string; message: string }[]
  >([]);
  const [csv, setCsv] = React.useState("");
  const [fileName, setFileName] = React.useState<string | null>(null);

  const [wasOpen, setWasOpen] = React.useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setCsv("");
      setFileName(null);
      setBanner(null);
      setOkMessage(null);
      setRowErrors([]);
    }
  }

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setCsv(await file.text());
    setBanner(null);
    setRowErrors([]);
  }

  async function run(dryRun: boolean) {
    if (busy) return;
    if (csv.trim() === "") {
      setBanner("Choose a CSV file or paste its contents first.");
      return;
    }

    setBusy(true);
    setBanner(null);
    setOkMessage(null);
    setRowErrors([]);

    const result = await submitJson(endpoint, "POST", { csv, dryRun, skipDuplicates: true });
    setBusy(false);

    if (!result.ok) {
      const payload = result.data as
        | { errors?: { row: number; field: string; message: string }[] }
        | null;
      setBanner(result.message);
      setRowErrors(payload?.errors ?? []);
      return;
    }

    const payload = result.data as { imported: number } | null;
    setOkMessage(
      dryRun
        ? "File looks good — press Import to write these customers."
        : `Imported ${payload?.imported ?? 0} customer(s).`
    );
    if (!dryRun) router.refresh();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Import customers"
      subtitle="CSV only. In Excel or Google Sheets use File → Save As / Download → CSV."
    >
      <div className="space-y-3">
        <FormBanner message={banner} />
        {okMessage && (
          <p className="rounded border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
            {okMessage}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <label className={cn(btnGhost, "cursor-pointer")}>
            <Upload className="size-3.5" aria-hidden="true" />
            {fileName ?? "Choose CSV file"}
            <input type="file" accept=".csv,text/csv" onChange={pickFile} className="hidden" />
          </label>
          <a href={endpoint} className={btnGhost} download>
            <Download className="size-3.5" aria-hidden="true" />
            Download template
          </a>
        </div>

        <div>
          <label className={labelCls} htmlFor="import-csv">Or paste CSV</label>
          <textarea
            id="import-csv"
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={6}
            className={cn(inputCls, "h-auto py-2 font-mono text-xs")}
            placeholder="Name,Phone,Email,…"
          />
        </div>

        {rowErrors.length > 0 && (
          <div className="max-h-48 overflow-y-auto rounded border border-red-100 bg-red-50 p-2 dark:border-red-500/20 dark:bg-red-500/10">
            <p className="mb-1 text-xs font-semibold text-red-800 dark:text-red-300">
              Fix these rows and try again
            </p>
            <ul className="space-y-0.5">
              {rowErrors.map((e, i) => (
                <li key={`${e.row}-${e.field}-${i}`} className="text-xs text-red-700 dark:text-red-300">
                  Row {e.row} · {e.field}: {e.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs text-gray-400 dark:text-(--sa-muted)">
          Rows whose phone number already exists are skipped, not duplicated. Validate first to
          check the file without writing anything.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={btnGhost}>Close</button>
          <button type="button" onClick={() => void run(true)} disabled={busy} className={btnGhost}>
            {busy && <Loader2 className="size-3.5 animate-spin" />}
            Validate
          </button>
          <button type="button" onClick={() => void run(false)} disabled={busy} className={btnPrimary}>
            {busy && <Loader2 className="size-3.5 animate-spin" />}
            Import
          </button>
        </div>
      </div>
    </Modal>
  );
}
