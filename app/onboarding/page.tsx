"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Button, Chip, PARTY_META, Spinner } from "@/components/ui";
import onboardingPhotos from "@/lib/onboarding-photos.json";

const PHOTO_CREDITS = onboardingPhotos as Record<string, { artist: string; license: string; title: string }>;
interface Card { id: string; label: string; img: string; emoji: string; dimension: string }

function Experience({ c, leaving }: { c: Card; leaving: "yes" | "no" | null }) {
  const [broken, setBroken] = useState(false);
  const credit = PHOTO_CREDITS[c.img.match(/(p\d{2}[ab])\.jpg$/)?.[1] ?? ""];
  const exit = leaving === "yes" ? "translate-x-[30%] rotate-6 opacity-0" : leaving === "no" ? "-translate-x-[30%] -rotate-6 opacity-0" : "";
  return (
    <div className={`relative mx-auto aspect-[4/5] max-h-[58dvh] w-full max-w-md overflow-hidden rounded-3xl border border-line bg-paper shadow-lg transition duration-300 ${exit}`}>
      {!broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.img} alt={c.label} onError={() => setBroken(true)} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="cover absolute inset-0 flex items-center justify-center" style={{ ["--h" as string]: 160 }}><span className="text-7xl">{c.emoji}</span></div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent p-5 pt-16 text-white">
        <div className="font-display text-2xl font-semibold leading-tight drop-shadow">{c.emoji} {c.label}</div>
        {credit && !broken && (
          <div className="mt-1 truncate text-[10px] text-white/70" title={`${credit.title} by ${credit.artist}, ${credit.license}, via Wikimedia Commons`}>Photo: {credit.artist} · {credit.license}</div>
        )}
      </div>
      {leaving && (
        <div className={`absolute top-5 ${leaving === "yes" ? "left-5 border-ok text-ok" : "right-5 border-warn text-warn"} rotate-[-8deg] rounded-xl border-4 bg-white/85 px-3 py-1 text-xl font-bold uppercase`}>
          {leaving === "yes" ? "Yes!" : "Nope"}
        </div>
      )}
    </div>
  );
}

export default function Onboarding() {
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>([]);
  const [dbOpts, setDbOpts] = useState<{ attribute: string; label: string }[]>([]);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [city, setCity] = useState("Delhi");
  const [diet, setDiet] = useState("none");
  const [partnerDiet, setPartnerDiet] = useState<string | null>(null);
  const [parties, setParties] = useState<string[]>(["friends"]);
  const [budget, setBudget] = useState(15000);
  const [answers, setAnswers] = useState<{ card_id: string; choice: "yes" | "no"; ms: number }[]>([]);
  const [leaving, setLeaving] = useState<"yes" | "no" | null>(null);
  const [dbs, setDbs] = useState<string[]>([]);
  const [result, setResult] = useState<{ persona: string; blurb: string; dims: Record<string, number>; intents: { need: string; party: string }[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const t0 = useRef(Date.now());

  useEffect(() => {
    api("/api/onboarding").then((d) => {
      setCards(d.cards);
      setDbOpts(d.dealbreakerOptions);
    });
  }, []);
  useEffect(() => {
    t0.current = Date.now();
  }, [step]);
  // After the last answer: a short "got it" moment, then straight to the trips.
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => router.push("/feed?tour=1"), 2200);
    return () => clearTimeout(t);
  }, [result, router]);

  const total = cards.length + 2;
  const cardIdx = step - 1;
  const onCard = step >= 1 && step <= cards.length;

  // One tap per experience. The card slides off in the direction of the answer, then the next one rises in.
  const answer = (choice: "yes" | "no") => {
    if (leaving || !onCard) return;
    const id = cards[cardIdx].id;
    setAnswers((a) => [...a.filter((x) => x.card_id !== id), { card_id: id, choice, ms: Date.now() - t0.current }]);
    setLeaving(choice);
    setTimeout(() => {
      setLeaving(null);
      setStep((s) => s + 1);
    }, 320);
  };
  // Keyboard: right arrow or Y for yes, left arrow or N for no.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!onCard) return;
      if (e.key === "ArrowRight" || e.key.toLowerCase() === "y") answer("yes");
      if (e.key === "ArrowLeft" || e.key.toLowerCase() === "n") answer("no");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!cards.length) return <Spinner />;
  const finish = async () => {
    setBusy(true);
    const r = await api("/api/onboarding", { name, home_city: city, diet, partnerDiet, parties, budget_pp: budget, answers, dealbreakers: dbs });
    setResult(r);
    setBusy(false);
    setStep(total + 1);
  };
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5 py-6 md:py-12">
      <div className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-line">
        <div className="h-full bg-teal transition-all" style={{ width: `${Math.min(100, (step / (total + 1)) * 100)}%` }} />
      </div>

      {step === 0 && (
        <div className="rise space-y-5">
          <h1 className="font-display text-3xl font-semibold">Let&apos;s get to know how you travel</h1>
          <label className="block text-sm">
            <span className="text-muted">Your first name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priya" className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2.5 outline-teal" />
          </label>
          <div>
            <p className="mb-1.5 text-sm text-muted">Home city</p>
            <div className="flex flex-wrap gap-1.5">{["Delhi", "Gurugram", "Noida", "Ghaziabad", "Faridabad"].map((c) => <Chip key={c} small on={city === c} onClick={() => setCity(c)}>{c}</Chip>)}</div>
          </div>
          <div>
            <p className="mb-1.5 text-sm text-muted">Your diet (asked, never guessed)</p>
            <div className="flex flex-wrap gap-1.5">
              {[["none", "No restrictions"], ["nonveg", "Non-veg"], ["eggetarian", "Eggetarian"], ["veg", "Vegetarian"], ["jain", "Jain"]].map(([k, l]) => <Chip key={k} small on={diet === k} onClick={() => setDiet(k)}>{l}</Chip>)}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-sm text-muted">Who do you usually travel with?</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(PARTY_META).map(([k, v]) => <Chip key={k} small tone="saffron" on={parties.includes(k)} onClick={() => setParties(toggle(parties, k))}>{v.emoji} {v.label}</Chip>)}
            </div>
          </div>
          {parties.includes("couple") && (
            <div>
              <p className="mb-1.5 text-sm text-muted">Your partner&apos;s diet</p>
              <div className="flex flex-wrap gap-1.5">{[["nonveg", "Non-veg"], ["veg", "Vegetarian"], ["jain", "Jain"]].map(([k, l]) => <Chip key={k} small on={partnerDiet === k} onClick={() => setPartnerDiet(k)}>{l}</Chip>)}</div>
            </div>
          )}
          <div>
            <p className="mb-1.5 text-sm text-muted">Typical budget per person for a short trip</p>
            <div className="flex flex-wrap gap-1.5">{[8000, 15000, 25000, 40000].map((b) => <Chip key={b} small on={budget === b} onClick={() => setBudget(b)}>₹{b.toLocaleString("en-IN")}</Chip>)}</div>
          </div>
          <Button className="w-full" onClick={() => setStep(1)} disabled={!parties.length}>Next: {cards.length} quick yes-or-no questions →</Button>
        </div>
      )}

      {onCard && (
        <div className="flex flex-1 flex-col">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{step} of {cards.length} · {cards[cardIdx].dimension}</p>
          <h2 className="mt-1 mb-4 font-display text-2xl font-semibold">Would this make your trip?</h2>
          <div key={step} className="rise"><Experience c={cards[cardIdx]} leaving={leaving} /></div>
          <div className="mx-auto mt-5 grid w-full max-w-md grid-cols-2 gap-3">
            <button onClick={() => answer("no")} className="rounded-2xl border-2 border-line bg-paper px-4 py-3.5 text-base font-semibold text-ink shadow-sm transition hover:border-warn hover:text-warn active:scale-[0.98]">👎 Not for me</button>
            <button onClick={() => answer("yes")} className="rounded-2xl bg-teal px-4 py-3.5 text-base font-semibold text-white shadow-md transition hover:bg-teal/90 active:scale-[0.98]">👍 Yes, that&apos;s me</button>
          </div>
          <div className="mx-auto mt-4 flex w-full max-w-md justify-between text-sm">
            <button className="text-muted" onClick={() => setStep((s) => s - 1)}>← Back</button>
            <button className="text-muted" onClick={() => setStep((s) => s + 1)}>Skip</button>
          </div>
        </div>
      )}

      {step === cards.length + 1 && (
        <div className="rise space-y-4">
          <h2 className="font-display text-2xl font-semibold">Anything you don&apos;t want in your trip?</h2>
          <p className="text-sm text-muted">These become hard filters. You can change them any time in your profile.</p>
          <div className="flex flex-wrap gap-1.5">{dbOpts.map((o) => <Chip key={o.attribute} small on={dbs.includes(o.attribute)} onClick={() => setDbs(toggle(dbs, o.attribute))}>{o.label}</Chip>)}</div>
          <Button className="w-full" onClick={finish} disabled={busy}>{busy ? "Building your profile…" : "Find my trips →"}</Button>
        </div>
      )}

      {step === total + 1 && result && (
        <div className="rise flex flex-1 flex-col items-center justify-center text-center">
          <div className="relative flex h-20 w-20 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-teal/20" />
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-teal text-3xl text-white shadow-lg">✓</span>
          </div>
          <h2 className="mt-6 font-display text-3xl">That&apos;s everything we need{name ? `, ${name}` : ""}.</h2>
          <p className="mt-2 text-muted">Taking you to your next trip…</p>
          <button className="mt-6 text-sm font-semibold text-teal" onClick={() => router.push("/feed?tour=1")}>Go now →</button>
        </div>
      )}
    </div>
  );
}
