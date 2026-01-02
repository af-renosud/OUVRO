const ARCHIDOC_API_URL = process.env.EXPO_PUBLIC_ARCHIDOC_API_URL;

export type ArchidocProject = {
  id: string;
  projectName: string;
  clientName: string;
  address: string;
  status: string;
  clients?: Array<{ id: string; name: string; email: string }>;
  items?: Array<{ id: string; title: string }>;
};

export type MappedProject = {
  id: string;
  name: string;
  location: string;
  status: string;
  clientName: string;
};

export type FileCategory =
  | "00-contrats"
  | "ESQ"
  | "APS"
  | "APD"
  | "PRO"
  | "DCE"
  | "ACT"
  | "VISA"
  | "DET"
  | "AOR"
  | "general"
  | "annotations"
  | "photos";

export type ProjectFile = {
  objectId: string;
  objectName: string;
  originalName: string;
  contentType: string;
  size: number;
  projectId: string;
  category: FileCategory;
  createdAt: string;
};

export type FileDownloadResponse = {
  objectId: string;
  originalName: string;
  contentType: string;
  signedUrl: string;
  expiresIn: number;
};

export type UploadUrlResponse = {
  uploadUrl: string;
  publicUrl: string;
  objectId: string;
};

export type AnnotationType = "arrow" | "circle" | "rectangle" | "freehand" | "text" | "measurement";

export type Annotation = {
  id: string;
  type: AnnotationType;
  color: string;
  strokeWidth: number;
  points: number[][];
  text?: string;
  createdAt: string;
  createdBy: string;
};

export type AnnotatedFile = {
  id: string;
  originalFileId: string;
  projectId: string;
  annotations: Annotation[];
  flattenedImagePath: string;
  linkedObservationId?: string;
};

export const FILE_CATEGORIES: { key: FileCategory; label: string; icon: string }[] = [
  { key: "00-contrats", label: "Contrats", icon: "file-text" },
  { key: "ESQ", label: "Esquisse", icon: "edit-3" },
  { key: "APS", label: "APS", icon: "layers" },
  { key: "APD", label: "APD", icon: "layout" },
  { key: "PRO", label: "Projet", icon: "folder" },
  { key: "DCE", label: "DCE", icon: "clipboard" },
  { key: "ACT", label: "ACT", icon: "briefcase" },
  { key: "VISA", label: "VISA", icon: "check-square" },
  { key: "DET", label: "DET", icon: "tool" },
  { key: "AOR", label: "AOR", icon: "award" },
  { key: "general", label: "General", icon: "file" },
  { key: "photos", label: "Photos", icon: "image" },
  { key: "annotations", label: "Annotations", icon: "edit-2" },
];

export const ANNOTATION_COLORS = [
  { key: "red", hex: "#FF0000", label: "Defects/Issues" },
  { key: "orange", hex: "#FF8C00", label: "Warnings" },
  { key: "blue", hex: "#0066CC", label: "Information" },
  { key: "green", hex: "#00AA00", label: "Approved" },
  { key: "black", hex: "#000000", label: "General" },
];

export function getArchidocApiUrl(): string | undefined {
  return ARCHIDOC_API_URL;
}

export function isApiConfigured(): boolean {
  return !!ARCHIDOC_API_URL;
}

export function getFileIcon(contentType: string): string {
  if (contentType.includes("pdf")) return "file-text";
  if (contentType.includes("image")) return "image";
  if (contentType.includes("word") || contentType.includes("document")) return "file-text";
  if (contentType.includes("excel") || contentType.includes("spreadsheet")) return "grid";
  return "file";
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function fetchArchidocProjects(): Promise<MappedProject[]> {
  if (!ARCHIDOC_API_URL) {
    console.warn("EXPO_PUBLIC_ARCHIDOC_API_URL is not configured");
    return [];
  }
  
  const response = await fetch(`${ARCHIDOC_API_URL}/api/projects`);
  if (!response.ok) {
    throw new Error("Failed to fetch projects from OUVRO");
  }
  const projects: ArchidocProject[] = await response.json();
  return projects.map((p) => ({
    id: p.id,
    name: p.projectName,
    location: p.address,
    status: p.status,
    clientName: p.clientName,
  }));
}

export async function fetchProjectFiles(
  projectId: string,
  category?: FileCategory
): Promise<ProjectFile[]> {
  if (!ARCHIDOC_API_URL) {
    console.warn("EXPO_PUBLIC_ARCHIDOC_API_URL is not configured");
    return [];
  }

  let url = `${ARCHIDOC_API_URL}/api/archive/files?projectId=${projectId}`;
  if (category) {
    url += `&category=${category}`;
  }

  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Session expired. Please re-authenticate.");
    }
    if (response.status === 403) {
      throw new Error("No access to this project.");
    }
    throw new Error("Failed to fetch project files");
  }
  return response.json();
}

export async function getFileDownloadUrl(objectId: string): Promise<FileDownloadResponse> {
  if (!ARCHIDOC_API_URL) {
    throw new Error("ARCHIDOC API URL is not configured");
  }

  const response = await fetch(`${ARCHIDOC_API_URL}/api/archive/files/${objectId}`, {
    credentials: "include",
  });
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("File not found or deleted");
    }
    throw new Error("Failed to get download URL");
  }
  return response.json();
}

export async function requestUploadUrl(
  fileName: string,
  contentType: string,
  size: number
): Promise<UploadUrlResponse> {
  if (!ARCHIDOC_API_URL) {
    throw new Error("ARCHIDOC API URL is not configured");
  }

  const response = await fetch(`${ARCHIDOC_API_URL}/api/uploads/request-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ fileName, contentType, size }),
  });

  if (!response.ok) {
    throw new Error("Failed to get upload URL");
  }
  return response.json();
}

export async function uploadFileToSignedUrl(
  uploadUrl: string,
  fileBlob: Blob,
  contentType: string
): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: fileBlob,
  });

  if (!response.ok) {
    throw new Error("Failed to upload file");
  }
}

export async function archiveUploadedFile(params: {
  objectId: string;
  bucketName: string;
  objectName: string;
  originalName: string;
  contentType: string;
  size: number;
  projectId: string;
  category: FileCategory;
}): Promise<void> {
  if (!ARCHIDOC_API_URL) {
    throw new Error("ARCHIDOC API URL is not configured");
  }

  const response = await fetch(`${ARCHIDOC_API_URL}/api/archive/files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error("Failed to archive file");
  }
}
