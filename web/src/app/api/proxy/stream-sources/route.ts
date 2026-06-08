import { NextResponse } from 'next/server';

const SPOOF_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
      return NextResponse.json({ success: false, message: 'Missing URL parameter' }, { status: 400 });
    }

    const parsedUrl = new URL(targetUrl);
    const targetOrigin = parsedUrl.origin;

    // Step 1: Fetch the embed page HTML to extract the data-id attribute
    const pageRes = await fetch(targetUrl, {
      headers: {
        'Referer': targetOrigin,
        'Origin': targetOrigin,
        'User-Agent': SPOOF_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(4500),
    });

    if (!pageRes.ok) {
      return NextResponse.json(
        { success: false, message: `Embed page returned ${pageRes.status}` },
        { status: pageRes.status }
      );
    }

    const html = await pageRes.text();

    // Step 2: Extract data-id from the player element
    const dataIdMatch = html.match(/data-id="(\d+)"/);
    if (!dataIdMatch) {
      return NextResponse.json(
        { success: false, message: 'Could not extract embed data-id from player HTML' },
        { status: 404 }
      );
    }

    const embedId = dataIdMatch[1];

    // Step 3: Query the actual background AJAX stream router endpoint
    const ajaxUrl = `${targetOrigin}/ajax/embed/getSources?id=${embedId}`;

    const ajaxRes = await fetch(ajaxUrl, {
      headers: {
        'Referer': targetUrl,
        'Origin': targetOrigin,
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': SPOOF_UA,
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(4500),
    });

    if (!ajaxRes.ok) {
      return NextResponse.json(
        { success: false, message: `AJAX getSources returned ${ajaxRes.status}` },
        { status: ajaxRes.status }
      );
    }

    const contentType = ajaxRes.headers.get('content-type') || '';
    const ajaxText = await ajaxRes.text();

    // Step 4: Try parsing the JSON response for sources
    if (contentType.includes('application/json') || ajaxText.startsWith('{')) {
      try {
        const payload = JSON.parse(ajaxText);
        const m3u8File = payload?.sources?.[0]?.file;
        if (m3u8File) {
          const cleanUrl = m3u8File.replace(/\\/g, '');
          return NextResponse.json({ success: true, url: cleanUrl });
        }
      } catch {
        // JSON parse failed, fall through to regex
      }
    }

    // Step 5: Fallback regex extraction from the raw page HTML
    const m3u8Patterns = [
      /(https?:\/\/[^"'\s\\]*\.m3u8[^"'\s\\]*)/i,
      /file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i,
      /source\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i,
    ];

    for (const pattern of m3u8Patterns) {
      const match = html.match(pattern);
      if (match?.[1]) {
        const cleanUrl = match[1].replace(/\\/g, '');
        return NextResponse.json({ success: true, url: cleanUrl });
      }
    }

    return NextResponse.json(
      { success: false, message: 'M3U8 manifest not found via AJAX or HTML extraction' },
      { status: 404 }
    );

  } catch (error: any) {
    const isTimeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    return NextResponse.json(
      {
        success: false,
        message: isTimeout
          ? 'Extraction timed out after 4500ms — trigger fallback iframe'
          : `Server Error: ${error.message}`,
      },
      { status: isTimeout ? 408 : 500 }
    );
  }
}
