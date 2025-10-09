import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CheckCircle, Circle, ArrowRight, AlertCircle } from "lucide-react";
import { Project, ProjectStatus, PROJECT_STATUS_LABELS, WORKFLOW_TRANSITIONS, AppRole } from "@/types/project-simple";

interface ProjectWorkflowProps {
  project: Project;
  userRole: AppRole;
  onStatusChange: (newStatus: ProjectStatus) => void;
}

export function ProjectWorkflow({ project, userRole, onStatusChange }: ProjectWorkflowProps) {
  const currentStatusIndex = Object.keys(PROJECT_STATUS_LABELS).indexOf(project.status);
  
  const canTransition = (status: ProjectStatus): boolean => {
    const transition = WORKFLOW_TRANSITIONS[project.status];
    return transition.roles.includes(userRole) && transition.next.includes(status);
  };

  const getRequirementStatus = (requirement: string): boolean => {
    switch (requirement) {
      case 'name':
        return !!project.name;
      case 'company_id':
        return !!project.company_id;
      case 'description':
        return !!project.description;
      case 'partner_id':
        return !!project.partner_id;
      case 'pm_id':
        return !!project.pm_id;
      case 'team_min_2':
        return (project.team?.length || 0) >= 2;
      case 'auto_tasks_created':
        return (project.tasks?.length || 0) > 0;
      case 'tasks_70_percent_done':
        if (!project.tasks?.length) return false;
        const doneTasks = project.tasks.filter(t => t.status === 'done').length;
        return (doneTasks / project.tasks.length) >= 0.7;
      case 'quality_checklist_100':
        // Здесь должна быть проверка чек-листа качества
        return true; // Заглушка
      default:
        return true;
    }
  };

  const getNextStatus = (): ProjectStatus | null => {
    const transition = WORKFLOW_TRANSITIONS[project.status];
    return transition.next[0] || null;
  };

  const canProceed = (): boolean => {
    const transition = WORKFLOW_TRANSITIONS[project.status];
    if (!transition.roles.includes(userRole)) return false;
    
    const requirements = transition.requirements || [];
    return requirements.every(req => getRequirementStatus(req));
  };

  const handleNextStep = () => {
    const nextStatus = getNextStatus();
    if (nextStatus && canProceed()) {
      onStatusChange(nextStatus);
    }
  };

  return (
    <Card className="glass-card p-6">
      <h3 className="text-lg font-semibold mb-6">Workflow проекта</h3>
      
      {/* Визуальная дорожка */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          {Object.entries(PROJECT_STATUS_LABELS).map(([status, label], index) => {
            const isCompleted = index < currentStatusIndex;
            const isCurrent = index === currentStatusIndex;
            const isNext = index === currentStatusIndex + 1;
            
            return (
              <div key={status} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center mb-2
                    ${isCompleted ? 'bg-success text-success-foreground' : 
                      isCurrent ? 'bg-primary text-primary-foreground' :
                      'bg-muted text-muted-foreground'}
                  `}>
                    {isCompleted ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Circle className="w-4 h-4" />
                    )}
                  </div>
                  <span className={`text-xs text-center max-w-20 ${
                    isCurrent ? 'font-medium' : 'text-muted-foreground'
                  }`}>
                    {label}
                  </span>
                </div>
                {index < Object.keys(PROJECT_STATUS_LABELS).length - 1 && (
                  <div className={`
                    flex-1 h-0.5 mx-2 
                    ${index < currentStatusIndex ? 'bg-success' : 'bg-muted'}
                  `} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Текущий статус и требования */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Badge variant="secondary" className="text-sm">
            Текущий статус: {PROJECT_STATUS_LABELS[project.status]}
          </Badge>
        </div>

        {/* Требования для перехода */}
        {WORKFLOW_TRANSITIONS[project.status].requirements && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">
              Требования для перехода:
            </h4>
            {WORKFLOW_TRANSITIONS[project.status].requirements!.map((req) => {
              const isCompleted = getRequirementStatus(req);
              const requirementLabels: Record<string, string> = {
                'name': 'Название проекта',
                'company_id': 'Выбрана компания',
                'description': 'Описание проекта',
                'partner_id': 'Назначен партнёр',
                'pm_id': 'Назначен PM',
                'team_min_2': 'Минимум 2 человека в команде',
                'auto_tasks_created': 'Созданы стартовые задачи',
                'tasks_70_percent_done': 'Выполнено 70% задач',
                'quality_checklist_100': 'Чек-лист качества выполнен на 100%'
              };

              return (
                <div key={req} className="flex items-center gap-2">
                  {isCompleted ? (
                    <CheckCircle className="w-4 h-4 text-success" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-destructive" />
                  )}
                  <span className={`text-sm ${
                    isCompleted ? 'text-success' : 'text-destructive'
                  }`}>
                    {requirementLabels[req] || req}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Кнопка следующего шага */}
      {getNextStatus() && (
        <div className="flex justify-end">
          <Button
            onClick={handleNextStep}
            disabled={!canProceed()}
            className="btn-gradient"
          >
            <ArrowRight className="w-4 h-4 mr-2" />
            {PROJECT_STATUS_LABELS[getNextStatus()!]}
          </Button>
        </div>
      )}

      {/* Информация о правах */}
      {!WORKFLOW_TRANSITIONS[project.status].roles.includes(userRole) && getNextStatus() && (
        <div className="mt-4 p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">
            Для перехода к следующему этапу требуется роль: {
              WORKFLOW_TRANSITIONS[project.status].roles.join(', ')
            }
          </p>
        </div>
      )}
    </Card>
  );
}