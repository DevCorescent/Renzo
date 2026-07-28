import { getPublishedHomeContent } from "@/lib/cms/store";
import { HomeContentRenderer } from "@/components/public/home/home-content-renderer";

export const dynamic = "force-dynamic";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Homepage
// ROUTE  : /
//
// The public homepage continues to render the same sections, but it now consumes
// the published CMS content when present. The fallback remains the built-in
// defaults so the page stays identical until content is published.
// ============================================================================

export default async function HomePage() {
  const content = await getPublishedHomeContent();
  return <HomeContentRenderer content={content} />;
}
