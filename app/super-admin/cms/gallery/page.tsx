// OWNER: Hemant | MODULE: CMS Gallery
import Link from "next/link";
import { ArrowLeft, UploadCloud } from "lucide-react";
import { PageHeader, Card, Badge } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";

const filters = ["All", "Hair", "Colour", "Bridal", "Nails", "Interiors"];
const hues = [
  "from-rose-200 to-rose-400", "from-amber-100 to-amber-300", "from-sky-200 to-sky-400",
  "from-fuchsia-200 to-fuchsia-400", "from-stone-200 to-stone-400", "from-emerald-200 to-emerald-400",
  "from-indigo-200 to-indigo-400", "from-orange-100 to-orange-300",
];
const tags = ["Bridal", "Colour", "Hair", "Nails", "Interiors", "Colour", "Hair", "Bridal"];

export default function SuperAdminCmsGalleryPage() {
  return (
    <>
      <Link href="/super-admin/cms" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to CMS
      </Link>

      <PageHeader eyebrow="Content · CMS" title="Gallery" subtitle="142 images across 5 categories."
        actions={<Button size="sm"><UploadCloud /> Upload</Button>} />

      <div className="flex flex-wrap gap-2">
        {filters.map((f, i) => (
          <button key={f} className={i === 0 ? "border border-primary bg-primary/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary" : "border border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted"}>{f}</button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {hues.map((h, i) => (
          <Card key={i} className="group relative overflow-hidden">
            <div className={`aspect-square bg-gradient-to-br ${h}`} />
            <div className="absolute left-2 top-2"><Badge tone="neutral">{tags[i]}</Badge></div>
          </Card>
        ))}
      </div>
    </>
  );
}
