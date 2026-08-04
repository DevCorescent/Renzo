# Branch tenancy

Renzo is a multi-branch salon chain. Every branch's takings, customers, roster and
reputation belong to that branch. This document records how that boundary is
enforced, and — more usefully — the two ways it kept being broken.

## Two gates, not one

`requireAuth()` answers **"is your ROLE allowed on this route?"**
`requireBranchScope()` answers **"which BRANCH are you allowed to touch?"**

Passing the first and skipping the second is the entire bug class below. A branch
admin is *supposed* to reach `/admin/invoices` — that is what makes the missing
second gate so easy to miss in review.

```ts
const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
if (error) return error;

const { scope, error: scopeError } = requireBranchScope(user, url);
if (scopeError) return scopeError;

const where = { ...branchWhere(scope), status: "PENDING" };
```

Role classification lives in one `Record<UserType, ScopeKind>` in
`lib/branch-scope.ts`, so adding a role to `UserType` and forgetting to classify
it fails the build rather than silently defaulting to global.

## Failure mode 1 — the query-param filter

```ts
const branchId = url.searchParams.get("branchId");
const where = { ...(branchId ? { branchId } : {}) };   // ← omit it, see everything
```

Two holes in three lines: **omit** the parameter and there is no filter at all;
**name someone else's branch** and you get theirs. Both were live. A branch admin
listing `/admin/appointments` with no parameter saw all 28 appointments in the
business rather than their own 7.

The fix is always the same shape:

```ts
const where = { ...branchWhere(scope) };
```

`branchWhere()` returns a concrete filter for a branch-scoped caller and `{}`
only for a global one, so `?branchId=` still narrows for a Super Admin and is
ignored for everyone else.

### Nullable branchId means "all branches"

`Offer.branchId` is nullable, where null means the promotion runs business-wide.
Plain `branchWhere()` would hide those from the branch that has to honour them,
so offers scope with an explicit OR:

```ts
scope.branchId ? { OR: [{ branchId: scope.branchId }, { branchId: null }] } : {}
```

`Customer.branchId` is the same shape, for a different reason: rows created
before the column existed have null, and a customer who first visited one branch
must still be findable at another.

## Failure mode 2 — the unchecked id (IDOR)

A list can be perfectly scoped while the detail route beside it is wide open:

```ts
const invoice = await prisma.invoice.findUnique({ where: { id } });
if (!invoice) return err("Invoice not found", 404);
return ok(invoice);                                    // ← whose invoice?
```

Ids travel — in URLs, in PDFs, in support tickets. Knowing one must not be enough
to act on it. This affected invoice read/update, **invoice refund**, appointment
status, appointment assign, review approve/reject, and branch timings. The refund
one was the worst: any branch admin holding an invoice id could refund another
branch's takings.

```ts
if (!invoice || (!scope.isGlobal && invoice.branchId !== scope.branchId)) {
  return err("Invoice not found", 404);
}
```

### Always 404, never 403

A 403 says *"this exists, but not for you"* — which turns the endpoint into an
existence oracle for id enumeration. 404 says nothing. Every branch check in this
codebase answers 404, and the message matches the genuine not-found message
exactly so the two are indistinguishable.

### Check every side

`/admin/appointments/[id]/assign` touches two branch-owned things. Guarding only
the appointment still lets a desk roster a stylist who does not work there;
guarding only the worker still lets them staff another branch's booking. Both are
checked — the worker through `denyIfWorkerOutOfScope()`, because `WorkerProfile`
has no `branchId` column and membership lives in the `WorkerBranch` join table.

## Proving it

`branchWhere` appearing in a file is not evidence the route is scoped. The check
that counts is behavioural: log in as a branch admin, call the endpoint with no
parameter, and compare against a super admin's answer. If they match while the
branch's own slice is smaller, the branch admin is reading the whole business.

That comparison is worth re-running whenever a list or detail route is added.
