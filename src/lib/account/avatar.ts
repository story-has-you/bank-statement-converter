export function getUserAvatarUrl(metadata: Record<string, unknown>): string | null {
  for (const value of [metadata.avatar_url, metadata.picture]) {
    if (typeof value !== "string" || !value.trim()) continue;
    try {
      const url = new URL(value);
      if (url.protocol === "https:" || url.protocol === "http:") return url.href;
    } catch {
      // 无效的头像地址使用 AvatarFallback。
    }
  }
  return null;
}
