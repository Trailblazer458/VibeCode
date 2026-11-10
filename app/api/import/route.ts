import { q } from "@/lib/db";
import { handle, HttpError, logSignal, requireUser, runPlans, defaultRequest } from "@/lib/server";

// Prototype: the vision/LLM step that reads a Reel is mocked with a fixed mapping for the sample link.
const SAMPLES: Record<string, { dest: string; need: "thrill" | "escape"; secondary: "escape" | "rest"; caption: string; detected: string[]; vibe: string }> = {
  rishikesh: {
    dest: "rishikesh", need: "thrill", secondary: "escape",
    caption: "POV: rapids in the morning, café sunsets by evening 🌊☕ #rishikesh #rafting",
    detected: ["Location: Rishikesh, Uttarakhand (from caption + geotag)", "Activities: white-water rafting, riverside cafés", "Scene: river gorge, hanging bridge, sunset"],
    vibe: "Thrill + escape · friends",
  },
};

export async function POST(req: Request) {
  return handle(async () => {
    const { uid, sid, profile } = await requireUser();
    const { url } = await req.json();
    if (!/instagram\.com\/(reel|p)\//i.test(url ?? "")) throw new HttpError(400, "Paste an Instagram Reel or post link");
    const s = SAMPLES.rishikesh;
    const r = await runPlans(uid, sid, profile, defaultRequest(profile, s.need, "friends", { destId: s.dest, secondaryNeed: s.secondary, maxPlans: 3 }), "reel_import");
    await q("insert into reel_imports (user_id, url, detected) values ($1,$2,$3::jsonb)", [uid, url, JSON.stringify(s)]);
    await logSignal(uid, sid, "reel_import", "stated", { url, destId: s.dest });
    return { detected: s, ...r };
  });
}
