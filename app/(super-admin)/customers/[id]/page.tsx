// OWNER: Hemant | MODULE: Customer Detail & Timeline (dynamic id param)
export default async function SuperAdminCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main>
      {/* TODO: implement — id: {id} */}
    </main>
  );
}
