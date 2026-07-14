// OWNER: Gauransh | Homepage button-style overrides (light-theme, ivory/gold).
// Combine with buttonVariants({ size }) via cn(); tailwind-merge lets these win
// over the shared Button base (which stays square/uppercase for admin screens).
//
// Palette reference (kept in sync with the light Hero):
//   background : #FBF7F0 (warm ivory)
//   ink        : #2B241C (deep espresso — primary text)
//   ink-muted  : #6B6258 / #5C5348 (secondary text)
//   gold       : #A6783A (accent, hover #95692F)
//
// NOTE: if your globals.css / tailwind.config still define --gold, --gold-soft,
// --gold-foreground for the old dark theme, update those root tokens too so any
// component still referencing var(--gold) picks up this same accent.

/** Glassy surface for chips/panels on the light hero and light sections.
 * On a light bg "glass" reads as a soft white lift, not a dark tint — hence
 * white/60 fill with a faint dark hairline border and a barely-there top
 * highlight so it still feels lifted rather than flat. */
export const GLASS =
  "border border-[#2B241C]/10 bg-white/60 backdrop-blur-xl shadow-[inset_0_1px_0_0_rgb(255_255_255/0.6)]";

/** Espresso solid pill — the primary "Book Now" style on light surfaces. */
export const PILL_SOLID =
  "rounded-full border-transparent bg-[#2B241C] text-[#FBF7F0] text-sm font-medium normal-case tracking-normal hover:bg-[#3A3126]";

/** Outline pill on light surfaces — secondary actions. */
export const PILL_OUTLINE =
  "rounded-full border border-[#2B241C]/15 bg-white/70 text-[#2B241C] text-sm font-medium normal-case tracking-normal hover:border-[#2B241C]/25 hover:bg-white";

/** Gold accent pill — the premium CTA. Warm bronze-gold gradient, soft glow,
 * and a sheen that sweeps across on hover (the sheen element is the button's
 * own ::before, so callers only need this one class). */
export const PILL_ACCENT =
  "relative overflow-hidden rounded-full border-transparent bg-linear-to-br from-[#C08A3E] via-[#A6783A] to-[#95692F] text-white text-sm font-medium normal-case tracking-normal shadow-[0_8px_30px_-8px_rgba(166,120,58,.55)] transition-[transform,box-shadow] hover:shadow-[0_12px_40px_-8px_rgba(166,120,58,.7)] hover:-translate-y-0.5 before:absolute before:inset-y-0 before:-left-full before:w-1/2 before:skew-x-12 before:bg-white/30 before:transition-[left] before:duration-700 hover:before:left-[150%] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:before:hidden";