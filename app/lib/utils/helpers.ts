export function maskApiKey(apiKey: string, visibleChars: number = 4): string {
  if (!apiKey || apiKey.length < visibleChars + 3) return '***';
  return apiKey.substring(0, visibleChars) + '***' + apiKey.substring(apiKey.length - 4);
}

export function generateApiKey(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'sk_';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
