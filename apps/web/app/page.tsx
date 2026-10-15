import { ApiStatus } from "./api-status";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Overlap</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Tell us your tour. We tell you which brands to pitch, in which cities, and why.
      </p>
      <ApiStatus />
    </main>
  );
}
