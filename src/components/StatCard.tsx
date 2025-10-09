import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  variant?: "default" | "primary" | "success" | "warning";
  onClick?: () => void;
}

export function StatCard({ 
  title, 
  value, 
  icon, 
  trend, 
  className, 
  variant = "default",
  onClick,
}: StatCardProps) {
  const variantClasses = {
    default: "glass-card",
    primary: "glass-card border-primary/30 glow-primary",
    success: "glass-card border-success/30 glow-success", 
    warning: "glass-card border-warning/30 glow-warning"
  };

  return (
    <Card 
      onClick={onClick}
      className={cn(
        "p-6 transition-all duration-300 hover:scale-105 hover:glow-primary",
        onClick ? "cursor-pointer" : "",
        variantClasses[variant],
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {trend && (
            <div className="flex items-center mt-2">
              <span className={cn(
                "text-xs px-2 py-1 rounded-full",
                trend.isPositive 
                  ? "bg-success/20 text-success" 
                  : "bg-destructive/20 text-destructive"
              )}>
                {trend.isPositive ? "+" : ""}{trend.value}%
              </span>
            </div>
          )}
        </div>
        <div className="w-12 h-12 bg-gradient-to-r from-primary/20 to-warning/20 rounded-xl flex items-center justify-center">
          {icon}
        </div>
      </div>
    </Card>
  );
}