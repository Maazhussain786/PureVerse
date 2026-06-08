import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
      return new NextResponse('Missing URL parameter', { status: 400 });
    }

    const targetOrigin = new URL(targetUrl).origin;

    const res = await fetch(targetUrl, {
      headers: {
        // Spoof the Referer to the target's own origin to bypass hotlink protection
        'Referer': targetOrigin,
        'Origin': targetOrigin,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok) {
      return new NextResponse(`Failed to fetch from target: ${res.statusText}`, { status: res.status });
    }

    const html = await res.text();

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        // Optional: you can strip headers like X-Frame-Options here if needed
      },
    });
  } catch (error: any) {
    console.error('Player Proxy Error:', error);
    return new NextResponse(`Internal Server Error: ${error.message}`, { status: 500 });
  }
}
