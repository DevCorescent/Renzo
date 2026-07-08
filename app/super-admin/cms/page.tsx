// OWNER: Hemant | MODULE: CMS Hub — Banners, Blogs, Gallery, SEO
import Link from "next/link";
import { Image as ImageIcon, FileText, Images, Search, ArrowRight } from "lucide-react";
import { PageHeader, Card, CardBody } from "@/components/shared/ui";

const sections = [
  { title: "Banners", desc: "Homepage hero & promo banners", count: "6 active", href: "/super-admin/cms/banners", icon: ImageIcon },
  { title: "Blogs", desc: "Articles & beauty guides", count: "24 published", href: "/super-admin/cms/blogs", icon: FileText },
  { title: "Gallery", desc: "Showcase images by category", count: "142 images", href: "/super-admin/cms/gallery", icon: Images },
  { title: "SEO & Pages", desc: "Meta tags, static pages, FAQs", count: "18 pages", href: "/super-admin/cms", icon: Search },
];

export default function SuperAdminCmsPage() {
  return (
    <>
      <PageHeader eyebrow="Content" title="CMS" subtitle="Manage everything shown on the public website." />

      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((s) => (
          <Link key={s.title} href={s.href}>
            <Card className="group h-full transition-colors hover:border-primary">
              <CardBody className="flex items-start gap-4">
                <div className="flex size-11 items-center justify-center bg-muted"><s.icon className="size-5 text-muted-foreground" /></div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-heading text-lg font-semibold">{s.title}</h3>
                    <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                  </div>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-primary">{s.count}</p>
                </div>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
