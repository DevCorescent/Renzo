// OWNER: Gauransh | COMPONENT: Reusable section heading (eyebrow + title + subtitle)
import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";

interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  align?: "center" | "left";
  className?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
  className,
}: SectionHeadingProps) {
  return (
    <Reveal
      className={cn(align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-xl", className)}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#C4C9D1]">{eyebrow}</p>
      <h2 className="mt-3 font-heading text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl">
        {title}
      </h2>
      {subtitle && <p className="mt-4 leading-relaxed text-stone-400">{subtitle}</p>}
    </Reveal>
  );
}