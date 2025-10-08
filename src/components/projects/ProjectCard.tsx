import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Calendar, 
  Users, 
  ArrowRight, 
  AlertTriangle,
  Clock,
  Target
} from "lucide-react";
import { Project, PROJECT_STATUS_LABELS, RISK_LABELS } from "@/types/project";
import { format } from "date-fns";

interface ProjectCardProps {
  project: Project;
  onViewProject: (projectId: string) => void;
}

export function ProjectCard({ project, onViewProject }: ProjectCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-muted text-muted-foreground';
      case 'pre_approval':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'partner_assigned':
      case 'pm_assigned':
      case 'team_assembled':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'in_progress':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'qa_review':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'client_signoff':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'closed':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200';
      case 'archived':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'med':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'high':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    try {
      return format(new Date(dateString), 'dd.MM.yyyy');
    } catch {
      return '—';
    }
  };

  const isOverdue = project.due_date && new Date(project.due_date) < new Date();

  return (
    <Card className="glass-card p-6 hover:scale-[1.02] transition-all duration-300">
      {/* Заголовок */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-mono text-muted-foreground">{project.code}</span>
            {isOverdue && (
              <AlertTriangle className="w-4 h-4 text-destructive" />
            )}
          </div>
          <h3 className="text-lg font-semibold mb-2 line-clamp-2">{project.name}</h3>
          <div className="flex flex-wrap gap-2">
            <Badge className={getStatusColor(project.status)}>
              {PROJECT_STATUS_LABELS[project.status]}
            </Badge>
            <Badge className={getRiskColor(project.risk_level)}>
              {RISK_LABELS[project.risk_level]} риск
            </Badge>
          </div>
        </div>
        {project.company && (
          <div 
            className="w-4 h-16 rounded-sm opacity-60"
            style={{ backgroundColor: project.company.brand_color }}
          />
        )}
      </div>

      {/* Компания и клиент */}
      {project.company && (
        <div className="mb-4">
          <span className="text-sm text-muted-foreground">Компания: </span>
          <span className="text-sm font-medium">{project.company.name}</span>
        </div>
      )}

      {/* Информация о клиенте */}
      {project.client_info && (
        <div className="mb-4 p-3 bg-muted/50 rounded-lg">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Клиент</h4>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{project.client_info.company_name}</span>
              <span className="text-xs text-muted-foreground">{project.client_info.industry}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {project.client_info.contact_person} • {project.client_info.position}
            </div>
            <div className="text-xs text-muted-foreground">
              {project.client_info.email} • {project.client_info.phone}
            </div>
          </div>
        </div>
      )}

      {/* Отдел закупа */}
      {project.procurement_department && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Отдел закупа</h4>
          <div className="space-y-1">
            <div className="text-sm font-medium">{project.procurement_department.procurement_manager}</div>
            <div className="text-xs text-muted-foreground">
              {project.procurement_department.procurement_email} • {project.procurement_department.procurement_phone}
            </div>
            {project.procurement_department.budget_amount && (
              <div className="text-xs text-muted-foreground">
                Бюджет: {project.procurement_department.budget_amount.toLocaleString('ru-RU')} ₽
                {project.procurement_department.budget_approved && (
                  <span className="ml-2 text-green-600">✓ Утвержден</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Команда */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-muted-foreground mb-2">Команда</h4>
        <div className="space-y-2">
          {project.partner && (
            <div className="flex items-center space-x-2">
              <Avatar className="w-6 h-6">
                <AvatarFallback className="text-xs">
                  {getInitials(project.partner.full_name || project.partner.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {project.partner.full_name || project.partner.name}
                </p>
                <p className="text-xs text-muted-foreground">Партнёр</p>
              </div>
            </div>
          )}
          {project.pm && (
            <div className="flex items-center space-x-2">
              <Avatar className="w-6 h-6">
                <AvatarFallback className="text-xs">
                  {getInitials(project.pm.full_name || project.pm.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {project.pm.full_name || project.pm.name}
                </p>
                <p className="text-xs text-muted-foreground">Project Manager</p>
              </div>
            </div>
          )}
          {project.team && project.team.length > 0 && (
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Команда: {project.team.length} чел.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Даты */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="flex items-center space-x-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Начало</p>
            <p className="text-sm font-medium">{formatDate(project.start_date)}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Clock className={`w-4 h-4 ${isOverdue ? 'text-destructive' : 'text-muted-foreground'}`} />
          <div>
            <p className="text-xs text-muted-foreground">Дедлайн</p>
            <p className={`text-sm font-medium ${isOverdue ? 'text-destructive' : ''}`}>
              {formatDate(project.due_date)}
            </p>
          </div>
        </div>
      </div>

      {/* Прогресс */}
      {project.completion_percentage !== undefined && (
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Выполнение</span>
            <span className="font-medium">{project.completion_percentage}%</span>
          </div>
          <Progress 
            value={project.completion_percentage} 
            className="h-2"
          />
          {project.tasks && (
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>
                Задач: {project.tasks.filter(t => t.status === 'done').length}/{project.tasks.length}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Действия */}
      <div className="flex space-x-2">
        <Button 
          size="sm" 
          className="btn-gradient flex-1"
          onClick={() => onViewProject(project.id)}
        >
          <ArrowRight className="w-4 h-4 mr-2" />
          Перейти в проект
        </Button>
      </div>
    </Card>
  );
}