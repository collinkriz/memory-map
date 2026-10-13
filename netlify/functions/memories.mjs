import { getStore } from "@netlify/blobs";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const clean = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export default async (req) => {
  const store = getStore({ name: "memories", consistency: "strong" });

  if (req.method === "GET") {
    const { blobs } = await store.list();
    const items = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
    return json(items.filter(Boolean));
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    const title = clean(body.title, 60);
    const description = clean(body.description, 280);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 540)
      return json({ error: "Invalid location" }, 400);
    if (!title || !description) return json({ error: "Title and description are required" }, 400);
    const memory = {
      id: crypto.randomUUID(),
      lat,
      lng: ((((lng + 180) % 360) + 360) % 360) - 180,
      title,
      description,
      author: clean(body.author, 40),
      place: clean(body.place, 120),
      createdAt: new Date().toISOString(),
    };
    await store.setJSON(memory.id, memory);
    return json(memory, 201);
  }

  if (req.method === "DELETE") {
    const key = Netlify.env.get("ADMIN_KEY");
    if (!key || req.headers.get("x-admin-key") !== key) return json({ error: "Not allowed" }, 403);
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return json({ error: "Missing id" }, 400);
    await store.delete(id);
    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config = { path: "/api/memories" };

