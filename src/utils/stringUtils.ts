export function safeNormalizeString(str: unknown): string {
  if (!str || typeof str !== 'string') return '';
  try {
    encodeURIComponent(str);
    return str.trim();
  } catch {
    console.warn('[SafeString] 发现非法URI字符，已自动降级清洗');
    return str
      .replace(/[\uD800-\uDFFF]/g, (ch: string, i: number, s: string) => {
        const cp = ch.charCodeAt(0);
        if (cp >= 0xD800 && cp <= 0xDBFF) {
          const next = i + 1 < s.length ? s.charCodeAt(i + 1) : 0;
          return next >= 0xDC00 && next <= 0xDFFF ? ch : '';
        }
        const prev = i > 0 ? s.charCodeAt(i - 1) : 0;
        return prev >= 0xD800 && prev <= 0xDBFF ? ch : '';
      })
      .replace(/%(?![0-9A-Fa-f]{2})/g, '')
      .trim();
  }
}
