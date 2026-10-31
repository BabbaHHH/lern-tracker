import { SchreibenWorkspace } from "@/components/schreiben-workspace";

// Next 16: dynamische Route-Params sind async.
export default async function SchreibenDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SchreibenWorkspace key={id} draftId={id} />;
}
