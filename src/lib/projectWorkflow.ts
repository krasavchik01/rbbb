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
  cancelled: "Отменен",
  active: "В работе",
};

export function isTaskDoneStatus(status?: string | null) {
  return status === "done" || status === "completed";
}

export function getProjectWorkflowStatus(project: any): string {
  return project?.notes?.status || project?.status || "approved";
}

export function getProjectStatusLabel(status?: string | null): string {
  if (!status) return PROJECT_WORKFLOW_LABELS.approved;
  return PROJECT_WORKFLOW_LABELS[status] || status;
}

export function mapWorkflowStatusToSupabaseStatus(status?: string | null): SupabaseProjectStatus {
  if (status === "completed") return "completed";
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

  if (["new", "pending_approval", "cancelled", "completed"].includes(currentStatus)) {
    return currentStatus;
  }

  if (tasks.length === 0) {
    return currentStatus;
  }

  const allDone = tasks.every((task) => isTaskDoneStatus(task.status));
  return allDone ? "pending_payment_approval" : "in_progress";
}
