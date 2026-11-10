import { NextResponse } from "next/server";
import { cloneDemo, createFresh, getProfile, handle, rid, session } from "@/lib/server";
import { llmEnabled } from "@/lib/llm";

export async function GET() {
  return handle(async () => {
    const { uid } = await session();
    const user = uid ? await getProfile(uid) : null;
    return { user, llm: llmEnabled(), db: process.env.DATABASE_URL ? "live" : "embedded" };
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const { mode } = await req.json();
    const res = NextResponse.json({ ok: true });
    if (mode === "logout") {
      res.cookies.delete("tg_uid");
      res.cookies.delete("tg_sid");
      return res;
    }
    const uid = mode === "demo" ? await cloneDemo() : await createFresh();
    res.cookies.set("tg_uid", uid, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
    res.cookies.set("tg_sid", rid("s_"), { httpOnly: true, sameSite: "lax", path: "/" });
    return res;
  });
}
