// OWNER: Hemant | MODULE: Worker Portfolio — approved, pending, upload
import { UploadCloud } from "lucide-react";
import { PageHeader, Card, CardHeader, CardTitle, CardBody, Badge } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";

const items = [
  { title: "Bridal Updo", tag: "Styling", status: "Approved", tone: "success" as const, hue: "from-rose-200 to-rose-400" },
  { title: "Ash Balayage", tag: "Colour", status: "Approved", tone: "success" as const, hue: "from-amber-100 to-amber-300" },
  { title: "Pixie Cut", tag: "Haircut", status: "Approved", tone: "success" as const, hue: "from-stone-200 to-stone-400" },
  { title: "Rose Gold Melt", tag: "Colour", status: "Pending", tone: "warning" as const, hue: "from-pink-200 to-fuchsia-300" },
  { title: "Boho Waves", tag: "Styling", status: "Pending", tone: "warning" as const, hue: "from-orange-100 to-orange-300" },
];

export default function WorkerPortfolioPage() {
  return (
    <>
      <PageHeader
        eyebrow="Showcase"
        title="Portfolio"
        subtitle="Your best work. Uploads go to branch admin for approval before appearing publicly."
        actions={<Button><UploadCloud /> Upload new</Button>}
      />

      <Card className="border-dashed">
        <CardBody className="flex flex-col items-center justify-center gap-2 py-10 text-center">
          <UploadCloud className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">Drag & drop images here</p>
          <p className="text-xs text-muted-foreground">JPG or PNG · up to 5MB each · added with a title and category</p>
        </CardBody>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it, i) => (
          <Card key={i} className="overflow-hidden">
            <div className={`aspect-[4/3] bg-gradient-to-br ${it.hue}`} />
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium">{it.title}</p>
                <p className="text-xs text-muted-foreground">{it.tag}</p>
              </div>
              <Badge tone={it.tone}>{it.status}</Badge>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
