import { ProjectStatus } from "@/types/project-v3";

export type SupabaseProjectStatus = "active" | "in_progress" | "completed";

export const PROJECT_WORKFLOW_LABELS: Record<string, string> = {
  new: "Новый",
  pending_approval: "На утверждении",
  approved: "Утвержден",
  team_assembled: "Команда собрана",
  planning: "Планирование",
  in_progress: "В работе",
  ready_to_complete: "Готов к закрытию",
  pending_payment_approval: "Ожидает CEO",
  completed: "Завершен",
  closed: "Завершен",
  cancelled: "Отменен",
  active: "В работе",
};

export function isTaskDoneStatus(status?: string | null) {
  return status === "done" || status === "completed";
}

export function getProjectWorkflowStatus(project: any): string {
  let notes = project?.notes;
  if (typeof notes === 'string') {
    try { notes = JSON.parse(notes); } catch { notes = {}; }
  }
  const directStatus = String(project?.status || '').trim().toLowerCase();
  const notesStatus = String(notes?.status || '').trim().toLowerCase();
  const closedStatuses = ['completed', 'closed', 'завершён', 'завершен', 'закрыт', 'закрыто'];
  if (closedStatuses.includes(directStatus) || closedStatuses.includes(notesStatus)) return 'completed';
  return notesStatus || directStatus || "approved";
}

export function isProjectClosed(project: any): boolean {
  return getProjectWorkflowStatus(project) === 'completed';
}

export function getProjectStatusLabel(status?: string | null): string {
  if (!status) return PROJECT_WORKFLOW_LABELS.approved;
  if (["closed", "завершён", "завершен", "закрыт", "закрыто"].includes(status.toLowerCase())) {
    return PROJECT_WORKFLOW_LABELS.completed;
  }
  return PROJECT_WORKFLOW_LABELS[status] || status;
}

export function mapWorkflowStatusToSupabaseStatus(status?: string | null): SupabaseProjectStatus {
  if (status && ["completed", "closed", "завершён", "завершен", "закрыт", "закрыто"].includes(status.toLowerCase())) return "completed";
  if (status === "in_progress" || status === "pending_payment_approval" || status === "ready_to_complete") {
    return "in_progress";
  }
  return "active";
}

export function deriveProjectStatusFromTasks(
  currentStatus: string | undefined,
  tasks: Array<{ status?: string | null }>
): ProjectStatus | string {
  if (!currentStatus) {
    return tasks.length > 0 ? "in_progress" : "approved";
  }

  if (["new", "pending_approval", "cancelled", "completed", "closed"].includes(currentStatus)) {
    return currentStatus;
  }

  if (tasks.length === 0) {
    return currentStatus;
  }

  const allDone = tasks.every((task) => isTaskDoneStatus(task.status));
  return allDone ? "pending_payment_approval" : "in_progress";
}
