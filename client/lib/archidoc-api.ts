import type { FeatherIconName } from "@/lib/types";

export type {
  RawExternalLinks,
  RawProject,
  RawDQEItem,
  DQEAttachment,
  ArchidocProject,
  MappedProject,
  DQEItem,
  ProjectLink,
  RawContractor,
  ContractorListResponse,
  Contractor,
  FileCategory,
  ProjectFile,
  FileDownloadResponse,
  UploadUrlResponse,
  AnnotationType,
  Annotation,
  AnnotatedFile,
  ArchidocFileResponse,
  DQEQualityTier,
  DQESyncState,
  PendingDQECapture,
  DQECaptureSubmitParams,
  DQECaptureSubmitResult,
  SnagType,
  SnagSeverity,
  SnagSyncState,
  SnagMediaItem,
  SnagSubmitParams,
  SnagSubmitResponse,
  PendingSnagMedia,
  PendingSnagCapture,
  RawSiteReminder,
  RawSiteReminderAttachment,
  SiteReminderListResponse,
  SiteReminder,
  SiteReminderAttachment,
  ReminderToggleSyncState,
  PendingReminderToggle,
  CachedReminderList,
} from "./archidoc-types";

export {
  FILE_CATEGORIES,
  ANNOTATION_COLORS,
} from "./archidoc-types";

import {
  FILE_CATEGORIES as FILE_CATEGORIES_DATA,
  type RawExternalLinks,
  type RawProject,
  type RawDQEItem,
  type DQEAttachment,
  type MappedProject,
  type DQEItem,
  type RawContractor,
  type ContractorListResponse,
  type Contractor,
  type FileCategory,
  type ProjectFile,
  type FileDownloadResponse,
  type UploadUrlResponse,
  type ArchidocFileResponse,
  type DQECaptureSubmitParams,
  type DQECaptureSubmitResult,
  type SnagSubmitParams,
  type SnagSubmitResponse,
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

function resolveExternalLinks(source: RawProject): {
  photosUrl?: string;
  model3dUrl?: string;
  tour3dUrl?: string;
  googleDriveUrl?: string;
} {
  const linksObj = !Array.isArray(source.links) ? source.links : undefined;
  const ext: RawExternalLinks = source.externalLinks ?? source.external_links ?? linksObj ?? {};

  return {
    photosUrl: source.photosUrl || source.photos_url ||
      source.photoUrl || source.photo_url ||
      ext.photosUrl || ext.photos_url ||
      ext.photos || ext.photo,

    model3dUrl: source.model3dUrl || source.model_3d_url ||
      source.modelUrl || source.model_url ||
      source["3dModelUrl"] || source["3d_model_url"] ||
      ext.model3dUrl || ext.model_3d_url ||
      ext.model3d || ext["3dModel"],

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

function mapRawProject(raw: RawProject): MappedProject {
  const links = resolveExternalLinks(raw);

  return {
    id: raw.project_id || raw.id || "",
    name: raw.project_name || raw.projectName || "",
    location: raw.address || "",
    status: raw.status || "",
    clientName: raw.client_name || raw.clientName || "",
    items: (raw.items ?? []).map((item) => mapDQEItem(item)),
    links: Array.isArray(raw.links) ? raw.links : undefined,
    lotContractors: raw.lot_contractors || raw.lotContractors,
    ...links,
  };
}

export function getFileIcon(contentType: string): FeatherIconName {
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

function mapRawContractor(raw: RawContractor): Contractor {
  return {
    id: raw.id,
    name: raw.name,
    address1: raw.address1,
    town: raw.town,
    postcode: raw.postcode,
    siret: raw.siret,
    contactName: raw.contact_name ?? raw.contactName,
    contactEmail: raw.contact_email ?? raw.contactEmail,
    contactMobile: raw.contact_mobile ?? raw.contactMobile,
  };
}

/**
 * Reads the global contractor list through the BFF proxy — ARCHIDOC's
 * contractors endpoint is key-authenticated server-side (OUVRO_API_KEY), so
 * the client must never call ARCHIDOC directly for it. Throws on failure so
 * callers can surface an explicit error state (no silent empty list).
 */
export async function fetchContractors(): Promise<Contractor[]> {
  const { getApiUrl } = await import("./query-client");
  const url = new URL("/api/contractors", getApiUrl()).toString();
  const response = await fetch(url, { method: "GET", credentials: "include" });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(
      body.error || `Failed to load contractors (${response.status})`
    );
  }
  const data = (await response.json()) as ContractorListResponse;
  return (data.contractors ?? []).map(mapRawContractor);
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
  const { getApiUrl } = await import("./query-client");
  const baseUrl = getApiUrl();
  const response = await fetch(new URL("/api/uploads/request-url", baseUrl).toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: fileName, contentType, size }),
    credentials: "include",
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    if (response.status === 401) throw new Error("Session expired. Please re-authenticate.");
    throw new Error(`Upload URL request failed (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<UploadUrlResponse>;
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

export class DQESubmitError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: number
  ) {
    super(message);
    this.name = "DQESubmitError";
  }

  get isPermanent(): boolean {
    return this.httpStatus >= 400 && this.httpStatus < 500;
  }
}

export async function submitDQECapture(
  apiBaseUrl: string,
  params: DQECaptureSubmitParams
): Promise<DQECaptureSubmitResult> {
  const url = new URL("/api/dqe/submit", apiBaseUrl).href;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(params),
  });
  const data = (await response.json()) as { error?: string } & DQECaptureSubmitResult;
  if (!response.ok) {
    throw new DQESubmitError(
      data.error || `DQE submit failed with status ${response.status}`,
      response.status
    );
  }
  return data;
}

export class SnagSubmitError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = "SnagSubmitError";
  }

  get isPermanent(): boolean {
    if (this.httpStatus === 503) return false;
    return this.httpStatus >= 400 && this.httpStatus < 500;
  }

  get isFeatureDisabled(): boolean {
    return this.httpStatus === 503 || this.code === "FEATURE_DISABLED";
  }
}

export async function submitSnagCapture(
  apiBaseUrl: string,
  params: SnagSubmitParams,
  extraHeaders?: Record<string, string>
): Promise<SnagSubmitResponse> {
  const url = new URL("/api/snags/submit", apiBaseUrl).href;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extraHeaders ?? {}),
  };
  const response = await fetch(url, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify(params),
  });
  const data = (await response.json().catch(() => ({}))) as SnagSubmitResponse;
  if (!response.ok) {
    throw new SnagSubmitError(
      data.error || `Snag submit failed with status ${response.status}`,
      response.status,
      data.code
    );
  }
  return data;
}

// ── Site Reminders (Points à vérifier) ───────────────────────────────────────

export class SiteReminderApiError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: number
  ) {
    super(message);
    this.name = "SiteReminderApiError";
  }

  /** 4xx (except 408/429) are permanent — do not retry an offline toggle. */
  get isPermanent(): boolean {
    if (this.httpStatus === 408 || this.httpStatus === 429) return false;
    return this.httpStatus >= 400 && this.httpStatus < 500;
  }
}

function mapSiteReminderAttachment(
  raw: RawSiteReminderAttachment
): SiteReminderAttachment | null {
  const objectPath = raw.object_path ?? raw.objectPath;
  if (!objectPath) return null;
  return {
    objectPath,
    fileName: raw.file_name ?? raw.fileName ?? objectPath.split("/").pop() ?? objectPath,
    contentType: raw.content_type ?? raw.contentType ?? "application/octet-stream",
    url: raw.url,
  };
}

export function mapSiteReminder(raw: RawSiteReminder): SiteReminder {
  const attachments = (raw.attachments ?? [])
    .map(mapSiteReminderAttachment)
    .filter((a): a is SiteReminderAttachment => a !== null);
  return {
    id: raw.id,
    projectId: raw.project_id ?? raw.projectId ?? "",
    bodyHtml: raw.body_html ?? raw.bodyHtml ?? "",
    bodyText: raw.body_text ?? raw.bodyText ?? "",
    isDone: raw.is_done ?? raw.isDone ?? false,
    sortOrder: raw.sort_order ?? raw.sortOrder ?? 0,
    attachments,
    createdAt: raw.created_at ?? raw.createdAt ?? "",
    updatedAt: raw.updated_at ?? raw.updatedAt ?? "",
  };
}

/**
 * Reads a project's site reminders through the BFF proxy (the OUVRO_API_KEY
 * Bearer auth lives server-side, so we never call ARCHIDOC directly).
 */
export async function fetchSiteReminders(
  projectId: string
): Promise<SiteReminder[]> {
  const { getApiUrl } = await import("./query-client");
  const url = new URL(
    `/api/site-reminders/${encodeURIComponent(projectId)}`,
    getApiUrl()
  ).toString();
  let response: Response;
  try {
    response = await fetch(url, { method: "GET", credentials: "include" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Network request failed";
    throw new SiteReminderApiError(message, 0);
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new SiteReminderApiError(
      body.error || `Failed to load site reminders (${response.status})`,
      response.status
    );
  }
  const data = (await response.json()) as SiteReminderListResponse;
  return (data.site_reminders ?? [])
    .map(mapSiteReminder)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Toggles a reminder's is_done through the BFF proxy. Returns the canonical
 * reminder echoed back by the server.
 */
export async function patchSiteReminderDone(
  projectId: string,
  reminderId: string,
  isDone: boolean
): Promise<SiteReminder> {
  const { getApiUrl } = await import("./query-client");
  const url = new URL(
    `/api/site-reminders/${encodeURIComponent(projectId)}/${encodeURIComponent(reminderId)}`,
    getApiUrl()
  ).toString();
  let response: Response;
  try {
    response = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ is_done: isDone }),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Network request failed";
    throw new SiteReminderApiError(message, 0);
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new SiteReminderApiError(
      body.error || `Failed to update site reminder (${response.status})`,
      response.status
    );
  }
  const data = (await response.json()) as RawSiteReminder;
  return mapSiteReminder(data);
}
