import { Badge } from "@/components/ui/badge";
import { Department } from "@/types";

interface DepartmentBadgeProps {
  department: Department;
  variant?: "default" | "secondary" | "outline";
}

export function DepartmentBadge({ department, variant = "outline" }: DepartmentBadgeProps) {
  return (
    <Badge variant={variant} className={`text-xs ${department.color}`}>
      {department.name}
    </Badge>
  );
}