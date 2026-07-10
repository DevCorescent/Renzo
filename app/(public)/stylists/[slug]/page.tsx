// OWNER: Devanshi | MODULE: Single Stylist Profile
export default async function StylistProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <main>
      {/* TODO: implement — slug: {slug} */}
    </main>
  );
}
