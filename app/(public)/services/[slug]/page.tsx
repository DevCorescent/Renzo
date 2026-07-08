// OWNER: Devanshi | MODULE: Single Service Detail (dynamic slug param)
export default async function ServiceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <main>
      {/* TODO: implement — slug: {slug} */}
    </main>
  );
}
