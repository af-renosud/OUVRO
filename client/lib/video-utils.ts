export function mimeTypeFromUri(uri: string): string {
  const ext = uri.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
  if (ext === "mov") return "video/quicktime";
  if (ext === "m4v") return "video/x-m4v";
  return "video/mp4";
}
