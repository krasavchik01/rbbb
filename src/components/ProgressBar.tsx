import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  max?: number;
  variant?: "default" | "success" | "warning" | "destructive";
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function ProgressBar({
  value,
  max = 100,
  variant = "default",
  size = "md",
  showLabel = true,
  className
}: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100);

  const variantClasses = {
    default: "bg-gradient-to-r from-primary to-primary-glow",
    success: "bg-gradient-to-r from-success to-success-glow",
    warning: "bg-gradient-to-r from-warning to-warning-glow",
    destructive: "bg-gradient-to-r from-destructive to-red-400"
  };

  const sizeClasses = {
    sm: "h-1",
    md: "h-2",
    lg: "h-3"
  };

  return (
    <div className={cn("w-full", className)}>
      {showLabel && (
        <div className="flex justify-between text-sm mb-1">
          <span className="text-muted-foreground">Прогресс</span>
          <span className="font-medium">{percentage.toFixed(0)}%</span>
        </div>
      )}
      <div className={cn(
        "w-full bg-secondary/30 rounded-full overflow-hidden",
        sizeClasses[size]
      )}>
        <div
          className={cn(
            "transition-all duration-500 ease-out rounded-full",
            variantClasses[variant]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}