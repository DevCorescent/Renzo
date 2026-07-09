// OWNER: Hemant | MODULE: CMS Banners
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { PageHeader, Card, CardBody, Badge } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";

const banners = [
  { title: "Monsoon Glow Sale", place: "Homepage Hero", status: "Live", tone: "success" as const, hue: "from-sky-300 to-indigo-400" },
  { title: "Bridal Season 2026", place: "Homepage Hero", status: "Live", tone: "success" as const, hue: "from-rose-300 to-pink-400" },
  { title: "Refer & Earn", place: "Services Page", status: "Live", tone: "success" as const, hue: "from-amber-200 to-orange-400" },
  { title: "Diwali Teaser", place: "Homepage Hero", status: "Scheduled", tone: "info" as const, hue: "from-fuchsia-300 to-purple-400" },
  { title: "Summer Special", place: "Homepage Hero", status: "Expired", tone: "neutral" as const, hue: "from-stone-200 to-stone-400" },
];

export default function SuperAdminCmsBannersPage() {
  return (
    <>
      <Link href="/super-admin/cms" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to CMS
      </Link>

      <PageHeader eyebrow="Content · CMS" title="Banners" subtitle="Hero and promotional banners across the site."
        actions={<Button size="sm"><Plus /> New banner</Button>} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {banners.map((b, i) => (
          <Card key={i} className="overflow-hidden">
            <div className={`flex aspect-[16/7] items-end bg-gradient-to-br ${b.hue} p-3`}>
              <span className="bg-black/30 px-2 py-1 text-xs font-semibold text-white">{b.title}</span>
            </div>
            <CardBody className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{b.title}</p>
                <p className="text-xs text-muted-foreground">{b.place}</p>
              </div>
              <Badge tone={b.tone}>{b.status}</Badge>
            </CardBody>
          </Card>
        ))}
      </div>
    </>
  );
}
