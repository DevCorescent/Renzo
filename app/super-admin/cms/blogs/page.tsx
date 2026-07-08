// OWNER: Hemant | MODULE: CMS Blogs
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { PageHeader, Card, CardHeader, CardTitle, Badge, Table, THead, TH, TR, TD } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";

const posts = [
  { title: "5 Balayage Trends for Monsoon 2026", author: "Priya Nair", cat: "Hair", status: "Published", tone: "success" as const, date: "6 Jul" },
  { title: "How to Prep Your Skin Before a Facial", author: "Zoya Khan", cat: "Skincare", status: "Published", tone: "success" as const, date: "2 Jul" },
  { title: "Bridal Hair: A Complete Timeline", author: "Editorial", cat: "Bridal", status: "Draft", tone: "neutral" as const, date: "—" },
  { title: "Keratin vs Smoothening: Which Is Right?", author: "Arjun Singh", cat: "Hair", status: "Review", tone: "warning" as const, date: "—" },
  { title: "At-home Nail Care Between Visits", author: "Neha Gupta", cat: "Nails", status: "Published", tone: "success" as const, date: "28 Jun" },
];

export default function SuperAdminCmsBlogsPage() {
  return (
    <>
      <Link href="/super-admin/cms" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to CMS
      </Link>

      <PageHeader eyebrow="Content · CMS" title="Blogs" subtitle="24 articles · 3 drafts"
        actions={<Button size="sm"><Plus /> Write post</Button>} />

      <Card>
        <CardHeader><CardTitle>All Posts</CardTitle></CardHeader>
        <Table>
          <THead><tr><TH>Title</TH><TH>Author</TH><TH>Category</TH><TH>Status</TH><TH>Published</TH></tr></THead>
          <tbody>
            {posts.map((p, i) => (
              <TR key={i}>
                <TD className="font-medium">{p.title}</TD>
                <TD className="text-muted-foreground">{p.author}</TD>
                <TD className="text-muted-foreground">{p.cat}</TD>
                <TD><Badge tone={p.tone}>{p.status}</Badge></TD>
                <TD className="text-muted-foreground tabular-nums">{p.date}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
