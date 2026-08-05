// ============================================================================
// MODULE : Customers (reception)
// ROUTE  : /api/v1/reception/customers
//
// The front desk's door onto the SAME handlers /api/v1/admin/customers serves —
// re-exported, not re-implemented, exactly as the reception attendance route
// re-exports the shared attendance handlers. Branch scoping and the duplicate
// rules come along unchanged, and a receptionist still cannot force a duplicate
// (the shared POST refuses `allowDuplicate` for their role).
//
// It exists so the reception UI can call a URL under its own prefix, which keeps
// the endpoint map readable and matches how billing and appointments are laid out.
// ============================================================================

export { GET, POST } from "@/app/api/v1/admin/customers/route";
