import { cn } from "@/lib/utils";

interface KPIIndicatorProps {
  value: number;
  size?: "sm" | "md" | "lg";
  showValue?: boolean;
}

export function KPIIndicator({ value, size = "md", showValue = true }: KPIIndicatorProps) {
  const getKPILevel = (value: number) => {
    if (value >= 85) return "high";
    if (value >= 70) return "medium";
    return "low";
  };

  const level = getKPILevel(value);

  const sizeClasses = {
    sm: "text-xs px-2 py-1",
    md: "text-sm px-3 py-1",
    lg: "text-base px-4 py-2"
  };

  const levelClasses = {
    high: "kpi-high",
    medium: "kpi-medium", 
    low: "kpi-low"
  };

  return (
    <div className={cn(
      "inline-flex items-center rounded-full font-medium",
      sizeClasses[size],
      levelClasses[level]
    )}>
      <div className={cn(
        "w-2 h-2 rounded-full mr-2",
        level === "high" && "bg-success",
        level === "medium" && "bg-warning",
        level === "low" && "bg-destructive"
      )} />
      {showValue && <span>{value}%</span>}
      {!showValue && (
        <span className="capitalize">
          {level === "high" && "Высокий"}
          {level === "medium" && "Средний"} 
          {level === "low" && "Низкий"}
        </span>
      )}
    </div>
  );
}