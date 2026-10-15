import { Suspense } from "react";
import { RunView } from "@/components/RunView";

export default function Page({ params }: PageProps<"/run/[id]">) {
  return (
    <Suspense fallback={<main className="mx-auto max-w-7xl px-4 py-10 text-muted">Loading run…</main>}>
      {params.then(({ id }) => (
        <RunView runId={id} />
      ))}
    </Suspense>
  );
}
