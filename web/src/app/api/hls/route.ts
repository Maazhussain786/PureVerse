import { NextRequest, NextResponse } from "next/server";

// ─── HLS proxy ────────────────────────────────────────────
// The piece that lets our OWN <video>/hls.js player (NativePlayer) play a
// provider's direct .m3u8 the way Cineby-style sites do. Raw provider manifests
// are usually CORS-locked and gated behind a Referer, so the browser can't fetch
// them directly. This route:
//   • fetches the manifest/segment with the right Referer/Origin/UA,
//   • rewrites every segment + key + nested-playlist URI back through itself so
//     those requests ALSO carry the headers and come back same-origin,
//   • serves it with open CORS.
// Note: video bytes flow through this function — fine for launch, but the real
// scale path is a Cloudflare Worker (what Cineby uses) to keep it cheap.

export const runtime = "nodejs";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

function abs(base: string, ref: string): string {
  try {
    return new URL(ref, base).toString();
  } catch {
    return ref;
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const raw = sp.get("url");
  if (!raw) return new NextResponse("missing url", { status: 400 });

  const target = decodeURIComponent(raw);
  let referer = sp.get("ref") ? decodeURIComponent(sp.get("ref")!) : "";
  if (!referer) {
    try {
      referer = new URL(target).origin + "/";
    } catch {
      return new NextResponse("bad url", { status: 400 });
    }
  }
  const origin = (() => {
    try {
      return new URL(referer).origin;
    } catch {
      return referer;
    }
  })();

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      headers: { "User-Agent": UA, Referer: referer, Origin: origin },
      // Don't hang the player on a dead CDN.
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    return new NextResponse("upstream fetch failed", { status: 502 });
  }
  if (!upstream.ok) {
    return new NextResponse(`upstream ${upstream.status}`, { status: 502 });
  }

  const ct = (upstream.headers.get("content-type") || "").toLowerCase();
  const isPlaylist =
    target.split("?")[0].endsWith(".m3u8") ||
    ct.includes("mpegurl") ||
    ct.includes("vnd.apple");

  const proxyBase = `${req.nextUrl.origin}/api/hls`;
  const wrap = (u: string) =>
    `${proxyBase}?url=${encodeURIComponent(abs(target, u))}&ref=${encodeURIComponent(referer)}`;

  if (isPlaylist) {
    const text = await upstream.text();
    const rewritten = text
      .split("\n")
      .map((line) => {
        const t = line.trim();
        if (!t) return line;
        if (t.startsWith("#")) {
          // Rewrite the key URI (and any URI="" attribute) so AES keys also
          // come through the proxy with the right headers.
          if (t.includes('URI="')) {
            return line.replace(/URI="([^"]+)"/g, (_m, u) => `URI="${wrap(u)}"`);
          }
          return line;
        }
        // A bare line = a segment or a nested (variant) playlist.
        return wrap(t);
      })
      .join("\n");

    return new NextResponse(rewritten, {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
    });
  }

  // Segment / key / mp4 — stream the bytes straight through with open CORS.
  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": ct || "application/octet-stream",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
