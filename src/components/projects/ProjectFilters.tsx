import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, X } from "lucide-react";
import { ProjectStatus, RiskLevel, PROJECT_STATUS_LABELS, RISK_LABELS } from "@/types/project";
import type { Company, Employee } from "@/types/project";

interface ProjectFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedCompany: string;
  onCompanyChange: (value: string) => void;
  selectedStatus: string;
  onStatusChange: (value: string) => void;
  selectedPartner: string;
  onPartnerChange: (value: string) => void;
  selectedPM: string;
  onPMChange: (value: string) => void;
  selectedRisk: string;
  onRiskChange: (value: string) => void;
  companies: Company[];
  partners: Employee[];
  pms: Employee[];
  onClearFilters: () => void;
  activeFiltersCount: number;
}

export function ProjectFilters({
  searchQuery,
  onSearchChange,
  selectedCompany,
  onCompanyChange,
  selectedStatus,
  onStatusChange,
  selectedPartner,
  onPartnerChange,
  selectedPM,
  onPMChange,
  selectedRisk,
  onRiskChange,
  companies,
  partners,
  pms,
  onClearFilters,
  activeFiltersCount
}: ProjectFiltersProps) {
  return (
    <div className="glass-card p-4 space-y-4">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Поиск */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по коду, названию проекта..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 glass border-glass-border"
          />
        </div>

        {/* Фильтры */}
        <div className="flex flex-wrap gap-2">
          <Select value={selectedCompany} onValueChange={onCompanyChange}>
            <SelectTrigger className="w-40 glass border-glass-border">
              <SelectValue placeholder="Компания" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все компании</SelectItem>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={onStatusChange}>
            <SelectTrigger className="w-40 glass border-glass-border">
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все статусы</SelectItem>
              {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedPartner} onValueChange={onPartnerChange}>
            <SelectTrigger className="w-40 glass border-glass-border">
              <SelectValue placeholder="Партнёр" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все партнёры</SelectItem>
              {partners.map((partner) => (
                <SelectItem key={partner.id} value={partner.id}>
                  {partner.full_name || partner.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedPM} onValueChange={onPMChange}>
            <SelectTrigger className="w-40 glass border-glass-border">
              <SelectValue placeholder="PM" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все PM</SelectItem>
              {pms.map((pm) => (
                <SelectItem key={pm.id} value={pm.id}>
                  {pm.full_name || pm.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedRisk} onValueChange={onRiskChange}>
            <SelectTrigger className="w-40 glass border-glass-border">
              <SelectValue placeholder="Риск" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все уровни</SelectItem>
              {Object.entries(RISK_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {activeFiltersCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearFilters}
              className="btn-glass"
            >
              <X className="w-4 h-4 mr-1" />
              Сбросить ({activeFiltersCount})
            </Button>
          )}
        </div>
      </div>

      {/* Быстрые фильтры */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedStatus === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onStatusChange('all')}
          className={selectedStatus === 'all' ? 'btn-gradient' : 'btn-glass'}
        >
          Все
        </Button>
        <Button
          variant={selectedStatus === 'pre_approval' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onStatusChange('pre_approval')}
          className={selectedStatus === 'pre_approval' ? 'btn-gradient' : 'btn-glass'}
        >
          На согласовании
        </Button>
        <Button
          variant={selectedStatus === 'in_progress' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onStatusChange('in_progress')}
          className={selectedStatus === 'in_progress' ? 'btn-gradient' : 'btn-glass'}
        >
          В работе
        </Button>
        <Button
          variant={selectedStatus === 'qa_review' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onStatusChange('qa_review')}
          className={selectedStatus === 'qa_review' ? 'btn-gradient' : 'btn-glass'}
        >
          На сдаче
        </Button>
        <Button
          variant={selectedStatus === 'closed' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onStatusChange('closed')}
          className={selectedStatus === 'closed' ? 'btn-gradient' : 'btn-glass'}
        >
          Закрытые
        </Button>
      </div>
    </div>
  );
}