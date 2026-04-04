export function mimeTypeFromUri(uri: string): string {
  const ext = uri.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
  if (ext === "mov") return "video/mp4";
  if (ext === "m4v") return "video/mp4";
  return "video/mp4";
}
