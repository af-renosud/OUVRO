const ARCHIDOC_API_URL = process.env.EXPO_PUBLIC_ARCHIDOC_API_URL;

// Raw ARCHIDOC DQE item response - actual API field names
type RawDQEItem = {
  id: string;
  description?: string;
  designation?: string; // Legacy field name
  title?: string; // Short title
  lotCode?: string;
  lotNumber?: string; // ARCHIDOC uses lotNumber, not lotCode
  lot_code?: string; // snake_case variant
  lot_number?: string; // snake_case variant
  unit: string;
  quantity: number;
  zone?: string;
  category?: string;
  stageCode?: string;
  stage_code?: string;
  tags?: string[];
  notes?: string;
  internalNotes?: Array<{ text: string }>;
  assignedContractorId?: string | null;
  assigned_contractor_id?: string | null;
  contractorId?: string | null;
  contractor_id?: string | null;
  // ARCHIDOC uses "attachments" (usually empty) and "projectAttachments" (actual files)
  attachments?: Array<{
    id: string;
    fileName?: string;
    file_name?: string;
    name?: string;
    fileUrl?: string;
    file_url?: string;
    url?: string;
    type?: string;
  }>;
  projectAttachments?: Array<{
    id: string;
    name?: string;
    url?: string;
    type?: string;
  }>;
};

// Map raw DQE item to normalized format
function mapDQEItem(raw: RawDQEItem): DQEItem {
  // Combine attachments from both fields (ARCHIDOC uses projectAttachments for actual files)
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
  
  // ARCHIDOC uses lotNumber, not lotCode
  const lotCode = raw.lotCode || raw.lotNumber || raw.lot_code || raw.lot_number || "";
  
  return {
    id: raw.id,
    description: raw.description || raw.title || raw.designation || "",
    lotCode: lotCode,
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

export type DQEAttachment = {
  id: string;
  fileName: string;
  fileUrl: string;
};

export type ArchidocProject = {
  id: string;
  projectName: string;
  clientName: string;
  address: string;
  status: string;
  clients?: Array<{ id: string; name: string; email: string }>;
  items?: DQEItem[];
  links?: ProjectLink[];
  lotContractors?: Record<string, string>;
  // External link fields (correct ARCHIDOC field names)
  photosUrl?: string;
  model3dUrl?: string;
  tour3dUrl?: string;
  googleDriveUrl?: string;
};

export type MappedProject = {
  id: string;
  name: string;
  location: string;
  status: string;
  clientName: string;
  items?: DQEItem[];
  links?: ProjectLink[];
  lotContractors?: Record<string, string>;
  // External links (correct ARCHIDOC field names)
  photosUrl?: string;
  model3dUrl?: string;
  tour3dUrl?: string;
  googleDriveUrl?: string;
};

export type DQEItem = {
  id: string;
  description: string;
  lotCode: string;
  unit: string;
  quantity: number;
  zone?: string;
  stageCode?: string;
  tags?: string[];
  notes?: string;
  assignedContractorId?: string | null;
  attachments?: DQEAttachment[];
};

export type ProjectLink = {
  id: string;
  title: string;
  url: string;
  type?: string;
};

export type Contractor = {
  id: string;
  name: string;
  address1?: string;
  town?: string;
  postcode?: string;
  siret?: string;
  contactName?: string;
  contactEmail?: string;
  contactMobile?: string;
};

export type FileCategory =
  | "00"
  | "01"
  | "02"
  | "03"
  | "04"
  | "05"
  | "06"
  | "07"
  | "08"
  | "general"
  | "annotations"
  | "photos"
  | "plans";

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
  file: {
    objectId: string;
    originalName: string;
    contentType: string;
    freshUrl: string;
  };
};

export type UploadUrlResponse = {
  uploadURL: string;
  publicUrl: string;
  objectId: string;
  bucketName: string;
  objectName: string;
  objectPath: string;
  metadata: {
    name: string;
    size: number;
    contentType: string;
  };
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

export const FILE_CATEGORIES: { key: FileCategory; code: string; label: string; icon: string }[] = [
  { key: "00", code: "00", label: "Contrats & Légal", icon: "file-text" },
  { key: "01", code: "01", label: "PLU / Urbanisme", icon: "map" },
  { key: "02", code: "02", label: "État des Lieux", icon: "search" },
  { key: "03", code: "03", label: "Permis PC/DP", icon: "clipboard" },
  { key: "04", code: "04", label: "Suivi Admin", icon: "folder" },
  { key: "05", code: "05", label: "DCE Technique", icon: "tool" },
  { key: "06", code: "06", label: "DET / Exécution", icon: "settings" },
  { key: "07", code: "07", label: "VISA EXE", icon: "check-square" },
  { key: "08", code: "08", label: "AOR / Livraison", icon: "award" },
  { key: "general", code: "GEN", label: "Fichiers Généraux", icon: "file" },
  { key: "photos", code: "PHO", label: "Photos", icon: "image" },
  { key: "annotations", code: "ANN", label: "Annotations", icon: "edit-2" },
];

export const ANNOTATION_COLORS = [
  { key: "red", hex: "#FF0000", label: "Défauts / Problèmes" },
  { key: "orange", hex: "#FF8C00", label: "Avertissements" },
  { key: "blue", hex: "#0066CC", label: "Information" },
  { key: "green", hex: "#00AA00", label: "Approuvé" },
  { key: "black", hex: "#000000", label: "Général" },
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

export function getCategoryLabel(category: FileCategory): string {
  const found = FILE_CATEGORIES.find((c) => c.key === category);
  return found ? found.label : category;
}

export async function fetchContractors(): Promise<Contractor[]> {
  if (!ARCHIDOC_API_URL) {
    console.warn("EXPO_PUBLIC_ARCHIDOC_API_URL is not configured");
    return [];
  }
  
  try {
    const response = await fetch(`${ARCHIDOC_API_URL}/api/contractors`);
    if (!response.ok) {
      console.warn("Failed to fetch contractors:", response.status);
      return [];
    }
    const contractors: Contractor[] = await response.json();
    return contractors;
  } catch (error) {
    console.warn("Error fetching contractors:", error);
    return [];
  }
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
    items: p.items,
    links: p.links,
    lotContractors: p.lotContractors,
    photosUrl: p.photosUrl,
    model3dUrl: p.model3dUrl,
    tour3dUrl: p.tour3dUrl,
    googleDriveUrl: p.googleDriveUrl,
  }));
}

export async function fetchProjectById(projectId: string): Promise<MappedProject | null> {
  if (!ARCHIDOC_API_URL) {
    console.warn("EXPO_PUBLIC_ARCHIDOC_API_URL is not configured");
    return null;
  }
  
  const response = await fetch(`${ARCHIDOC_API_URL}/api/projects/${projectId}`, {
    credentials: "include",
  });
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error("Failed to fetch project");
  }
  const rawData = await response.json();
  
  // Log raw response to check field names
  console.log("[ARCHIDOC API] Raw JSON keys:", Object.keys(rawData));
  if (rawData.items?.[0]) {
    console.log("[ARCHIDOC API] First item raw keys:", Object.keys(rawData.items[0]));
    console.log("[ARCHIDOC API] First item raw data:", JSON.stringify(rawData.items[0]));
  }
  // Log lotContractors/lot_contractors
  console.log("[ARCHIDOC API] lotContractors:", rawData.lotContractors);
  console.log("[ARCHIDOC API] lot_contractors:", rawData.lot_contractors);
  
  // Map items with snake_case support
  const rawItems: RawDQEItem[] = rawData.items || [];
  const mappedItems = rawItems.map(mapDQEItem);
  
  // Handle both lotContractors and lot_contractors (snake_case)
  const lotContractors = rawData.lotContractors || rawData.lot_contractors || {};
  
  // Diagnostic logging for DQE data flow
  console.log("[ARCHIDOC API] Mapped project response for", projectId, ":", JSON.stringify({
    hasItems: mappedItems.length > 0,
    itemsCount: mappedItems.length,
    hasLotContractors: Object.keys(lotContractors).length > 0,
    lotContractorsKeys: Object.keys(lotContractors),
    sampleItem: mappedItems[0] ? {
      lotCode: mappedItems[0].lotCode,
      assignedContractorId: mappedItems[0].assignedContractorId,
      hasAttachments: !!(mappedItems[0].attachments && mappedItems[0].attachments.length > 0),
      attachmentsCount: mappedItems[0].attachments?.length || 0,
    } : null,
    allLotCodes: [...new Set(mappedItems.map(item => item.lotCode).filter(Boolean))],
    allContractorIds: [...new Set(mappedItems.map(item => item.assignedContractorId).filter(Boolean))],
  }));
  
  return {
    id: rawData.id,
    name: rawData.projectName || rawData.project_name || "",
    location: rawData.address || "",
    status: rawData.status || "",
    clientName: rawData.clientName || rawData.client_name || "",
    items: mappedItems,
    links: rawData.links,
    lotContractors: lotContractors,
    photosUrl: rawData.photosUrl || rawData.photos_url,
    model3dUrl: rawData.model3dUrl || rawData.model_3d_url,
    tour3dUrl: rawData.tour3dUrl || rawData.tour_3d_url,
    googleDriveUrl: rawData.googleDriveUrl || rawData.google_drive_url,
  };
}

export function getAllDQEAttachments(items: DQEItem[]): { item: DQEItem; attachment: DQEAttachment }[] {
  return items
    .flatMap((item) =>
      (item.attachments || []).map((attachment) => ({ item, attachment }))
    )
    .filter((entry) => entry.attachment !== null);
}

type ArchidocFileResponse = {
  object_id: string;
  object_name: string;
  original_name: string;
  content_type: string;
  size: number;
  project_id: string;
  category: string;
  uploaded_at: string;
};

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
    body: JSON.stringify({ name: fileName, contentType, size }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    console.error(`Upload URL request failed (${response.status}):`, errorText);
    throw new Error(`Failed to get upload URL: ${response.status} - ${errorText}`);
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

export function getUniqueLotCodes(items: DQEItem[]): string[] {
  const codes = new Set(items.map((item) => item.lotCode));
  return Array.from(codes).sort();
}

export function filterItemsByLot(items: DQEItem[], lotCode: string): DQEItem[] {
  return items.filter((item) => item.lotCode === lotCode);
}
