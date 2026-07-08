// OWNER: Hemant | MODULE: POS Billing Page (dynamic id param)
// Shows invoice, payment methods, accept payment
export default async function POSBillingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main>
      {/* TODO: implement — id: {id} */}
      {/* TODO: implement — invoice */}
      {/* TODO: implement — payment methods */}
      {/* TODO: implement — accept payment */}
    </main>
  );
}
