// ============================================================================
// OWNER  : Gauransh
// MODULE : Homepage CMS — icon registry
//
// Content stored in the CMS is JSON, so it can never hold a React component. It
// holds a NAME from a fixed whitelist, and this file is the only place that turns
// a name back into an icon. Authors therefore pick from a curated set; they can
// never inject an arbitrary component or break a render with a typo.
// ============================================================================

import {
  Scissors,
  Droplets,
  Flower2,
  Brush,
  Wand2,
  Sparkles,
  Gem,
  Star,
  Heart,
  Crown,
  Leaf,
  Sun,
  Camera,
  MessageCircle,
  Share2,
  Play,
  AtSign,
  type LucideIcon,
} from "lucide-react";

import type { IconName, SocialIconName } from "./schema";

export const CMS_ICONS: Record<IconName, LucideIcon> = {
  Scissors,
  Droplets,
  Flower2,
  Brush,
  Wand2,
  Sparkles,
  Gem,
  Star,
  Heart,
  Crown,
  Leaf,
  Sun,
};

/** Never throws — an unknown name (older row, hand-edited JSON) falls back. */
export function cmsIcon(name: string): LucideIcon {
  return CMS_ICONS[name as IconName] ?? Sparkles;
}

/**
 * Social icons.
 *
 * Instagram / WhatsApp / Facebook deliberately keep the exact marks the footer
 * already renders (Camera / MessageCircle / Share2), so turning the CMS on
 * changes nothing visually.
 *
 * lucide-react v1 removed every brand glyph, so YouTube and Twitter map to the
 * closest generic marks rather than to logos that no longer exist in the package.
 */
export const SOCIAL_ICONS: Record<SocialIconName, LucideIcon> = {
  Instagram: Camera,
  WhatsApp: MessageCircle,
  Facebook: Share2,
  YouTube: Play,
  Twitter: AtSign,
};

export function socialIcon(name: string): LucideIcon {
  return SOCIAL_ICONS[name as SocialIconName] ?? Share2;
}
