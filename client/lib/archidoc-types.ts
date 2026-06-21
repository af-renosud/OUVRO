import type { FeatherIconName } from "@/lib/types";

export type RawExternalLinks = {
  photosUrl?: string;
  photos_url?: string;
  photos?: string;
  photo?: string;
  photoUrl?: string;
  photo_url?: string;
  model3dUrl?: string;
  model_3d_url?: string;
  model3d?: string;
  "3dModel"?: string;
  modelUrl?: string;
  model_url?: string;
  tour3dUrl?: string;
  tour_3d_url?: string;
  tour3d?: string;
  virtualTour?: string;
  tourUrl?: string;
  tour_url?: string;
  virtualTourUrl?: string;
  virtual_tour_url?: string;
  googleDriveUrl?: string;
  google_drive_url?: string;
  googleDrive?: string;
  drive?: string;
  driveUrl?: string;
  drive_url?: string;
  gdriveUrl?: string;
  gdrive_url?: string;
};

export type RawProject = {
  id?: string;
  project_id?: string;
  projectName?: string;
  project_name?: string;
  address?: string;
  status?: string;
  clientName?: string;
  client_name?: string;
  items?: RawDQEItem[];
  links?: ProjectLink[] | RawExternalLinks;
  lotContractors?: Record<string, string>;
  lot_contractors?: Record<string, string>;
  externalLinks?: RawExternalLinks;
  external_links?: RawExternalLinks;
  photosUrl?: string;
  photos_url?: string;
  photoUrl?: string;
  photo_url?: string;
  model3dUrl?: string;
  model_3d_url?: string;
  modelUrl?: string;
  model_url?: string;
  "3dModelUrl"?: string;
  "3d_model_url"?: string;
  tour3dUrl?: string;
  tour_3d_url?: string;
  tourUrl?: string;
  tour_url?: string;
  virtualTourUrl?: string;
  virtual_tour_url?: string;
  googleDriveUrl?: string;
  google_drive_url?: string;
  driveUrl?: string;
  drive_url?: string;
  gdriveUrl?: string;
  gdrive_url?: string;
};

export type RawDQEItem = {
  id: string;
  description?: string;
  designation?: string;
  title?: string;
  lotCode?: string;
  lotNumber?: string;
  lot_code?: string;
  lot_number?: string;
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
  objectPath: string;
  publicUrl?: string;
  objectId?: string;
  bucketName?: string;
  objectName?: string;
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

export type ArchidocFileResponse = {
  object_id: string;
  object_name: string;
  original_name: string;
  content_type: string;
  size: number;
  project_id: string;
  category: string;
  uploaded_at: string;
};

export const FILE_CATEGORIES: { key: FileCategory; code: string; label: string; icon: FeatherIconName }[] = [
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

export type DQECaptureSubmitParams = {
  localId: string;
  projectId: string;
  projectName: string;
  videoObjectPath: string;
  videoUrl?: string;
  videoMimeType?: string;
  architectNotes?: string;
  videoDuration: number;
  qualityTier: DQEQualityTier;
  capturedAt: string;
  capturedBy?: string;
};

export type DQECaptureSubmitResult = {
  success: boolean;
  localId: string;
  archidocDQEId?: string;
  transcription?: string;
  error?: string;
};

export type DQEQualityTier = "efficient" | "standard" | "maximum";

export type DQESyncState = "pending" | "uploading" | "complete" | "failed";

// ── Snags (Défauts & Réserves) ────────────────────────────────────────────────

export type SnagType = "defaut" | "reserve";

export type SnagSeverity = "minor" | "major" | "critical";

export type SnagSyncState =
  | "pending"
  | "uploading_media"
  | "uploading_metadata"
  | "complete"
  | "failed";

export type SnagMediaItem = {
  type: "photo" | "video" | "audio";
  objectPath: string;
  fileName: string;
  publicUrl?: string;
  mimeType: string;
  durationSeconds?: number;
};

export type SnagSubmitParams = {
  localId: string;
  projectId: string;
  projectName: string;
  type: SnagType;
  title: string;
  description?: string;
  severity?: SnagSeverity;
  contractorId?: string;
  contractorName?: string;
  location?: string;
  media: SnagMediaItem[];
  capturedAt: string;
  capturedBy: string;
};

export type SnagSubmitResponse = {
  success: boolean;
  localId: string;
  archidocSnagId?: string;
  deepLink?: string;
  duplicate?: boolean;
  error?: string;
  code?: string;
};

export type PendingSnagMedia = {
  type: "photo" | "video" | "audio";
  localUri: string;
  fileName: string;
  mimeType: string;
  durationSeconds?: number;
  fileSize?: number;
  objectPath?: string;
  publicUrl?: string;
  uploaded: boolean;
};

export interface PendingSnagCapture {
  localId: string;
  projectId: string;
  projectName: string;
  type: SnagType;
  title: string;
  description?: string;
  severity?: SnagSeverity;
  contractorId?: string;
  contractorName?: string;
  location?: string;
  media: PendingSnagMedia[];
  capturedAt: string;
  capturedBy: string;
  syncState: SnagSyncState;
  remoteId?: string;
  deepLink?: string;
  duplicate?: boolean;
  createdAt: string;
  modifiedAt: string;
  lastSyncAttempt?: string;
  lastSyncError?: string;
  syncCompletedAt?: string;
  retryCount: number;
}

// ── Site Reminders (Points à vérifier) ───────────────────────────────────────
//
// Source of truth lives in ARCHIDOC. Wire format is snake_case (matching the
// existing OUVRO GET convention). Attachment `url` is short-lived (~1h) and must
// never be written to durable storage — re-fetch to refresh; cache object_path.

export interface RawSiteReminderAttachment {
  object_path?: string;
  objectPath?: string;
  file_name?: string;
  fileName?: string;
  content_type?: string;
  contentType?: string;
  url?: string;
}

export interface RawSiteReminder {
  id: string;
  project_id?: string;
  projectId?: string;
  body_html?: string;
  bodyHtml?: string;
  body_text?: string;
  bodyText?: string;
  is_done?: boolean;
  isDone?: boolean;
  sort_order?: number;
  sortOrder?: number;
  attachments?: RawSiteReminderAttachment[];
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
}

export interface SiteReminderListResponse {
  site_reminders?: RawSiteReminder[];
}

/** Durable-safe attachment shape — `url` is intentionally optional/ephemeral. */
export interface SiteReminderAttachment {
  objectPath: string;
  fileName: string;
  contentType: string;
  /** Short-lived display/download URL. Absent when restored from offline cache. */
  url?: string;
}

export interface SiteReminder {
  id: string;
  projectId: string;
  bodyHtml: string;
  bodyText: string;
  isDone: boolean;
  sortOrder: number;
  attachments: SiteReminderAttachment[];
  createdAt: string;
  updatedAt: string;
}

export type ReminderToggleSyncState =
  | "pending"
  | "uploading"
  | "complete"
  | "failed";

/** A queued is_done toggle awaiting reconciliation with ARCHIDOC. */
export interface PendingReminderToggle {
  localId: string;
  projectId: string;
  reminderId: string;
  isDone: boolean;
  syncState: ReminderToggleSyncState;
  /**
   * Monotonic per-toggle operation sequence. A fresh user toggle bumps this so
   * an in-flight sync of an earlier op can detect it was superseded and avoid
   * clobbering the newer intent.
   */
  opSeq: number;
  createdAt: string;
  modifiedAt: string;
  lastSyncAttempt?: string;
  lastSyncError?: string;
  retryCount: number;
}

/**
 * Durable offline cache of a project's reminder list. localId === projectId so
 * it satisfies DurableQueueStore's key constraint. Attachment `url` is stripped
 * before caching (ephemeral contract).
 */
export interface CachedReminderList {
  localId: string;
  reminders: SiteReminder[];
  cachedAt: string;
}

export interface PendingDQECapture {
  localId: string;
  projectId: string;
  projectName: string;
  videoUri: string;
  videoFileName: string;
  videoDuration: number;
  videoFileSize?: number;
  qualityTier: DQEQualityTier;
  architectNotes?: string;
  capturedAt: string;
  capturedBy: string;
  syncState: DQESyncState;
  remoteId?: string;
  createdAt: string;
  modifiedAt: string;
  lastSyncAttempt?: string;
  lastSyncError?: string;
  syncCompletedAt?: string;
  retryCount: number;
}
