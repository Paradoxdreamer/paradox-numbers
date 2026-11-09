// SMS service detection + OTP extraction
// Adapted from the numberbot service keyword logic for Paradox Numbers

const SERVICE_KEYWORDS: Record<string, string[]> = {
  Facebook: ["facebook"],
  Google: ["google", "gmail"],
  WhatsApp: ["whatsapp"],
  Telegram: ["telegram"],
  Instagram: ["instagram"],
  Amazon: ["amazon"],
  Netflix: ["netflix"],
  LinkedIn: ["linkedin"],
  Microsoft: ["microsoft", "outlook", "live.com"],
  Apple: ["apple", "icloud"],
  Twitter: ["twitter", "x.com"],
  Snapchat: ["snapchat"],
  TikTok: ["tiktok"],
  Discord: ["discord"],
  Signal: ["signal"],
  PayPal: ["paypal"],
  Binance: ["binance"],
  Uber: ["uber"],
  Spotify: ["spotify"],
  Steam: ["steam"],
  Unknown: [],
};

const OTP_PATTERNS = [
  /\b(\d{4,8})\b/,                    // plain 4-8 digit code
  /code[:\s]*(\d{4,8})/i,
  /otp[:\s]*(\d{4,8})/i,
  /verification[:\s]*(\d{4,8})/i,
  /pin[:\s]*(\d{4,8})/i,
];

export interface SmsAnalysis {
  service: string;
  code: string | null;
}

export function analyzeSms(body: string): SmsAnalysis {
  const lower = body.toLowerCase();

  let service = "Unknown";
  for (const [name, keywords] of Object.entries(SERVICE_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      service = name;
      break;
    }
  }

  let code: string | null = null;
  for (const pattern of OTP_PATTERNS) {
    const match = body.match(pattern);
    if (match?.[1]) {
      code = match[1];
      break;
    }
  }

  return { service, code };
}