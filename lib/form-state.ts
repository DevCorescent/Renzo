// Shared form-state contract for Server Actions.
//
// This lives OUTSIDE the "use server" module on purpose. A file marked
// "use server" may export ONLY async functions — every export becomes a callable
// server endpoint. Exporting a plain object like IDLE_FORM_STATE from there is a
// violation of that contract, and the kind that breaks on a compiler upgrade
// rather than today. Types are erased and would be harmless, but keeping the type
// and its initial value together is what stops the two drifting.

export type FormState = {
  status: "idle" | "success" | "error";
  message: string;
  /** Field-level 422s, forwarded verbatim from the route's own validator. */
  errors: Record<string, string[]>;
};

export const IDLE_FORM_STATE: FormState = {
  status: "idle",
  message: "",
  errors: {},
};
