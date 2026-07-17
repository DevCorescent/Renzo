"use client";

// OWNER: Gauransh
// MODULE: Marketing — Campaign row actions
// PURPOSE: Per-campaign three-dot menu — View / Edit / Deactivate|Activate.
//          Edit shows only while the campaign is still editable (DRAFT/SCHEDULED);
//          the toggle flips DRAFT⇄SCHEDULED via status. There is NO campaign DELETE
//          route, so no Delete item is offered.

import * as React from "react";
import { Menu } from "@base-ui/react/menu";
import { MoreVertical, Eye, Pencil, Power, PowerOff } from "lucide-react";
import { isEditable, canToggle, type CampaignRow } from "./types";

const itemCls =
  "flex w-full cursor-default items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 outline-none transition select-none data-[highlighted]:bg-gray-50 data-[highlighted]:text-gray-900";

export function CampaignRowActions({
  campaign, onView, onEdit, onToggle,
}: {
  campaign: CampaignRow;
  onView: (c: CampaignRow) => void;
  onEdit: (c: CampaignRow) => void;
  onToggle: (c: CampaignRow) => void;
}) {
  const editable = isEditable(campaign.status);
  const toggleable = canToggle(campaign.status);
  const isActiveish = campaign.status === "SCHEDULED" || campaign.status === "RUNNING";
  return (
    <Menu.Root>
      <Menu.Trigger aria-label="Campaign actions" className="inline-flex size-8 items-center justify-center rounded text-gray-400 outline-none transition hover:bg-gray-100 hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-gray-900/10 data-[popup-open]:bg-gray-100 data-[popup-open]:text-gray-700">
        <MoreVertical className="size-4" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={4} className="z-50">
          <Menu.Popup className="min-w-40 rounded-md border border-gray-200 bg-white py-1 shadow-sm outline-none">
            <Menu.Item className={itemCls} onClick={() => onView(campaign)}><Eye className="size-3.5 text-gray-400" aria-hidden="true" /> View</Menu.Item>
            {editable && <Menu.Item className={itemCls} onClick={() => onEdit(campaign)}><Pencil className="size-3.5 text-gray-400" aria-hidden="true" /> Edit</Menu.Item>}
            {toggleable && (
              <Menu.Item className={itemCls} onClick={() => onToggle(campaign)}>
                {isActiveish ? <><PowerOff className="size-3.5 text-gray-400" aria-hidden="true" /> Deactivate</> : <><Power className="size-3.5 text-gray-400" aria-hidden="true" /> Activate</>}
              </Menu.Item>
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
