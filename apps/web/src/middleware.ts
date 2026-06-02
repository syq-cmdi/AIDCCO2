import { NextResponse, type NextRequest } from "next/server";

const BUPT_SUBSITE_HOSTS = new Set(["aidcco2.bupt.ai", "aidc-co2.bupt.ai", "carbon.bupt.ai"]);

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const host = request.headers.get("host")?.split(":")[0].toLowerCase() ?? "";
  const pathname = url.pathname.replace(/\/$/, "") || "/";

  if (BUPT_SUBSITE_HOSTS.has(host) && pathname === "/") {
    url.pathname = "/bupt-ai";
    return NextResponse.rewrite(url);
  }

  if (pathname === "/aidcco2") {
    url.pathname = "/bupt-ai";
    return NextResponse.rewrite(url);
  }

  if (pathname.startsWith("/aidcco2/")) {
    url.pathname = pathname.replace("/aidcco2", "") || "/bupt-ai";
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/aidcco2", "/aidcco2/:path*"]
};
