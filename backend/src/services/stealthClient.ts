import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

// Define proxy configurations if available in the environment.
// For production, these would be populated by your Smart Proxy provider.
const PROXY_URL = process.env.SCRAPER_PROXY_URL || ''; 

/**
 * Generates randomized, realistic browser headers to evade basic bot detection.
 */
function getRandomHeaders() {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
  ];

  const secChUa = [
    '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
    '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    '"Brave";v="125", "Chromium";v="125", "Not.A/Brand";v="24"'
  ];

  const randomAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
  const randomSecChUa = secChUa[Math.floor(Math.random() * secChUa.length)];
  const isFirefox = randomAgent.includes('Firefox');

  const headers: Record<string, string> = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'max-age=0',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'User-Agent': randomAgent,
  };

  if (!isFirefox) {
    headers['Sec-Ch-Ua'] = randomSecChUa;
    headers['Sec-Ch-Ua-Mobile'] = '?0';
    headers['Sec-Ch-Ua-Platform'] = randomAgent.includes('Windows') ? '"Windows"' : randomAgent.includes('Macintosh') ? '"macOS"' : '"Linux"';
    headers['Sec-Fetch-Dest'] = 'document';
    headers['Sec-Fetch-Mode'] = 'navigate';
    headers['Sec-Fetch-Site'] = 'none';
    headers['Sec-Fetch-User'] = '?1';
  }

  return headers;
}

/**
 * Creates an Axios instance pre-configured for stealth scraping.
 */
export function createStealthClient(baseURL?: string) {
  const config: any = {
    headers: getRandomHeaders(),
    timeout: 10000,
  };

  if (baseURL) {
    config.baseURL = baseURL;
  }

  // If a proxy URL is configured, route traffic through it to evade IP bans
  if (PROXY_URL) {
    console.log(`[StealthClient] Routing request through proxy.`);
    config.httpsAgent = new HttpsProxyAgent(PROXY_URL);
    // Ignore SSL certificate errors from the proxy
    config.httpsAgent.options.rejectUnauthorized = false; 
  }

  const client = axios.create(config);

  // Dynamic Header Rotation Interceptor
  client.interceptors.request.use((req) => {
    // Merge new random headers for every single request to prevent fingerprinting
    req.headers = {
      ...req.headers,
      ...getRandomHeaders(),
    } as any;
    
    return req;
  });

  return client;
}
