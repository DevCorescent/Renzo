import prisma from "@/lib/db";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FileText, Image, MessageSquare, HelpCircle, LayoutTemplate } from "lucide-react";
import { CmsCopyGenerator } from "@/components/ai/cms-copy-generator";

// OWNER: Hemant | MODULE: Super Admin — CMS Hub

export default async function SuperAdminCmsPage() {
  const authUser = await getServerUser();
  if (authUser?.userType !== "SUPER_ADMIN") redirect("/login");

  const [bannerCount, blogCount, galleryCount, faqCount, testimonialCount] = await Promise.all([
    prisma.banner.count({ where: { isActive: true } }),
    prisma.blog.count({ where: { isPublished: true } }),
    prisma.gallery.count({ where: { isActive: true } }),
    prisma.faq.count({ where: { isActive: true } }),
    prisma.testimonial.count({ where: { isApproved: true } }),
  ]);

  const sections = [
    { label: "Banners", href: "/super-admin/cms/banners", count: bannerCount, icon: LayoutTemplate, hint: "active" },
    { label: "Blogs", href: "/super-admin/cms/blogs", count: blogCount, icon: FileText, hint: "published" },
    { label: "Gallery", href: "/super-admin/cms/gallery", count: galleryCount, icon: Image, hint: "active" },
    { label: "FAQs", href: "/super-admin/cms/faqs", count: faqCount, icon: HelpCircle, hint: "active" },
    { label: "Testimonials", href: "/super-admin/cms/testimonials", count: testimonialCount, icon: MessageSquare, hint: "approved" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">CMS</h1>
        <p className="mt-0.5 text-sm text-gray-500">Manage website content</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="flex items-center gap-4 rounded border border-gray-200 bg-white p-5 hover:bg-gray-50"
          >
            <s.icon className="size-8 text-gray-300" />
            <div>
              <p className="font-medium text-gray-900">{s.label}</p>
              <p className="text-sm text-gray-500">{s.count} {s.hint}</p>
            </div>
          </Link>
        ))}
      </div>

      <CmsCopyGenerator defaultKind="blog" />
    </div>
  );
}
