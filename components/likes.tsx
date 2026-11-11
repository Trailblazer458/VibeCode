"use client";
// Like/save on plan cards: one shared store per page (loaded once from /api/likes), optimistic toggles, and a single
// toast for "what we learned". No imports from ./ui so plan cards (in ui.tsx) can use it.
import { useEffect, useState, type MouseEvent } from "react";
import { api } from "@/lib/client";

type Kind = "like" | "save";
const state = { loaded: false, loading: false, like: new Set<string>(), save: new Set<string>(), toast: null as string | null };
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
let toastTimer: ReturnType<typeof setTimeout> | undefined;

function load() {
  if (state.loaded || state.loading) return;
  state.loading = true;
  api("/api/likes")
    .then((r: { liked: string[]; saved: string[] }) => {
      state.like = new Set(r.liked);
      state.save = new Set(r.saved);
      state.loaded = true;
      emit();
    })
    .catch(() => {})
    .finally(() => (state.loading = false));
}

function useStore() {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    subs.add(f);
    load();
    return () => void subs.delete(f);
  }, []);
  return state;
}

async function toggle(kind: Kind, planId: string, signature: string) {
  const set = state[kind];
  const was = set.has(signature);
  if (was) set.delete(signature);
  else set.add(signature);
  emit();
  try {
    const r = await api("/api/likes", { planId, kind });
    if (r.on !== !was) {
      if (r.on) set.add(signature);
      else set.delete(signature);
    }
    if (r.learned) {
      state.toast = r.learned;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => ((state.toast = null), emit()), 3500);
    }
  } catch {
    if (was) set.add(signature);
    else set.delete(signature);
  }
  emit();
}

/** ♥ and bookmark buttons for a plan card. Safe inside a link: they never navigate. */
export function LikeSave({ planId, signature }: { planId: string; signature?: string }) {
  const s = useStore();
  const sig = signature ?? planId;
  const btn = (kind: Kind, on: boolean, label: string, icon: string) => (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      title={label}
      onClick={(e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        void toggle(kind, planId, sig);
      }}
      className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm backdrop-blur-md transition active:scale-90 ${on ? "border-white bg-white text-bad" : "border-white/40 bg-black/25 text-white hover:bg-black/40"}`}
    >
      {icon}
    </button>
  );
  return (
    <div className="flex gap-1.5">
      {btn("like", s.like.has(sig), s.like.has(sig) ? "Unlike" : "Like", s.like.has(sig) ? "♥" : "♡")}
      {btn("save", s.save.has(sig), s.save.has(sig) ? "Remove from saved" : "Save for later", s.save.has(sig) ? "🔖" : "⚑")}
    </div>
  );
}

/** The single "what we learned" toast; rendered once by Shell. */
export function LikeToast() {
  const s = useStore();
  if (!s.toast) return null;
  return (
    <p role="status" className="rise fixed bottom-20 left-1/2 z-40 w-[90%] max-w-[440px] -translate-x-1/2 rounded-2xl border border-white/15 bg-ink/80 px-4 py-3 text-sm text-white shadow-lg backdrop-blur-xl md:bottom-6">
      {s.toast}
    </p>
  );
}
