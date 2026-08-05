// ============================================================================
// MODULE : Messaging — provider abstraction
//
// WHY THIS EXISTS
// ---------------
// The invoice "Send on WhatsApp" button did not send anything. It opened a
// `wa.me` deep link with a prefilled message and then recorded the attempt as
// SENT. That is a lie the salon would eventually act on: a manager reading
// "Sent" believes the customer has the invoice, when in truth an operator may
// have closed the tab without pressing send.
//
// This module separates WHAT we want to say from HOW it leaves the building, and
// makes the delivery state tell the truth about which of those actually happened:
//
//   DRAFT   — composed, nothing attempted
//   OPENED  — handed to the operator's own WhatsApp client; WE DO NOT KNOW if
//             they pressed send. This is the honest ceiling for a deep link.
//   QUEUED  — accepted by a real provider's API, not yet confirmed delivered
//   SENT    — the provider CONFIRMED it. Never set by the deep-link path.
//   FAILED  — the attempt is known to have failed
//
// Adding Twilio / Meta / Interakt / Gupshup / 360dialog later means writing one
// `MessagingProvider` and registering it. No business logic changes, because the
// routes talk to this interface and never to a vendor.
// ============================================================================

export type DeliveryState = "DRAFT" | "OPENED" | "QUEUED" | "SENT" | "FAILED";

export type MessageRequest = {
  /** E.164-ish; the provider normalises. */
  to: string;
  body: string;
  /** Public URL of an attachment, when the provider supports one. */
  mediaUrl?: string;
  /** For the audit trail — which invoice/appointment this concerns. */
  refId?: string;
};

export type MessageResult = {
  state: DeliveryState;
  /** The provider's own id, when there is one. */
  providerMessageId?: string;
  /** Present when the operator must finish the send by hand. */
  handoffUrl?: string;
  /** Shown to the operator verbatim. Must not overstate what happened. */
  message: string;
  error?: string;
};

export interface MessagingProvider {
  /** Stable id recorded against every attempt. */
  readonly id: string;
  readonly channel: "WHATSAPP" | "SMS";
  /** False when credentials are absent — the caller then explains why. */
  isConfigured(): boolean;
  /** True when this provider actually transmits; false for a hand-off. */
  readonly transmits: boolean;
  send(request: MessageRequest): Promise<MessageResult>;
}

// ============================================================================
// DEEP LINK — the fallback, and currently the only one wired
// ============================================================================

function toWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // Indian numbers are stored bare; wa.me needs a country code.
  return digits.length === 10 ? `91${digits}` : digits;
}

/**
 * Hands the message to whatever WhatsApp client the operator has.
 *
 * `transmits: false` is the important part: this provider can never return SENT,
 * because nothing on this side observes the send. The best it can honestly claim
 * is OPENED.
 */
export const whatsAppDeepLinkProvider: MessagingProvider = {
  id: "whatsapp-deeplink",
  channel: "WHATSAPP",
  transmits: false,
  isConfigured: () => true, // Always available — it needs no credentials.
  async send(request) {
    const number = toWhatsAppNumber(request.to);
    if (!number) {
      return { state: "FAILED", message: "No usable mobile number.", error: "EMPTY_NUMBER" };
    }
    return {
      state: "OPENED",
      handoffUrl: `https://wa.me/${number}?text=${encodeURIComponent(request.body)}`,
      message:
        "WhatsApp Business API is not configured. Opening WhatsApp with a pre-filled message instead — press send there to deliver it.",
    };
  },
};

// ============================================================================
// REGISTRY
// ============================================================================

/**
 * Providers in preference order. A real API provider registered ahead of the
 * deep link takes over automatically once its credentials exist — that is the
 * whole point of the ordering.
 *
 * Registering a vendor is: implement MessagingProvider, `isConfigured()` reads
 * its env vars, and unshift it here. Nothing else in the codebase changes.
 */
const WHATSAPP_PROVIDERS: MessagingProvider[] = [
  // ── Register real providers HERE, before the deep link. ──
  //   twilioWhatsAppProvider,
  //   metaCloudApiProvider,
  whatsAppDeepLinkProvider,
];

export function resolveWhatsAppProvider(): MessagingProvider {
  return (
    WHATSAPP_PROVIDERS.find((p) => p.isConfigured()) ?? whatsAppDeepLinkProvider
  );
}

/** True when a provider that genuinely transmits is configured. */
export function hasTransmittingWhatsApp(): boolean {
  return resolveWhatsAppProvider().transmits;
}

/**
 * Map a delivery state onto the NotificationLog.status column.
 *
 * NotificationLog stores SENT | FAILED | DELIVERED. OPENED and QUEUED have no
 * column of their own, and calling either "SENT" is the exact lie this module
 * exists to stop — so anything not confirmed is recorded as PENDING, with the
 * precise state kept in the message text for the audit trail.
 */
export function toLogStatus(state: DeliveryState): string {
  switch (state) {
    case "SENT":
      return "SENT";
    case "FAILED":
      return "FAILED";
    default:
      return "PENDING";
  }
}
