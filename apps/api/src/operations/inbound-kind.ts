export function inboundKind(
  payload: Record<string, any>,
): "text" | "audio" | "image" | "video" | "file" {
  const mime = String(
    payload.media?.mimetype ||
      payload.mimetype ||
      payload._data?.mimetype ||
      "",
  ).toLowerCase();
  const type = String(payload.type || payload._data?.type || "").toLowerCase();
  if (
    mime.startsWith("audio/") ||
    ["ptt", "audio", "voice"].includes(type) ||
    payload._data?.message?.audioMessage
  )
    return "audio";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return payload.hasMedia ? "file" : "text";
}
