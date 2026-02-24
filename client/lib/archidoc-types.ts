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
