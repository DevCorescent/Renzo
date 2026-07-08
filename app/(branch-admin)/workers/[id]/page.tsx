// OWNER: Hemant | MODULE: Branch Worker Detail (dynamic id param)
export default async function BranchWorkerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main>
      {/* TODO: implement — id: {id} */}
    </main>
  );
}
