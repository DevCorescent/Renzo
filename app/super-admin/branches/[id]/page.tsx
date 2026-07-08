// OWNER: Hemant | MODULE: Branch Detail & Settings (dynamic id param)
export default async function SuperAdminBranchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main>
      {/* TODO: implement — id: {id} */}
    </main>
  );
}
