"use client";

// ============================================================================
// Worker admission form.
//
// Form state is React 19's useActionState + useFormStatus. React Hook Form is not
// installed, and would earn nothing here: the platform already gives us pending
// state, progressive enhancement and a FormData submission.
//
// VALIDATION — TWO LAYERS, AND THEY ARE NOT EQUALS
//   1. WorkerAdmissionSchema (zod) runs in the browser, so a malformed phone
//      number is caught before a round trip.
//   2. POST /api/v1/admin/workers re-validates and its 422s render verbatim.
// The route is the gate; the schema is a courtesy. Where they overlap, the server
// wins and the user is shown the truth.
//
// ⚠️ TWO RULES THE ROUTE DOES NOT ENFORCE: `joinDate` is required here, and the
// worker must be 18. POST /admin/workers currently accepts BOTH dateOfBirth and
// joinDate as OPTIONAL and has no age check — so these two are enforced ONLY in
// the browser and a crafted request can still bypass them. They are business
// rules, and a business rule that lives in a client bundle is not enforced. The
// route needs the same checks; that is a backend change and was not authorised.
//
// branchId is NEVER rendered and NEVER submitted. The route resolves the branch
// from the caller's JWT for a BRANCH_ADMIN and ignores the body — so a branch
// admin cannot admit a worker into another branch even by editing the DOM.
// ============================================================================

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/shared/ui";
import { ImageUpload } from "@/components/shared/image-upload";
import { validateAdmission, MIN_WORKER_AGE } from "@/lib/worker-form-schema";
import { createWorkerAction } from "@/app/branch-admin/workers/actions";
import { IDLE_FORM_STATE, type FormState } from "@/lib/form-state";
import { cn } from "@/lib/utils";

type Option = { id: string; name: string };

const inputCls =
  "h-9 w-full rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-900 " +
  "outline-none transition placeholder:text-gray-300 " +
  "focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5 " +
  "disabled:cursor-not-allowed disabled:bg-gray-50";

const invalidCls = "border-red-300 focus:border-red-400 focus:ring-red-500/10";

/* ─── Field ────────────────────────────────────────────────────────────────── */

function Field({
  name,
  label,
  errors,
  required,
  hint,
  className,
  children,
}: {
  name: string;
  label: string;
  errors: Record<string, string[]>;
  required?: boolean;
  hint?: string;
  className?: string;
  children: (props: { id: string; invalid: boolean; describedBy?: string }) => React.ReactNode;
}) {
  const messages = errors[name];
  const invalid = Boolean(messages?.length);
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;

  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={name} className="block text-xs font-medium text-gray-700">
        {label}
        {required && (
          <span className="ml-0.5 text-red-500" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {children({
        id: name,
        invalid,
        describedBy: invalid ? errorId : hint ? hintId : undefined,
      })}

      {hint && !invalid && (
        <p id={hintId} className="text-[11px] text-gray-400">
          {hint}
        </p>
      )}

      {messages?.map((message) => (
        <p key={message} id={errorId} role="alert" className="text-[11px] text-red-600">
          {message}
        </p>
      ))}
    </div>
  );
}

function Section({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="block">
        <CardTitle className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-flex size-5 items-center justify-center rounded-full bg-gray-100 text-[10px] font-semibold text-gray-500"
          >
            {step}
          </span>
          {title}
        </CardTitle>
        {description && <p className="mt-1 text-[11px] text-gray-400">{description}</p>}
      </CardHeader>
      <CardBody className="space-y-4">{children}</CardBody>
    </Card>
  );
}

/* ─── Submit ───────────────────────────────────────────────────────────────── */
// useFormStatus reads the nearest parent <form>, so it must live in a CHILD of the
// form — it cannot be read in the component that renders it. `pending` is also
// what prevents a double submission: the button is disabled for the whole flight.

function Actions() {
  const { pending } = useFormStatus();

  return (
    <div className="flex items-center justify-end gap-2 pb-2">
      <Link
        href="/branch-admin/workers"
        aria-disabled={pending}
        className={cn(
          "inline-flex h-9 items-center rounded border border-gray-200 bg-white px-3 text-sm text-gray-600 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/10",
          pending && "pointer-events-none opacity-50"
        )}
      >
        Cancel
      </Link>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-9 items-center rounded bg-gray-900 px-4 text-sm font-medium text-white transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create worker"}
      </button>
    </div>
  );
}

/* ─── Form ─────────────────────────────────────────────────────────────────── */

export function WorkerForm({
  designations,
  departments,
  maxDateOfBirth,
  today,
}: {
  /**
   * Empty for a BRANCH_ADMIN: GET /admin/designations and /admin/departments are
   * SUPER_ADMIN/OWNER only, so a branch admin has no API to read them from. Both
   * are optional on POST, so the selects are HIDDEN rather than rendered empty and
   * unusable. Widening those two routes is all it would take to light them up —
   * nothing here would need to change.
   */
  designations: Option[];
  departments: Option[];
  /**
   * Both computed on the SERVER and passed down. Calling new Date() during a
   * client render would produce a different value than the server did if the
   * request straddles midnight, and React would report a hydration mismatch.
   */
  maxDateOfBirth: string;
  today: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    createWorkerAction,
    IDLE_FORM_STATE
  );

  const [clientErrors, setClientErrors] = React.useState<Record<string, string[]>>({});
  const [photo, setPhoto] = React.useState<string | null>(null);

  // Server errors win. They are the authoritative ones, and a stale client message
  // must never mask what the route actually said.
  const errors = { ...clientErrors, ...state.errors };

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const result = validateAdmission(new FormData(form));

    if (result.ok) {
      setClientErrors({});
      return;
    }

    // Cancels the Server Action for this submit — React runs onSubmit first, and a
    // preventDefault here stops the action ever firing.
    event.preventDefault();
    setClientErrors(result.errors);

    // Focus the first offending input. An error announced but not reachable is no
    // better than no error at all for a keyboard or screen-reader user.
    const firstInvalid = Object.keys(result.errors)[0];
    form.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)?.focus();
  }

  const nonFieldError =
    state.status === "error" && Object.keys(state.errors).length === 0 ? state.message : null;

  return (
    <form action={formAction} onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* A 409 on a duplicate employee code or phone, a 403, a 500, an unreachable
          server — anything the route reported that belongs to no single field. */}
      {nonFieldError && (
        <p
          role="alert"
          className="rounded border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          {nonFieldError}
        </p>
      )}

      {/* ── 1. Personal ───────────────────────────────────────────────────── */}
      <Section step={1} title="Personal information">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="firstName" label="First name" errors={errors} required>
            {({ id, invalid, describedBy }) => (
              <input
                id={id}
                name={id}
                autoComplete="off"
                aria-invalid={invalid}
                aria-describedby={describedBy}
                className={cn(inputCls, invalid && invalidCls)}
              />
            )}
          </Field>

          <Field name="lastName" label="Last name" errors={errors} required>
            {({ id, invalid, describedBy }) => (
              <input
                id={id}
                name={id}
                autoComplete="off"
                aria-invalid={invalid}
                aria-describedby={describedBy}
                className={cn(inputCls, invalid && invalidCls)}
              />
            )}
          </Field>

          <Field
            name="displayName"
            label="Display name"
            errors={errors}
            hint="Shown publicly instead of their full name, if set."
          >
            {({ id, invalid, describedBy }) => (
              <input
                id={id}
                name={id}
                autoComplete="off"
                aria-invalid={invalid}
                aria-describedby={describedBy}
                className={cn(inputCls, invalid && invalidCls)}
              />
            )}
          </Field>

          {/* Exactly the Gender enum in the Prisma schema. */}
          <Field name="gender" label="Gender" errors={errors} required>
            {({ id, invalid, describedBy }) => (
              <select
                id={id}
                name={id}
                defaultValue=""
                aria-invalid={invalid}
                aria-describedby={describedBy}
                className={cn(inputCls, invalid && invalidCls)}
              >
                <option value="" disabled>
                  Select…
                </option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="UNISEX">Unisex</option>
              </select>
            )}
          </Field>

          <Field
            name="dateOfBirth"
            label="Date of birth"
            errors={errors}
            required
            hint={`Must be at least ${MIN_WORKER_AGE} years old.`}
            className="sm:col-span-2"
          >
            {({ id, invalid, describedBy }) => (
              <input
                id={id}
                name={id}
                type="date"
                // The picker itself refuses an under-18 date, so the rule is visible
                // before submit rather than only after it. The schema still checks —
                // `max` is a courtesy the DOM can be talked out of.
                max={maxDateOfBirth}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                className={cn(inputCls, invalid && invalidCls)}
              />
            )}
          </Field>
        </div>

        {/* ImageUpload posts to /api/v1/upload and hands back the R2 URL. The URL
            rides a hidden input so it travels in the same FormData as everything
            else — the Server Action never has to know an upload happened. */}
        <ImageUpload value={photo} onChange={setPhoto} label="Profile photo" />
        <input type="hidden" name="profilePhoto" value={photo ?? ""} />
      </Section>

      {/* ── 2. Contact ────────────────────────────────────────────────────── */}
      <Section step={2} title="Contact">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="phone"
            label="Phone"
            errors={errors}
            required
            hint="10–15 digits. This is their sign-in ID."
          >
            {({ id, invalid, describedBy }) => (
              <input
                id={id}
                name={id}
                type="tel"
                inputMode="tel"
                autoComplete="off"
                aria-invalid={invalid}
                aria-describedby={describedBy}
                className={cn(inputCls, invalid && invalidCls)}
              />
            )}
          </Field>

          <Field name="email" label="Email" errors={errors}>
            {({ id, invalid, describedBy }) => (
              <input
                id={id}
                name={id}
                type="email"
                autoComplete="off"
                aria-invalid={invalid}
                aria-describedby={describedBy}
                className={cn(inputCls, invalid && invalidCls)}
              />
            )}
          </Field>
        </div>
      </Section>

      {/* ── 3. Employment ─────────────────────────────────────────────────── */}
      <Section step={3} title="Employment">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="employeeCode"
            label="Employee code"
            errors={errors}
            required
            hint="Unique across the platform."
          >
            {({ id, invalid, describedBy }) => (
              <input
                id={id}
                name={id}
                autoComplete="off"
                aria-invalid={invalid}
                aria-describedby={describedBy}
                className={cn(inputCls, "font-mono uppercase", invalid && invalidCls)}
              />
            )}
          </Field>

          <Field name="joinDate" label="Joining date" errors={errors} required>
            {({ id, invalid, describedBy }) => (
              <input
                id={id}
                name={id}
                type="date"
                defaultValue={today}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                className={cn(inputCls, invalid && invalidCls)}
              />
            )}
          </Field>

          <Field name="experience" label="Experience (years)" errors={errors}>
            {({ id, invalid, describedBy }) => (
              <input
                id={id}
                name={id}
                type="number"
                min={0}
                step={1}
                defaultValue={0}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                className={cn(inputCls, invalid && invalidCls)}
              />
            )}
          </Field>

          {designations.length > 0 && (
            <Field name="designationId" label="Designation" errors={errors}>
              {({ id, invalid, describedBy }) => (
                <select
                  id={id}
                  name={id}
                  defaultValue=""
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  className={cn(inputCls, invalid && invalidCls)}
                >
                  <option value="">None</option>
                  {designations.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}

          {departments.length > 0 && (
            <Field name="departmentId" label="Department" errors={errors}>
              {({ id, invalid, describedBy }) => (
                <select
                  id={id}
                  name={id}
                  defaultValue=""
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  className={cn(inputCls, invalid && invalidCls)}
                >
                  <option value="">None</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}
        </div>

        {designations.length === 0 && departments.length === 0 && (
          <p className="text-[11px] text-gray-400">
            Designation and department can be set later — a branch admin cannot read
            those lists yet.
          </p>
        )}
      </Section>

      {/* ── 4. Account ────────────────────────────────────────────────────── */}
      <Section
        step={4}
        title="Account"
        description="The worker signs in with the phone number above and this password."
      >
        <Field
          name="password"
          label="Password"
          errors={errors}
          required
          hint="At least 6 characters. They can change it after signing in."
          className="sm:max-w-sm"
        >
          {({ id, invalid, describedBy }) => (
            <input
              id={id}
              name={id}
              type="password"
              autoComplete="new-password"
              aria-invalid={invalid}
              aria-describedby={describedBy}
              className={cn(inputCls, invalid && invalidCls)}
            />
          )}
        </Field>
      </Section>

      {/* ── 5. Professional ───────────────────────────────────────────────── */}
      <Section step={5} title="Professional">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="languages"
            label="Languages"
            errors={errors}
            hint="Comma separated — Hindi, English"
          >
            {({ id, invalid, describedBy }) => (
              <input
                id={id}
                name={id}
                autoComplete="off"
                aria-invalid={invalid}
                aria-describedby={describedBy}
                className={cn(inputCls, invalid && invalidCls)}
              />
            )}
          </Field>

          <Field name="certificates" label="Certificates" errors={errors} hint="Comma separated">
            {({ id, invalid, describedBy }) => (
              <input
                id={id}
                name={id}
                autoComplete="off"
                aria-invalid={invalid}
                aria-describedby={describedBy}
                className={cn(inputCls, invalid && invalidCls)}
              />
            )}
          </Field>
        </div>

        <Field name="bio" label="Bio" errors={errors}>
          {({ id, invalid, describedBy }) => (
            <textarea
              id={id}
              name={id}
              rows={3}
              aria-invalid={invalid}
              aria-describedby={describedBy}
              className={cn(inputCls, "h-auto py-2", invalid && invalidCls)}
            />
          )}
        </Field>
      </Section>

      {/* ── 6. Visibility ─────────────────────────────────────────────────── */}
      <Section step={6} title="Visibility">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            name="isPublic"
            className="mt-0.5 size-3.5 rounded border-gray-300 text-gray-900 focus:ring-gray-900/20"
          />
          <span className="text-xs text-gray-600">
            Show on the public stylist page
            <span className="block text-[11px] text-gray-400">
              Off by default. Portfolio work still needs approving separately before it
              appears.
            </span>
          </span>
        </label>
      </Section>

      <Actions />
    </form>
  );
}
