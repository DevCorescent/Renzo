// OWNER: Devanshi | MODULE: Single Blog Post (dynamic slug param)
export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <main>
      {/* TODO: implement — slug: {slug} */}
    </main>
  );
}
