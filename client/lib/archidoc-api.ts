export type {
  RawDQEItem,
  DQEAttachment,
  ArchidocProject,
  MappedProject,
  DQEItem,
  ProjectLink,
  Contractor,
  FileCategory,
  ProjectFile,
  FileDownloadResponse,
  UploadUrlResponse,
  AnnotationType,
  Annotation,
  AnnotatedFile,
  ArchidocFileResponse,
} from "./archidoc-types";

export {
  FILE_CATEGORIES,
  ANNOTATION_COLORS,
} from "./archidoc-types";

import {
  FILE_CATEGORIES as FILE_CATEGORIES_DATA,
  type RawDQEItem,
  type DQEAttachment,
  type MappedProject,
  type DQEItem,
  type Contractor,
  type FileCategory,
  type ProjectFile,
  type FileDownloadResponse,
  type UploadUrlResponse,
  type ArchidocFileResponse,
} from "./archidoc-types";

const ARCHIDOC_API_URL = process.env.EXPO_PUBLIC_ARCHIDOC_API_URL;

if (__DEV__) console.log("[ARCHIDOC] API URL configured:", ARCHIDOC_API_URL || "NOT SET");

async function archidocApiFetch(
  path: string,
  options: RequestInit & { allowNotFound?: boolean } = {}
): Promise<Response> {
  if (!ARCHIDOC_API_URL) {
    throw new Error("ARCHIDOC API URL is not configured. Please set EXPO_PUBLIC_ARCHIDOC_API_URL.");
  }

  const { allowNotFound, ...fetchOptions } = options;

  const response = await fetch(`${ARCHIDOC_API_URL}${path}`, {
    credentials: "include",
    ...fetchOptions,
  });

  if (!response.ok) {
    if (allowNotFound && response.status === 404) return response;
    if (response.status === 401) throw new Error("Session expired. Please re-authenticate.");
    if (response.status === 403) throw new Error("No access to this project.");
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`ARCHIDOC request failed (${response.status}): ${errorText}`);
  }

  return response;
}

function mapDQEItem(raw: RawDQEItem): DQEItem {
  const rawAttachments = raw.attachments || [];
  const projectAttachments = raw.projectAttachments || [];

  const allAttachments: DQEAttachment[] = [
    ...rawAttachments.map(att => ({
      id: att.id,
      fileName: att.fileName || att.file_name || att.name || "",
      fileUrl: att.fileUrl || att.file_url || att.url || "",
    })),
    ...projectAttachments.map(att => ({
      id: att.id,
      fileName: att.name || "",
      fileUrl: att.url || "",
    })),
  ].filter(att => att.id && (att.fileName || att.fileUrl));

  const lotCode = raw.lotCode || raw.lotNumber || raw.lot_code || raw.lot_number || "";

  return {
    id: raw.id,
    description: raw.description || raw.title || raw.designation || "",
    lotCode,
    unit: raw.unit,
    quantity: raw.quantity,
    zone: raw.zone || raw.category,
    stageCode: raw.stageCode || raw.stage_code,
    tags: raw.tags,
    notes: raw.notes || (raw.internalNotes?.map(n => n.text).join("\n")),
    assignedContractorId: raw.assignedContractorId || raw.assigned_contractor_id || raw.contractorId || raw.contractor_id || null,
    attachments: allAttachments,
  };
}

function resolveExternalLinks(source: any): {
  photosUrl?: string;
  model3dUrl?: string;
  tour3dUrl?: string;
  googleDriveUrl?: string;
} {
  const ext = source.externalLinks || source.external_links || source.links || {};

  return {
    photosUrl: source.photosUrl || source.photos_url ||
      source.photoUrl || source.photo_url ||
      ext.photosUrl || ext.photos_url ||
      ext.photos || ext.photo,

    model3dUrl: source.model3dUrl || source.model_3d_url ||
      source.modelUrl || source.model_url ||
      source['3dModelUrl'] || source['3d_model_url'] ||
      ext.model3dUrl || ext.model_3d_url ||
      ext.model3d || ext['3dModel'],

    tour3dUrl: source.tour3dUrl || source.tour_3d_url ||
      source.tourUrl || source.tour_url ||
      source.virtualTourUrl || source.virtual_tour_url ||
      ext.tour3dUrl || ext.tour_3d_url ||
      ext.tour3d || ext.virtualTour,

    googleDriveUrl: source.googleDriveUrl || source.google_drive_url ||
      source.driveUrl || source.drive_url ||
      source.gdriveUrl || source.gdrive_url ||
      ext.googleDriveUrl || ext.google_drive_url ||
      ext.googleDrive || ext.drive,
  };
}

function mapRawProject(raw: any): MappedProject {
  const links = resolveExternalLinks(raw);

  return {
    id: raw.project_id || raw.id,
    name: raw.project_name || raw.projectName || "",
    location: raw.address || "",
    status: raw.status || "",
    clientName: raw.client_name || raw.clientName || "",
    items: (raw.items || []).map((item: any) => mapDQEItem(item as RawDQEItem)),
    links: raw.links,
    lotContractors: raw.lot_contractors || raw.lotContractors,
    ...links,
  };
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

export function getCategoryLabel(category: FileCategory): string {
  const found = FILE_CATEGORIES_DATA.find((c) => c.key === category);
  return found ? found.label : category;
}

export async function fetchContractors(): Promise<Contractor[]> {
  try {
    const response = await archidocApiFetch("/api/contractors");
    return await response.json();
  } catch (error) {
    console.warn("Error fetching contractors:", error);
    return [];
  }
}

export async function fetchArchidocProjects(): Promise<MappedProject[]> {
  const response = await archidocApiFetch("/api/ouvro/projects");
  const data = await response.json();

  if (__DEV__) {
    console.log("[ARCHIDOC] Raw projects response:", JSON.stringify(data).substring(0, 500));
  }

  const projects = data.projects;

  if (!Array.isArray(projects)) {
    console.warn("[ARCHIDOC] Unexpected response format - expected { projects: [...] }, got:", typeof data);
    return [];
  }

  return projects.map(mapRawProject);
}

export async function fetchProjectById(projectId: string): Promise<MappedProject | null> {
  const response = await archidocApiFetch(`/api/ouvro/projects/${projectId}`, { allowNotFound: true });

  if (response.status === 404) return null;

  const rawData = await response.json();

  if (__DEV__) console.log("[ARCHIDOC] Project", projectId, "keys:", Object.keys(rawData).join(", "));

  return mapRawProject(rawData);
}

export function getAllDQEAttachments(items: DQEItem[]): { item: DQEItem; attachment: DQEAttachment }[] {
  return items
    .flatMap((item) =>
      (item.attachments || []).map((attachment) => ({ item, attachment }))
    )
    .filter((entry) => entry.attachment !== null);
}

export async function fetchProjectFiles(
  projectId: string,
  category?: FileCategory
): Promise<ProjectFile[]> {
  let path = `/api/archive/files?projectId=${projectId}`;
  if (category) {
    path += `&category=${category}`;
  }

  const response = await archidocApiFetch(path);
  const data = await response.json();
  const files: ArchidocFileResponse[] = data.files || data || [];

  return files.map((f) => ({
    objectId: f.object_id,
    objectName: f.object_name,
    originalName: f.original_name,
    contentType: f.content_type,
    size: f.size,
    projectId: f.project_id,
    category: f.category as FileCategory,
    createdAt: f.uploaded_at,
  }));
}

export async function getFileDownloadUrl(objectId: string): Promise<FileDownloadResponse> {
  const response = await archidocApiFetch(`/api/archive/files/${objectId}`);
  return response.json();
}

export async function requestUploadUrl(
  fileName: string,
  contentType: string,
  size: number
): Promise<UploadUrlResponse> {
  const response = await archidocApiFetch("/api/uploads/request-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: fileName, contentType, size }),
  });

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
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`Failed to upload file: ${response.status} - ${errorText}`);
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
  await archidocApiFetch("/api/archive/files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}

export function getUniqueLotCodes(items: DQEItem[]): string[] {
  const codes = new Set(items.map((item) => item.lotCode));
  return Array.from(codes).sort();
}

export function filterItemsByLot(items: DQEItem[], lotCode: string): DQEItem[] {
  return items.filter((item) => item.lotCode === lotCode);
}
