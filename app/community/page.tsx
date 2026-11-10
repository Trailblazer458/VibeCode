"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, fmtDate } from "@/lib/client";
import { Button, Chip, Cover, ErrorNote, Shell, Spinner } from "@/components/ui";

interface T { id: string; title: string; blurb: string; author_name: string; relation: string; destName: string; emoji: string; hue: number; intent: string; days: number; itemNames: string[]; likes: number; saves: number; remixes: number; liked: boolean; saved: boolean; trip_start: string | null; datesHidden: boolean; visibility: string }

export default function Community() {
  const router = useRouter();
  const [d, setD] = useState<T[] | null>(null);
  const [f, setF] = useState("All");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = () => api("/api/templates").then((r) => setD(r.templates)).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  const act = async (id: string, action: string) => {
    setBusy(id + action);
    const r = await api("/api/templates", { id, action });
    setBusy(null);
    if (action === "remix") router.push(`/p/${r.planId}`);
    else load();
  };
  const list = (d ?? []).filter((t) => f === "All" || (f === "Friends" ? t.relation !== "Curated" && t.relation !== "You" : f === "Curated" ? t.relation === "Curated" : t.relation === "You"));
  return (
    <Shell back="/feed" title="Trips to remix">
      <div className="flex gap-1.5 px-4 pt-3">{["All", "Friends", "Curated", "Mine"].map((x) => <Chip key={x} small on={f === x} onClick={() => setF(x)}>{x}</Chip>)}</div>
      <p className="px-4 pt-2 text-xs text-muted">Remix = take the plan, change what you like. The difference between the template and your version is the strongest preference signal we get.</p>
      <ErrorNote error={err} />
      {!d && <Spinner />}
      <div className="grid gap-3 px-4 pt-3 md:grid-cols-2 xl:grid-cols-3">
        {list.map((t) => (
          <div key={t.id} className="rise overflow-hidden rounded-2xl border border-line bg-paper">
            <Cover hue={t.hue} emoji={t.emoji} className="h-24 p-3 text-white">
              <span className="rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-teal">{t.relation === "Curated" ? "Curated" : `${t.author_name} · ${t.relation}`}</span>
              <div className="absolute bottom-2 left-3"><div className="font-display text-lg font-semibold leading-tight">{t.title}</div><div className="text-xs opacity-90">{t.destName} · {t.intent} · {t.days} days</div></div>
            </Cover>
            <div className="space-y-2 p-3">
              <p className="text-sm">{t.blurb}</p>
              <p className="text-xs text-muted">{t.itemNames.join(" · ")}</p>
              <p className="text-[11px] text-muted">{t.datesHidden ? "🔒 Upcoming trip: dates hidden until it's over" : t.trip_start ? `Travelled ${fmtDate(t.trip_start)}` : "Evergreen plan"} · {t.visibility === "fof" ? "friends of friends" : t.visibility}</p>
              <div className="flex items-center gap-2">
                <Chip small on={t.liked} onClick={() => act(t.id, "like")}>♥ {t.likes}</Chip>
                <Chip small on={t.saved} onClick={() => act(t.id, "save")}>⚑ {t.saves}</Chip>
                <span className="text-[11px] text-muted">↻ {t.remixes} remixes</span>
                <Button className="ml-auto !px-3 !py-1.5 text-xs" disabled={busy === t.id + "remix"} onClick={() => act(t.id, "remix")}>{busy === t.id + "remix" ? "…" : "Remix for me"}</Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}
