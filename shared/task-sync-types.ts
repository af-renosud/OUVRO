export type TaskPriority = "low" | "normal" | "high" | "urgent";
export type TaskClassification = "defect" | "action" | "followup" | "general";

export interface TaskSyncPayload {
  localId: string;
  projectId: string;
  projectName: string;
  audioBase64?: string;
  transcription?: string;
  priority: TaskPriority;
  classification: TaskClassification;
  audioDuration: number;
  recordedAt: string;
  recordedBy: string;
}

export interface TaskSyncSuccessResponse {
  success: true;
  localId: string;
  archidocTaskId: string;
}

export interface TaskSyncErrorResponse {
  success: false;
  error: string;
  localId: string;
}
