interface ProjectStatusBadgeProps {
  status: "active" | "progress" | "completed";
}

export function ProjectStatusBadge({ status }: ProjectStatusBadgeProps) {
  const statusConfig = {
    active: {
      emoji: "🟢",
      text: "Активный",
      className: "project-status-active"
    },
    progress: {
      emoji: "🟡", 
      text: "В процессе",
      className: "project-status-progress"
    },
    completed: {
      emoji: "⚫",
      text: "Завершён", 
      className: "project-status-completed"
    }
  };

  const config = statusConfig[status];

  return (
    <span className={config.className}>
      <span className="mr-1">{config.emoji}</span>
      {config.text}
    </span>
  );
}