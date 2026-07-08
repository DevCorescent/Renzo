// OWNER: Devanshi | MODULE: Single Stylist Profile (dynamic id param)
export default async function StylistProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main>
      {/* TODO: implement — id: {id} */}
    </main>
  );
}
