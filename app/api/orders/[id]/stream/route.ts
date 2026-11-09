// Live tracking: Server-Sent Events fed by Redis Pub/Sub (SUBSCRIBE order:{id}).
// Uses the read-only Redis user fd_tracking.
import { getUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { subscriber } from "@/lib/redis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const u = await getUser();
  if (!u || u.role !== "customer") return new Response("Please log in", { status: 401 });
  const id = Number(params.id);
  const own = await one("customer", "SELECT order_id FROM orders WHERE order_id = ? AND customer_id = ?", [id, u.id]);
  if (!own) return new Response("Not found", { status: 404 });

  const sub = subscriber();
  const enc = new TextEncoder();
  let closed = false;
  let keepAlive: any = null;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (s: string) => {
        if (closed) return;
        try { controller.enqueue(enc.encode(s)); } catch { /* client went away */ }
      };
      const close = () => {
        if (closed) return;
        closed = true;
        if (keepAlive) clearInterval(keepAlive);
        sub.quit().catch(() => sub.disconnect());
        try { controller.close(); } catch {}
      };
      send(": connected\n\n");
      sub.on("message", (_channel: string, message: string) => send(`data: ${message}\n\n`));
      try {
        await sub.subscribe(`order:${id}`);
        send(`event: ready\ndata: {"live":true}\n\n`);
      } catch (e: any) {
        send(`event: ready\ndata: {"live":false}\n\n`);
      }
      keepAlive = setInterval(() => send(": ping\n\n"), 15000);
      req.signal.addEventListener("abort", close);
    },
    cancel() {
      closed = true;
      if (keepAlive) clearInterval(keepAlive);
      sub.quit().catch(() => sub.disconnect());
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
