import { Suspense } from "react";
import { RunView } from "@/components/RunView";

export default function Page({ params }: PageProps<"/run/[id]">) {
  return (
    <Suspense fallback={<main className="flex-1 px-6 py-10 text-ink-soft">Loading the tour…</main>}>
      {params.then(({ id }) => (
        <RunView runId={id} />
      ))}
    </Suspense>
  );
}
