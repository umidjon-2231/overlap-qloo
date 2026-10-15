"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

export function ApiStatus() {
  const [status, setStatus] = useState("checking…");

  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then((r) => r.json())
      .then((h: { ok: boolean; db: string }) => setStatus(h.ok ? `api up, db ${h.db}` : "api degraded"))
      .catch(() => setStatus("api unreachable"));
  }, []);

  return <p className="font-mono text-sm text-zinc-500">{status}</p>;
}
