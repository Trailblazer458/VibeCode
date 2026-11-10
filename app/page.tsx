"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

export default function Welcome() {
  const router = useRouter();
  const [me, setMe] = useState<{ user: { name: string; onboarded: boolean } | null; llm: string | null; db: string } | null>(null);
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
    <div className="cover relative flex min-h-dvh flex-col overflow-hidden text-white md:flex-row md:items-center" style={{ ["--h" as string]: 175 }}>
      {/* Warm and cool light fields for the glass panels to catch */}
      <div className="pointer-events-none absolute -top-32 right-[-10%] h-[36rem] w-[36rem] rounded-full bg-saffron/35 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-20%] left-[-10%] h-[32rem] w-[32rem] rounded-full bg-[#7fe0c8]/25 blur-3xl" />
      <span className="pointer-events-none absolute right-4 bottom-4 text-8xl opacity-20 md:right-10 md:bottom-10 md:text-[10rem]">🧭</span>

      <div className="relative flex-1 px-6 pt-16 pb-8 md:px-16 md:py-16 lg:px-24">
        <span className="glass-dark inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em]">
          A personalization layer for travel booking <span className="text-saffron">✦</span>
        </span>
        <h1 className="mt-5 font-display text-6xl font-semibold leading-[0.95] md:text-8xl">
          <span className="bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">TripGenie</span>
        </h1>
        <p className="mt-5 max-w-[32ch] text-lg leading-snug text-white/85 md:text-2xl">Travel apps start with “from, to, date”. People start with <em>why</em>, <em>who</em> and <em>how many days off</em>.</p>
        <ul className="mt-6 flex max-w-2xl flex-wrap gap-2 text-sm md:mt-10">
          <li className="glass-dark rounded-full px-3 py-1.5">✦ Plans for your top intents, ready before you search</li>
          <li className="glass-dark rounded-full px-3 py-1.5">✦ The same hotel ranks differently for friends vs family</li>
          <li className="glass-dark rounded-full px-3 py-1.5">✦ Trip-killers and your dealbreakers checked before you book</li>
          <li className="glass-dark rounded-full px-3 py-1.5">✦ Group trips with private budgets and fair picks</li>
        </ul>
      </div>

      <div className="relative px-4 pb-8 md:w-[460px] md:shrink-0 md:py-16 md:pr-12 lg:w-[520px]">
        <div className="glass-dark space-y-3 rounded-3xl p-5 md:p-6">
          <h2 className="font-display text-2xl font-semibold">Try the prototype</h2>
          {me?.user && (
            <button onClick={() => router.push(me.user!.onboarded ? "/feed" : "/onboarding")} className="w-full rounded-2xl border border-white/25 bg-white/10 px-4 py-3 text-left text-sm transition hover:bg-white/20">
              Continue as <b>{me.user.name}</b> →
            </button>
          )}
          <button disabled={!!busy} onClick={() => start("demo")} className="w-full rounded-2xl bg-white px-4 py-4 text-left text-ink shadow-lg transition hover:bg-white/90 disabled:opacity-60">
            <div className="font-semibold text-teal">{busy === "demo" ? "Setting up Arjun's world…" : "Explore as Arjun →"}</div>
            <div className="text-xs text-muted">31, Gurugram, married to Meera (vegetarian). Loves thrill trips with friends. A rich profile with past trips, friends and a live group trip.</div>
          </button>
          <button disabled={!!busy} onClick={() => start("fresh")} className="w-full rounded-2xl border border-white/25 bg-white/10 px-4 py-4 text-left transition hover:bg-white/20 disabled:opacity-60">
            <div className="font-semibold">{busy === "fresh" ? "Creating your profile…" : "Start fresh →"}</div>
            <div className="text-xs text-white/75">Swipe through 12 “this or that” scenes. Your persona and first plans in about a minute.</div>
          </button>
          {err && <p className="rounded-xl bg-bad/80 px-3 py-2 text-sm text-white">{err}</p>}
          <p className="pt-2 text-center text-[11px] text-white/65">
            Prototype · trips from Delhi NCR · synthetic catalog & reviews · data: {me?.db ?? "…"} · AI: {me ? (me.llm ? `Grok (${me.llm})` : "rules fallback") : "…"}
          </p>
        </div>
      </div>
    </div>
  );
}
