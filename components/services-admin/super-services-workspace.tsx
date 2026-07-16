"use client";

// OWNER: Gauransh
// MODULE: Super Admin — Services (workspace)

// ============================================================================
// The Super Admin services dashboard: full platform management across two tabs —
// Services (add / edit / view / delete, search, filters, pagination) and Categories
// (add / edit / delete, search, pagination). No branch restrictions; every action
// reuses the existing admin endpoints.
// ============================================================================

import * as React from "react";
import { Tabs } from "./tabs";
import { ServicesManager } from "./services-manager";
import { CategoriesPanel } from "./categories-panel";
import type { ServiceCapabilities } from "./types";

export function SuperServicesWorkspace({ capabilities }: { capabilities: ServiceCapabilities }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Services</h1>
        <p className="mt-0.5 text-sm text-gray-500">Manage services and categories across the platform.</p>
      </div>

      <Tabs
        tabs={[
          { id: "services", label: "Services", content: <ServicesManager capabilities={capabilities} /> },
          { id: "categories", label: "Categories", content: <CategoriesPanel canManage={capabilities.manageCategories} /> },
        ]}
      />
    </div>
  );
}
