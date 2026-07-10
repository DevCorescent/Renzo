// OWNER: Gauransh | Homepage button-style overrides (Veloura-style pills).
// Combine with buttonVariants({ size }) via cn(); tailwind-merge lets these win
// over the shared Button base (which stays square/uppercase for admin screens).

/** White solid pill — the primary "Book Now" style. */
export const PILL_SOLID =
  "rounded-full border-transparent bg-white text-stone-900 text-sm font-medium normal-case tracking-normal hover:bg-white/90";

/** Outline pill on dark surfaces — secondary actions. */
export const PILL_OUTLINE =
  "rounded-full border border-white/25 bg-transparent text-white text-sm font-medium normal-case tracking-normal hover:border-white/40 hover:bg-white/10 hover:text-white";

/** Orange accent pill — occasional emphasis. */
export const PILL_ACCENT =
  "rounded-full border-transparent bg-gold text-gold-foreground text-sm font-medium normal-case tracking-normal hover:bg-gold/90";
