// OWNER: Hemant | MODULE: Worker Detail (dynamic id param)
export default async function SuperAdminWorkerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main>
      {/* TODO: implement — id: {id} */}
    </main>
  );
}
