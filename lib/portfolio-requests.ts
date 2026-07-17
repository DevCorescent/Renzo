import { PortfolioChangeType, type Prisma } from "@prisma/client";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Portfolio Change Requests — shared engine
//
// The one place that knows how each request TYPE is validated, snapshotted and
// (on approval) applied to the live portfolio. The worker submit route and the
// admin review route both import from here, so the rules are stated once and can
// never drift between "what a worker may propose" and "what approval writes".
//
// A worker NEVER writes the live portfolio: they create a PENDING request; only
// applyApprovedChange() — called inside the admin approve transaction — mutates
// the real WorkerProfile / WorkerSkill / WorkerPortfolio rows.
//
// TYPES ARE LIMITED TO FIELDS THAT ACTUALLY EXIST. Achievements, awards, headline
// and a distinct "summary" have no column/table, so they are intentionally absent
// — a request that could be approved but never applied would be a lie.
// ============================================================================

type Tx = Prisma.TransactionClient;
type Payload = Record<string, unknown>;
type Validation = { ok: true } | { ok: false; errors: Record<string, string[]> };

/** Human labels, reused by notifications and the UI so wording stays consistent. */
export const TYPE_LABELS: Record<PortfolioChangeType, string> = {
  BIO: "Professional bio",
  EXPERIENCE: "Experience",
  LANGUAGE: "Languages",
  CERTIFICATE: "Certificates",
  SKILL: "New skill",
  SKILL_LEVEL: "Skill level",
  GALLERY: "Portfolio work",
};

// Mirrors the PortfolioCategory enum locally, exactly as the worker portfolio route
// does, rather than importing the enum into places that don't need the whole client.
const GALLERY_CATEGORIES = ["HAIR", "MAKEUP", "NAILS", "SPA", "SKIN", "GROOMING", "OTHER"];

export function isChangeType(v: unknown): v is PortfolioChangeType {
  return typeof v === "string" && v in TYPE_LABELS;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function stringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim()) : [];
}
function intOrNaN(v: unknown): number {
  const n = Number(v);
  return Number.isInteger(n) ? n : Number.NaN;
}

/**
 * Pure shape validation for a proposed payload. FK/existence checks (a real
 * skillId) stay in the route, which has the db — this only judges the shape, so it
 * can be unit-tested without a database.
 */
export function validatePayload(type: PortfolioChangeType, payload: Payload): Validation {
  const e: Record<string, string[]> = {};

  switch (type) {
    case "BIO":
      if (!str(payload.bio)) e.bio = ["A bio is required"];
      break;
    case "EXPERIENCE": {
      const n = intOrNaN(payload.experience);
      if (Number.isNaN(n) || n < 0) e.experience = ["Experience must be a whole number of years, 0 or more"];
      break;
    }
    case "LANGUAGE":
      if (stringArray(payload.languages).length === 0) e.languages = ["Add at least one language"];
      break;
    case "CERTIFICATE":
      if (stringArray(payload.certificates).length === 0) e.certificates = ["Add at least one certificate"];
      break;
    case "SKILL":
    case "SKILL_LEVEL": {
      if (!str(payload.skillId)) e.skillId = ["Choose a skill"];
      const p = intOrNaN(payload.proficiency);
      if (Number.isNaN(p) || p < 1 || p > 5) e.proficiency = ["Proficiency must be between 1 and 5"];
      break;
    }
    case "GALLERY": {
      if (!str(payload.afterImage)) e.afterImage = ["An 'after' image is required"];
      if (!GALLERY_CATEGORIES.includes(str(payload.category))) e.category = ["Choose a valid category"];
      break;
    }
  }

  return Object.keys(e).length ? { ok: false, errors: e } : { ok: true };
}

/**
 * The live value at submission time, stored on the request so the reviewer sees a
 * true old-vs-new diff even if the live data changes later. Read inside the create
 * transaction.
 */
export async function snapshotPrevious(
  tx: Tx,
  workerId: string,
  type: PortfolioChangeType,
  payload: Payload
): Promise<Prisma.InputJsonValue | undefined> {
  switch (type) {
    case "BIO": {
      const w = await tx.workerProfile.findUnique({ where: { id: workerId }, select: { bio: true } });
      return { bio: w?.bio ?? null };
    }
    case "EXPERIENCE": {
      const w = await tx.workerProfile.findUnique({ where: { id: workerId }, select: { experience: true } });
      return { experience: w?.experience ?? 0 };
    }
    case "LANGUAGE": {
      const w = await tx.workerProfile.findUnique({ where: { id: workerId }, select: { languages: true } });
      return { languages: w?.languages ?? [] };
    }
    case "CERTIFICATE": {
      const w = await tx.workerProfile.findUnique({ where: { id: workerId }, select: { certificates: true } });
      return { certificates: w?.certificates ?? [] };
    }
    case "SKILL":
    case "SKILL_LEVEL": {
      const existing = await tx.workerSkill.findUnique({
        where: { workerId_skillId: { workerId, skillId: str(payload.skillId) } },
        select: { proficiency: true },
      });
      return { proficiency: existing?.proficiency ?? null };
    }
    case "GALLERY":
      return undefined; // brand-new item — there is no "before" value to diff.
  }
}

/**
 * Apply an APPROVED request to the live portfolio. MUST run inside the approve
 * transaction. Every write is scoped to `workerId`, so nothing can touch another
 * worker's data.
 */
export async function applyApprovedChange(
  tx: Tx,
  workerId: string,
  type: PortfolioChangeType,
  payload: Payload,
  adminUserId: string
): Promise<void> {
  switch (type) {
    case "BIO":
      await tx.workerProfile.update({ where: { id: workerId }, data: { bio: str(payload.bio) } });
      return;
    case "EXPERIENCE":
      await tx.workerProfile.update({ where: { id: workerId }, data: { experience: intOrNaN(payload.experience) } });
      return;
    case "LANGUAGE":
      await tx.workerProfile.update({ where: { id: workerId }, data: { languages: stringArray(payload.languages) } });
      return;
    case "CERTIFICATE":
      await tx.workerProfile.update({ where: { id: workerId }, data: { certificates: stringArray(payload.certificates) } });
      return;
    case "SKILL":
    case "SKILL_LEVEL":
      await tx.workerSkill.upsert({
        where: { workerId_skillId: { workerId, skillId: str(payload.skillId) } },
        create: { workerId, skillId: str(payload.skillId), proficiency: intOrNaN(payload.proficiency) },
        update: { proficiency: intOrNaN(payload.proficiency) },
      });
      return;
    case "GALLERY":
      await tx.workerPortfolio.create({
        data: {
          workerId,
          category: str(payload.category) as never, // validated against the enum already
          title: str(payload.title) || null,
          description: str(payload.description) || null,
          beforeImage: str(payload.beforeImage) || null,
          afterImage: str(payload.afterImage),
          // Approved through the request workflow → live and visible immediately.
          isApproved: true,
          approvedBy: adminUserId,
          approvedAt: new Date(),
        },
      });
      return;
  }
}

/**
 * Record a worker-facing notification for a request event. NotificationLog cannot
 * target a staff member (it has customerId / workerId only), so the ADMIN "new
 * request" alert is the pending queue itself; this covers the WORKER side.
 */
export async function notifyWorker(
  tx: Tx,
  workerId: string,
  trigger: string,
  message: string,
  refId: string
): Promise<void> {
  await tx.notificationLog.create({
    data: { workerId, channel: "PUSH", trigger, message, status: "SENT", refId },
  });
}
