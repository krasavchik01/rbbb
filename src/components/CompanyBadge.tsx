import { Badge } from "@/components/ui/badge";
import { Company } from "@/types";

interface CompanyBadgeProps {
  company: Company;
  variant?: "default" | "secondary" | "outline";
}

export function CompanyBadge({ company, variant = "outline" }: CompanyBadgeProps) {
  return (
    <Badge variant={variant} className="text-xs">
      {company.displayName}
    </Badge>
  );
}