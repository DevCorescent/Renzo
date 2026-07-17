"use client";

// OWNER: Gauransh
// MODULE: Branch Admin — Services (workspace)

// ============================================================================
// The Branch Admin services experience, EXTENDED not replaced. Three tabs:
//   1. Branch Services — the preserved original branch-pricing workflow
//      (enable/disable per branch, branch-specific price, create branch service).
//   2. Manage Services — the shared services table (add, restricted edit, search,
//      filters, pagination) under the backend's RBAC (no delete for a branch admin).
//   3. Categories — the category catalogue (read-only for a branch admin, since the
//      backend restricts category writes to super/owner).
// Everything reuses existing endpoints; nothing about the pricing workflow changed.
// ============================================================================

import * as React from "react";
import { Tabs } from "@/components/services-admin/tabs";
import { ServicesManager } from "@/components/services-admin/services-manager";
import { CategoriesPanel } from "@/components/services-admin/categories-panel";
import { BranchPricingPanel } from "./branch-pricing-panel";
import type { ServiceCapabilities } from "@/components/services-admin/types";

export function BranchServicesWorkspace({ capabilities }: { capabilities: ServiceCapabilities }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Services</h1>
        <p className="mt-0.5 text-sm text-gray-500">Manage branch pricing, add services and browse categories.</p>
      </div>

      <Tabs
        tabs={[
          { id: "pricing", label: "Branch Services", content: <BranchPricingPanel /> },
          { id: "manage", label: "Manage Services", content: <ServicesManager capabilities={capabilities} /> },
          { id: "categories", label: "Categories", content: <CategoriesPanel canManage={capabilities.manageCategories} /> },
        ]}
      />
    </div>
  );
}
