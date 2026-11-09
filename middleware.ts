// Role guard for whole sections of the site. Runs before every matching page.
// The API routes check the role again, and MySQL checks it a third time.
import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const HOME: Record<string, string> = { customer: "/", owner: "/owner", partner: "/partner", admin: "/admin" };
const AREAS: [string, string][] = [
  ["/owner", "owner"], ["/partner", "partner"], ["/admin", "admin"],
  ["/checkout", "customer"], ["/orders", "customer"], ["/account", "customer"], ["/r/", "customer"],
];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  let role: string | null = null;
  const token = req.cookies.get("session")?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-me"));
      role = String(payload.role);
    } catch {
      role = null;
    }
  }
  const go = (to: string) => NextResponse.redirect(new URL(to, req.url));

  if (path === "/login" || path === "/signup") return role ? go(HOME[role] || "/") : NextResponse.next();
  if (path === "/") {
    if (!role) return go("/login");
    return role === "customer" ? NextResponse.next() : go(HOME[role]);
  }
  const area = AREAS.find(([p]) => path === p || path.startsWith(p.endsWith("/") ? p : p + "/") || path === p.replace(/\/$/, ""));
  if (!area) return NextResponse.next();
  if (role === area[1]) return NextResponse.next();
  if (role) return go(HOME[role] || "/");
  return go("/login?next=" + encodeURIComponent(path));
}

export const config = {
  matcher: ["/", "/login", "/signup", "/owner/:path*", "/partner/:path*", "/admin/:path*", "/checkout", "/orders/:path*", "/account", "/r/:path*"],
};
