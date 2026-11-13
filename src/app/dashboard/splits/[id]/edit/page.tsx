import SplitForm from "@/components/dashboard/SplitForm";
export default async function EditSplitPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <SplitForm key={id} editId={id} />; }
