"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

export default function Welcome() {
  const router = useRouter();
  const [me, setMe] = useState<{ user: { name: string; onboarded: boolean } | null; llm: boolean; db: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api("/api/session").then(setMe).catch((e) => setErr(e.message));
  }, []);
  const start = async (mode: "demo" | "fresh") => {
    setBusy(mode);
    setErr(null);
    try {
      await api("/api/session", { mode });
      router.push(mode === "demo" ? "/feed" : "/onboarding");
    } catch (e) {
      setErr((e as Error).message);
      setBusy(null);
    }
  };
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <div className="cover relative flex-1 px-6 pt-16 pb-10 text-white md:flex md:flex-col md:justify-center md:px-16 lg:px-24" style={{ ["--h" as string]: 175 }}>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-80">A personalization layer for travel booking</p>
        <h1 className="mt-3 font-display text-5xl font-semibold leading-[1.05] md:text-7xl">TripGenie</h1>
        <p className="mt-4 max-w-[30ch] text-lg leading-snug opacity-95 md:text-2xl">Travel apps start with “from, to, date”. People start with <em>why</em>, <em>who</em> and <em>how many days off</em>.</p>
        <ul className="mt-6 space-y-2 text-sm opacity-95 md:mt-10 md:text-base">
          <li>✦ Plans for your top intents, ready before you search</li>
          <li>✦ The same hotel ranks differently for friends vs family</li>
          <li>✦ Trip-killers and your dealbreakers checked before you book</li>
          <li>✦ Group trips with private budgets and fair picks</li>
        </ul>
        <span className="pointer-events-none absolute right-4 bottom-4 text-8xl opacity-25 md:right-10 md:bottom-10 md:text-[10rem]">🧭</span>
      </div>
      <div className="space-y-3 bg-sand px-6 py-8 md:flex md:w-[440px] md:shrink-0 md:flex-col md:justify-center md:px-10 lg:w-[500px]">
        <h2 className="hidden font-display text-2xl font-semibold md:block">Try the prototype</h2>
        {me?.user && (
          <button onClick={() => router.push(me.user!.onboarded ? "/feed" : "/onboarding")} className="w-full rounded-2xl border border-line bg-paper px-4 py-3 text-left text-sm">
            Continue as <b>{me.user.name}</b> →
          </button>
        )}
        <button disabled={!!busy} onClick={() => start("demo")} className="w-full rounded-2xl bg-teal px-4 py-4 text-left text-white disabled:opacity-60">
          <div className="font-semibold">{busy === "demo" ? "Setting up Arjun's world…" : "Explore as Arjun →"}</div>
          <div className="text-xs opacity-85">31, Gurugram, married to Meera (vegetarian). Loves thrill trips with friends. A rich profile with past trips, friends and a live group trip.</div>
        </button>
        <button disabled={!!busy} onClick={() => start("fresh")} className="w-full rounded-2xl border border-line bg-paper px-4 py-4 text-left disabled:opacity-60">
          <div className="font-semibold">{busy === "fresh" ? "Creating your profile…" : "Start fresh →"}</div>
          <div className="text-xs text-muted">Swipe through 12 “this or that” scenes. Your persona and first plans in about a minute.</div>
        </button>
        {err && <p className="rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">{err}</p>}
        <p className="pt-2 text-center text-[11px] text-muted">
          Prototype · trips from Delhi NCR · synthetic catalog & reviews · {me ? (me.db === "embedded" ? "demo database" : "live database") : "…"} · {me ? (me.llm ? "AI on" : "rule-based fallback") : "…"}
        </p>
      </div>
    </div>
  );
}
