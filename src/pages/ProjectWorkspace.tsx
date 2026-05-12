import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Check,
  Upload,
  FileText,
  CheckCircle,
  CheckCircle2,
  Circle,
  ChevronRight,
  Save,
  AlertCircle,
  Users,
  Calendar,
  DollarSign,
  Target,
  X,
  Edit,
  UserPlus,
  Search,
  Plus
} from "lucide-react";
import { useTemplates, useProjects } from "@/hooks/useDataStore";
import { ProjectTemplate, ProcedureElement, ELEMENT_TYPE_ICONS } from "@/types/methodology";
import { ProjectData, ElementData } from "@/types/methodology";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useProjectDataSync } from "@/hooks/useProjectDataSync";
// MethodologySelector removed
import { RUSSELL_BEDFORD_AUDIT_METHODOLOGY } from "@/lib/auditMethodology";
import { ProjectV3 } from "@/types/project-v3";
import { PROJECT_ROLES, ROLE_LABELS, UserRole, TEAM_ROLE_SLOTS } from "@/types/roles";
import { useEmployees } from "@/hooks/useSupabaseData";
import { supabaseDataStore } from "@/lib/supabaseDataStore";
import { supabase } from "@/integrations/supabase/client";
import { notifyProjectClosed, notifyBonusesApproved } from "@/lib/projectNotifications";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { calculateProjectFinances } from "@/types/project-v3";
// TaskManager removed (using Tasks page component instead)
// TaskDistribution removed
import { ProjectFileManager } from "@/components/projects/ProjectFileManager";
// TemplateManager, WorkPaperTree, WorkPaperViewer removed
import { ContractEditor } from "@/components/projects/ContractEditor";
import { ProjectEditProcurement } from "@/components/projects/ProjectEditProcurement";
import Tasks from "@/pages/Tasks";
import { Task, ChecklistItem } from "@/types/project";
// WorkPaper types removed
import { ContractInfo, ProjectAmendment } from "@/types/project-v3";
import { TeamAssignment } from "@/components/projects/TeamAssignment";
import { useMemo } from "react";
import { getProjectStatusLabel, isTaskDoneStatus } from "@/lib/projectWorkflow";

export default function ProjectWorkspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { templates } = useTemplates();
  const { projects, tasks: allTasks } = useProjects();
  const { employees } = useEmployees();
  const { toast } = useToast();
  const { user } = useAuth();

  // Получаем проект из state (если передан при навигации)
  const projectFromState = (location.state as any)?.project;
  const openTeamAssignment = (location.state as any)?.openTeamAssignment;

  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [template, setTemplate] = useState<ProjectTemplate | null>(null);
  const [project, setProject] = useState<any>(null);
  const [currentStageIndex] = useState(0);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showTeamDialog, setShowTeamDialog] = useState(false);
  // Слоты команды: роль → ID сотрудника (или null)
  const [teamSlots, setTeamSlots] = useState<Record<string, string | null>>({});
  const [openSlotDropdown, setOpenSlotDropdown] = useState<string | null>(null);
  const [slotSearch, setSlotSearch] = useState('');
  const [addingNewInSlot, setAddingNewInSlot] = useState<string | null>(null);
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [newEmployeeType, setNewEmployeeType] = useState<'staff' | 'gph' | 'subcontract'>('staff');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Дополнительные соглашения
  const [amendments, setAmendments] = useState<ProjectAmendment[]>([]);

  // Проверка роли партнёра
  const isPartner = user?.role === 'partner';
  const isPM = user?.role === 'manager_1' || user?.role === 'manager_2' || user?.role === 'manager_3';
  const isDirector = user?.role === 'ceo' || user?.role === 'deputy_director';
  const isProcurement = user?.role === 'procurement';
  const isAdmin = user?.role === 'admin';
  const isProcurementOrAdmin = isProcurement || isAdmin;
  const canSeeContracts = isProcurement || isAdmin || isPartner || isPM || isDirector;
  const projectStatus = project?.notes?.status || project?.status;
  const isCompleted = projectStatus === 'completed';
  const isInProgress = projectStatus === 'in_progress';
  const isPendingPaymentApproval = projectStatus === 'pending_payment_approval';
  const canCompleteProject = (isPartner || isPM) && (isInProgress || projectStatus === 'ready_to_complete');
  // Директор/зам видят только общую информацию, без деталей методологии
  const showFullDetails = !isDirector;

  // Хук для синхронизации с Supabase (работает ТОЛЬКО если id существует)
  const { loadProjectData, saveProjectData: syncSaveProjectData, syncStatus, forceSync } =
    useProjectDataSync(id || '');

  // Фильтруем задачи для текущего проекта (всегда вызывается, до условных вычислений)
  const projectTasks = useMemo(() => {
    if (!id || !allTasks) return [];
    return allTasks.filter((task: any) =>
      task.project_id === id ||
      task.project_id === project?.id ||
      task.project_id === project?.notes?.id
    );
  }, [id, allTasks, project]);

  // Группируем задачи по сотрудникам (всегда вызывается, до условных вычислений)
  const tasksByEmployee = useMemo(() => {
    const grouped: Record<string, Task[]> = {};

    projectTasks.forEach((task: any) => {
      const assignees = task.assignees || [];
      if (assignees.length === 0) {
        // Задачи без назначенных
        if (!grouped['unassigned']) {
          grouped['unassigned'] = [];
        }
        grouped['unassigned'].push(task);
      } else {
        assignees.forEach((assigneeId: string) => {
          if (!grouped[assigneeId]) {
            grouped[assigneeId] = [];
          }
          grouped[assigneeId].push(task);
        });
      }
    });

    return grouped;
  }, [projectTasks]);

  // Загрузить существующую команду в слоты
  const loadTeamIntoSlots = useCallback((proj: any) => {
    const existingTeam = proj?.team || proj?.notes?.team || [];
    const slots: Record<string, string | null> = {};
    existingTeam.forEach((m: any) => {
      const slotKey = m.slotKey || m.role || '';
      if (slotKey) {
        slots[slotKey] = m.userId || m.id || null;
      }
    });
    setTeamSlots(slots);
  }, []);

  // Открыть диалог назначения команды если пришли с флагом
  useEffect(() => {
    if (openTeamAssignment && project) {
      setShowTeamDialog(true);
      loadTeamIntoSlots(project);
    }
  }, [openTeamAssignment, project, loadTeamIntoSlots]);

  // Загрузка дополнительных соглашений из JSON проекта
  useEffect(() => {
    if (project) {
      const contractAmendments = project?.contract?.amendments || project?.notes?.contract?.amendments || [];
      setAmendments(contractAmendments);
    }
  }, [project?.contract?.amendments, project?.notes?.contract?.amendments]);

  // Загрузка данных проекта (с синхронизацией)
  useEffect(() => {
    if (!id) return;

    // Если проект уже установлен и это тот же проект, не перезагружаем
    if (project) {
      const currentProjectId = project.id || project.notes?.id || '';
      if (currentProjectId === id || (typeof currentProjectId === 'string' && currentProjectId.includes(id))) {
        return;
      }
    }

    // ПРИОРИТЕТ 1: Используем проект из state (если передан при навигации)
    if (projectFromState) {
      const stateProjectId = projectFromState.id || projectFromState.notes?.id || '';
      if (stateProjectId === id || (typeof stateProjectId === 'string' && stateProjectId.includes(id))) {
        console.log('✅ [ProjectWorkspace] Используем проект из state:', projectFromState.name || projectFromState.id);
        setProject(projectFromState);

        // Загружаем данные проекта
        loadProjectData().then(data => {
          if (data) {
            setProjectData(data);
            const foundTemplate = templates.find(t => t.id === data.templateId);
            if (foundTemplate) {
              setTemplate(foundTemplate);
            }
          }
          // Проверяем тип проекта для автоматического выбора шаблона
          const projectType = projectFromState.type || projectFromState.notes?.type;
          if (projectType === 'audit' || projectFromState.name?.toLowerCase().includes('аудит')) {
            setTemplate(RUSSELL_BEDFORD_AUDIT_METHODOLOGY);
          }
        });
        return;
      }
    }

    // ПРИОРИТЕТ 2: Ищем проект в списке проектов
    const foundProject = projects.find(p => {
      const projectId = p.id || p.notes?.id || '';
      const notesId = p.notes?.id || '';
      return (
        projectId === id ||
        notesId === id ||
        (typeof projectId === 'string' && projectId.includes(id)) ||
        (typeof notesId === 'string' && notesId.includes(id))
      );
    });

    // Если проект найден и еще не установлен, устанавливаем его
    if (foundProject) {
      // Если проект уже установлен и это тот же проект, не обновляем
      if (project?.id === foundProject.id || project?.notes?.id === foundProject.notes?.id) {
        return;
      }

      console.log('✅ [ProjectWorkspace] Проект найден в списке:', foundProject.name || foundProject.id);
      setProject(foundProject);

      // Загружаем данные с автоматической синхронизацией
      loadProjectData().then(data => {
        if (data) {
          setProjectData(data);
          const foundTemplate = templates.find(t => t.id === data.templateId);
          if (foundTemplate) {
            setTemplate(foundTemplate);
          }
        }
        // Проверяем тип проекта
        const projectType = foundProject.type || foundProject.notes?.type;
        if (projectType === 'audit' || foundProject.name?.toLowerCase().includes('аудит')) {
          setTemplate(RUSSELL_BEDFORD_AUDIT_METHODOLOGY);
        }
      });
    } else if (projects.length > 0) {
      // Проекты загружены, но нужный проект не найден - пробуем загрузить напрямую из Supabase
      console.warn('⚠️ [ProjectWorkspace] Проект не найден в списке, пробуем загрузить напрямую:', id);
      supabaseDataStore.getProjects().then(allProjects => {
        const directProject = allProjects.find(p => {
          const projectId = p.id || p.notes?.id || '';
          return projectId === id || (typeof projectId === 'string' && projectId.includes(id));
        });
        if (directProject) {
          console.log('✅ [ProjectWorkspace] Проект найден напрямую из Supabase:', directProject.name || directProject.id);
          setProject(directProject);
          loadProjectData().then(data => {
            if (data) setProjectData(data);
            const projectType = directProject.type || directProject.notes?.type;
            if (projectType === 'audit' || directProject.name?.toLowerCase().includes('аудит')) {
              setTemplate(RUSSELL_BEDFORD_AUDIT_METHODOLOGY);
            }
          });
        } else {
          console.error('❌ [ProjectWorkspace] Проект не найден, перенаправление...');
          setTimeout(() => navigate('/projects'), 1000);
        }
      });
    }
    // Если projects.length === 0, просто ждем следующего рендера (проекты еще загружаются)
  }, [id, projects, templates, loadProjectData, projectFromState, project]);

  const saveProjectDataLocal = (data: ProjectData) => {
    setProjectData(data);
    // Автоматически синхронизируем с Supabase (если доступен)
    syncSaveProjectData(data);
  };

  const handleElementUpdate = (stageId: string, elementId: string, updates: Partial<ElementData>) => {
    if (!projectData) return;

    const newData = { ...projectData };

    if (!newData.stagesData[stageId]) {
      newData.stagesData[stageId] = {};
    }

    const existingData = newData.stagesData[stageId][elementId] || {
      elementId,
      completed: false
    };

    newData.stagesData[stageId][elementId] = {
      ...existingData,
      ...updates
    };

    // Пересчитываем прогресс
    const totalElements = template?.stages.reduce((sum, stage) => sum + stage.elements.length, 0) || 0;
    let completedElements = 0;

    Object.values(newData.stagesData).forEach(stageData => {
      Object.values(stageData).forEach(elementData => {
        if (elementData.completed) completedElements++;
      });
    });

    newData.completionStatus = {
      totalElements,
      completedElements,
      percentage: totalElements > 0 ? Math.round((completedElements / totalElements) * 100) : 0
    };

    saveProjectDataLocal(newData);

    toast({
      title: "Сохранено",
      description: "Изменения сохранены",
    });
  };

  const toggleElementComplete = (stageId: string, elementId: string) => {
    if (!projectData) return;

    const elementData = projectData.stagesData[stageId]?.[elementId];
    const isCompleted = elementData?.completed || false;

    handleElementUpdate(stageId, elementId, {
      completed: !isCompleted,
      completedAt: !isCompleted ? new Date().toISOString() : undefined,
      completedBy: !isCompleted ? user?.id : undefined
    });
  };

  // Функция сохранения выбранных процедур методологии
  // displayStages определяется ниже после activeTemplate

  const renderElementInput = (stageId: string, element: ProcedureElement) => {
    const elementData = projectData?.stagesData[stageId]?.[element.id];
    const isCompleted = elementData?.completed || false;

    switch (element.type) {
      case 'header':
        return (
          <div className="py-4">
            <h3 className="text-lg font-semibold text-primary">{element.title}</h3>
            {element.description && (
              <p className="text-sm text-muted-foreground mt-1">{element.description}</p>
            )}
          </div>
        );

      case 'question':
        return (
          <Card className={`p-4 ${isCompleted ? 'bg-green-50 border-green-200' : ''}`}>
            <div className="flex items-start gap-3">
              <Button
                variant={isCompleted ? "default" : "outline"}
                size="icon"
                className={isCompleted ? "bg-green-500 hover:bg-green-600" : ""}
                onClick={() => toggleElementComplete(stageId, element.id)}
              >
                {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
              </Button>
              <div className="flex-1 space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{ELEMENT_TYPE_ICONS[element.type]}</span>
                    <h4 className="font-semibold">{element.title}</h4>
                    {element.required && <Badge variant="destructive">Обязательно</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground font-medium">{element.question}</p>
                </div>
                <div>
                  <Label htmlFor={`answer-${element.id}`}>Ваш ответ:</Label>
                  <Textarea
                    id={`answer-${element.id}`}
                    value={elementData?.answer || ''}
                    onChange={(e) => handleElementUpdate(stageId, element.id, { answer: e.target.value })}
                    placeholder="Введите ваш ответ..."
                    rows={4}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          </Card>
        );

      case 'procedure':
        return (
          <Card className={`p-4 ${isCompleted ? 'bg-green-50 border-green-200' : ''}`}>
            <div className="flex items-start gap-3">
              <Button
                variant={isCompleted ? "default" : "outline"}
                size="icon"
                className={isCompleted ? "bg-green-500 hover:bg-green-600" : ""}
                onClick={() => toggleElementComplete(stageId, element.id)}
              >
                {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
              </Button>
              <div className="flex-1 space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{ELEMENT_TYPE_ICONS[element.type]}</span>
                    <h4 className="font-semibold">{element.title}</h4>
                    {element.required && <Badge variant="destructive">Обязательно</Badge>}
                  </div>
                  {element.description && (
                    <p className="text-sm text-muted-foreground">{element.description}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor={`work-${element.id}`}>Описание выполненной работы:</Label>
                  <Textarea
                    id={`work-${element.id}`}
                    value={elementData?.workDescription || ''}
                    onChange={(e) => handleElementUpdate(stageId, element.id, { workDescription: e.target.value })}
                    placeholder="Опишите что было сделано..."
                    rows={3}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor={`comments-${element.id}`}>Комментарии / Несоответствия:</Label>
                  <Textarea
                    id={`comments-${element.id}`}
                    value={elementData?.comments || ''}
                    onChange={(e) => handleElementUpdate(stageId, element.id, { comments: e.target.value })}
                    placeholder="Укажите комментарии или найденные несоответствия..."
                    rows={2}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          </Card>
        );

      case 'file':
        return (
          <Card className={`p-4 ${isCompleted ? 'bg-green-50 border-green-200' : ''}`}>
            <div className="flex items-start gap-3">
              <Button
                variant={isCompleted ? "default" : "outline"}
                size="icon"
                className={isCompleted ? "bg-green-500 hover:bg-green-600" : ""}
                onClick={() => toggleElementComplete(stageId, element.id)}
              >
                {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
              </Button>
              <div className="flex-1 space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{ELEMENT_TYPE_ICONS[element.type]}</span>
                    <h4 className="font-semibold">{element.title}</h4>
                    {element.required && <Badge variant="destructive">Обязательно</Badge>}
                  </div>
                  {element.description && (
                    <p className="text-sm text-muted-foreground">{element.description}</p>
                  )}
                </div>
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium mb-1">Нажмите для загрузки файла</p>
                  <p className="text-xs text-muted-foreground">
                    {element.config?.allowedFileTypes?.join(', ') || 'Любой формат'} •
                    Макс. {element.config?.maxFileSize || 10} МБ
                  </p>
                  <input type="file" className="hidden" accept={element.config?.allowedFileTypes?.join(',')} />
                </div>
                {elementData?.files && elementData.files.length > 0 && (
                  <div className="space-y-2">
                    {elementData.files.map((file, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded">
                        <FileText className="w-4 h-4" />
                        <span className="text-sm flex-1">{file.name}</span>
                        <Badge variant="outline">{(file.size / 1024).toFixed(1)} КБ</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>
        );

      case 'signature':
        return (
          <Card className={`p-4 ${isCompleted ? 'bg-green-50 border-green-200' : 'border-yellow-200 bg-yellow-50'}`}>
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{ELEMENT_TYPE_ICONS[element.type]}</span>
                  <h4 className="font-semibold">{element.title}</h4>
                  {element.required && <Badge variant="destructive">Обязательно</Badge>}
                </div>
                {element.description && (
                  <p className="text-sm text-muted-foreground mb-3">{element.description}</p>
                )}
                {isCompleted ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">Утверждено</span>
                    {elementData?.signedAt && (
                      <span className="text-sm text-muted-foreground">
                        • {new Date(elementData.signedAt).toLocaleString('ru-RU')}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-yellow-600">
                    <AlertCircle className="w-5 h-5" />
                    <span className="font-medium">Ожидает утверждения ({element.requiredRole})</span>
                  </div>
                )}
              </div>
              {user?.role === element.requiredRole && !isCompleted && (
                <Button
                  onClick={() => handleElementUpdate(stageId, element.id, {
                    completed: true,
                    signedBy: user.id,
                    signedAt: new Date().toISOString()
                  })}
                  className="bg-green-500 hover:bg-green-600"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Утвердить
                </Button>
              )}
            </div>
          </Card>
        );

      default:
        return null;
    }
  };

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-lg">Загрузка проекта...</div>
        </div>
      </div>
    );
  }

  // Автоматически определяем шаблон: если проект аудиторский - используем методологию Russell Bedford
  const activeTemplate = template || (project?.type === 'audit' || project?.notes?.type === 'audit' ||
    project?.contract?.subject?.toLowerCase().includes('аудит') ||
    project?.name?.toLowerCase().includes('аудит') ? RUSSELL_BEDFORD_AUDIT_METHODOLOGY : null);

  // Если шаблон все еще не найден, но есть проект - показываем карточку без шаблона
  // (можно работать с задачами и файлами)

  // Используем displayStages для навигации (только если есть шаблон)
  const displayStages = activeTemplate ? (projectData?.methodology ?
    activeTemplate.stages
      .filter(stage =>
        projectData.methodology.stages.some((ms: any) => ms.stageId === stage.id)
      )
      .map(stage => {
        const stageData = projectData.methodology.stages.find((ms: any) => ms.stageId === stage.id);
        const procedures = projectData.methodology.selectedProcedures || [];
        return {
          ...stage,
          elements: stage.elements
            .filter(el => procedures.some((p: any) => p.elementId === el.id && p.stageId === stage.id))
            .map(el => {
              const procedure = procedures.find((p: any) => p.elementId === el.id && p.stageId === stage.id);
              return {
                ...el,
                responsibleRole: procedure?.responsibleRole,
                responsibleUserId: procedure?.responsibleUserId
              };
            })
        };
      }) : activeTemplate.stages) : [];

  const currentStage = displayStages[currentStageIndex] || displayStages[0];
  const stageProgress = currentStage ?
    (Object.values((projectData?.stagesData[currentStage.id] || {})).filter((e: any) => e.completed).length / currentStage.elements.length) * 100
    : 0;

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in p-2 sm:p-4 md:p-0 w-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
          <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={() => navigate('/projects')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-base sm:text-xl font-bold truncate max-w-full" title={project.name || project.client?.name || 'Проект'}>{project.name || project.client?.name || 'Проект'}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              {activeTemplate?.name || project.contract?.subject || 'Проект'}
              {projectTasks.length > 0 && ` • ${projectTasks.length} задач`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap pl-11 sm:pl-0 flex-shrink-0">
          {/* Кнопка редактирования для закупщика и админа */}
          {isProcurementOrAdmin && project && (
            <Button variant="outline" size="sm" onClick={() => setIsEditDialogOpen(true)}>
              <Edit className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Редактировать</span>
            </Button>
          )}
          {/* Индикатор синхронизации */}
          {syncStatus.isSyncing && (
            <Badge variant="outline" className="animate-pulse text-xs">
              🔄 Синхр...
            </Badge>
          )}
          {!syncStatus.isSyncing && syncStatus.isOnline && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs hidden sm:flex">
              ✅ Синхронизировано
            </Badge>
          )}
          {!syncStatus.isSyncing && !syncStatus.isOnline && (
            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">
              💾 Локально
            </Badge>
          )}
          {projectData && projectData.completionStatus && (
            <Badge className="bg-gradient-to-r from-blue-500 to-blue-700 text-sm sm:text-lg px-2 sm:px-4 py-1 sm:py-2">
              {projectData.completionStatus.percentage || 0}%
            </Badge>
          )}
        </div>
      </div>

      {/* Общий прогресс (только если есть шаблон) */}
      {projectData && projectData.completionStatus && activeTemplate && (
        <Card className="p-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Общий прогресс</span>
              <span className="text-sm text-muted-foreground">
                {projectData.completionStatus.completedElements || 0} из {projectData.completionStatus.totalElements || 0} выполнено
              </span>
            </div>
            <Progress value={projectData.completionStatus.percentage || 0} className="h-3" />
          </div>
        </Card>
      )}

      {/* Статистика задач (если нет шаблона, но есть задачи) */}
      {!activeTemplate && projectTasks.length > 0 && (
        <Card className="p-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Задачи проекта</span>
              <span className="text-sm text-muted-foreground">
                {projectTasks.filter((t: any) => isTaskDoneStatus(t.status)).length} из {projectTasks.length} выполнено
              </span>
            </div>
            <Progress
              value={projectTasks.length > 0 ?
                (projectTasks.filter((t: any) => isTaskDoneStatus(t.status)).length / projectTasks.length) * 100 : 0}
              className="h-3"
            />
          </div>
        </Card>
      )}

      {/* Ранее здесь была старая информационная панель. Теперь вся эта информация перенесена в красивый Дашборд ниже. */}

      {/* Вкладки с информацией о проекте */}
      <Tabs defaultValue={isProcurement ? "files" : "dashboard"} className="w-full">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1">
          {!isProcurement && <TabsTrigger value="dashboard" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5">📊 <span className="hidden sm:inline">Дашборд</span><span className="sm:hidden">Обзор</span></TabsTrigger>}
          {!(isDirector || isAdmin || isProcurement) && <TabsTrigger value="tasks" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5">✅ Задачи</TabsTrigger>}
          <TabsTrigger value="files" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5">📁 Файлы</TabsTrigger>
          <TabsTrigger value="contract" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5">📜 Договор</TabsTrigger>
        </TabsList>

        {/* Главный Дашборд для всех ролей */}
        {project && (
          <TabsContent value="dashboard" className="space-y-4 sm:space-y-6 mt-4 sm:mt-6">
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">

              {/* Главный прогресс */}
              <Card className="p-6 bg-primary/5 border-primary/20 flex flex-col justify-center items-center text-center lg:col-span-1 shadow-sm">
                <Target className="w-12 h-12 text-primary mb-4" />
                <h3 className="text-xl font-bold mb-2">Общий прогресс</h3>
                <div className="w-full max-w-[200px] mb-2">
                  <div className="flex justify-between text-sm font-medium mb-1">
                    <span>Выполнено</span>
                    <span className="text-blue-700">{project.completionPercent || project.completion || 0}%</span>
                  </div>
                  <Progress value={project.completionPercent || project.completion || 0} className="h-3" />
                </div>
                <Badge variant={projectStatus === 'completed' ? 'default' : 'secondary'} className="mt-4 text-sm px-4 py-1">
                  {getProjectStatusLabel(projectStatus)}
                </Badge>
              </Card>

              {/* Текущий этап и задачи */}
              <Card className="p-6 lg:col-span-2 shadow-sm border-border">
                <div className="flex items-center gap-2 mb-6">
                  <CheckCircle2 className="w-6 h-6 text-primary" />
                  <h3 className="text-xl font-bold">Статус выполнения</h3>
                </div>

                <div className="space-y-6">
                  {/* Активный этап */}
                  {(() => {
                    let activeStageName = 'Этапы не определены';
                    let activeStageProgress = 0;
                    if (displayStages.length > 0 && projectData?.stagesData) {
                      const activeStage = displayStages.find(stage => {
                        const stageData = projectData.stagesData[stage.id] || {};
                        const completed = Object.values(stageData).filter((e: any) => e.completed).length;
                        return completed < stage.elements.length;
                      });
                      if (activeStage) {
                        activeStageName = activeStage.name;
                        const stageData = projectData.stagesData[activeStage.id] || {};
                        const completed = Object.values(stageData).filter((e: any) => e.completed).length;
                        activeStageProgress = activeStage.elements.length > 0 ? Math.round((completed / activeStage.elements.length) * 100) : 0;
                      } else {
                        activeStageName = 'Все этапы завершены';
                        activeStageProgress = 100;
                      }
                    }
                    return (
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Текущий этап (методология)</span>
                          <span className="text-sm font-bold">{activeStageProgress}%</span>
                        </div>
                        <p className="font-semibold text-lg mb-2 truncate" title={activeStageName}>{activeStageName}</p>
                        <Progress value={activeStageProgress} className="h-2" />
                      </div>
                    );
                  })()}

                  {/* Сводка по задачам */}
                  {(() => {
                    const total = projectTasks.length;
                    const completed = projectTasks.filter(t => isTaskDoneStatus(t.status)).length;
                    const inProgress = projectTasks.filter(t => t.status === 'in_progress').length;
                    const tasksPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

                    return (
                      <div className="bg-secondary/40 p-4 rounded-xl border border-secondary/60">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Задачи проекта</span>
                          <span className="text-sm font-bold">{completed} / {total}</span>
                        </div>
                        <div className="flex gap-4">
                          <div className="flex-1 flex flex-col justify-center">
                            <Progress value={tasksPercent} className="h-2 mb-1" />
                          </div>
                          <div className="flex gap-3 text-sm">
                            <div className="flex items-center gap-1.5 border-l-2 border-amber-500 pl-2">
                              <span className="text-muted-foreground">В работе:</span>
                              <span className="font-semibold">{inProgress}</span>
                            </div>
                            <div className="flex items-center gap-1.5 border-l-2 border-green-500 pl-2">
                              <span className="text-muted-foreground">Готово:</span>
                              <span className="font-semibold">{completed}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </Card>

              {/* Временная шкала */}
              <Card className="p-6 lg:col-span-1 shadow-sm border-border flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-6 h-6 text-primary" />
                  <h3 className="text-xl font-bold">Таймлайн</h3>
                </div>
                {(() => {
                  let daysTotal = 0, daysPassed = 0, daysRemaining = 0, timeProgress = 0;
                  const endStr = project.contract?.serviceEndDate || project.deadline;
                  const startStr = project.createdAt;

                  if (startStr && endStr) {
                    const start = new Date(startStr).getTime();
                    const end = new Date(endStr).getTime();
                    const now = new Date().getTime();

                    if (end > start) {
                      daysTotal = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
                      daysPassed = Math.max(0, Math.ceil((now - start) / (1000 * 60 * 60 * 24)));
                      daysRemaining = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
                      timeProgress = Math.min(100, Math.max(0, Math.round((daysPassed / daysTotal) * 100)));
                    }
                  }

                  return endStr ? (
                    <div className="space-y-4">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Осталось дней</p>
                        <p className={`text-4xl font-bold ${daysRemaining < 3 ? 'text-red-500' : daysRemaining < 10 ? 'text-amber-500' : 'text-foreground'}`}>
                          {daysRemaining > 0 ? daysRemaining : 0}
                        </p>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>Старт</span>
                          <span>Финиш</span>
                        </div>
                        <Progress value={timeProgress} className={`h-2 ${daysRemaining < 3 ? '[&>div]:bg-red-500' : timeProgress > 80 ? '[&>div]:bg-amber-500' : ''}`} />
                      </div>

                      <div className="bg-secondary/40 p-3 rounded-lg flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Дедлайн:</span>
                        <span className="font-medium">{new Date(endStr).toLocaleDateString('ru-RU')}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-4">Сроки не заданы</div>
                  );
                })()}
              </Card>

              {/* Команда проекта */}
              <Card className="p-6 lg:col-span-4 shadow-sm border-border">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-6 h-6 text-primary" />
                    <h3 className="text-xl font-bold">Управление командой</h3>
                  </div>
                  <Button onClick={() => {
                    loadTeamIntoSlots(project);
                    setShowTeamDialog(true);
                  }} variant="outline">
                    <Edit className="w-4 h-4 mr-2" />
                    Изменить состав
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {(project.team || project.notes?.team || []).map((member: any, index: number) => {
                    const isExternal = member.type === 'gph' || member.type === 'subcontract';
                    const employee = !isExternal ? employees.find((e: any) => e.id === (member.userId || member.id || member.employeeId)) : null;
                    const roleLabel = member.role === 'partner' ? 'Партнер' :
                      member.role === 'manager_1' ? 'Менеджер 1' :
                        member.role === 'senior_auditor' ? 'Ст. аудитор' :
                          member.role === 'assistant' ? 'Ассистент' : member.role || 'Участник';
                    const displayName = employee?.name || member.name || member.userName || 'Неизвестный';
                    return (
                      <div key={index} className={`flex items-center gap-3 p-3 bg-card shadow-sm rounded-xl border transition-colors ${isExternal ? 'border-orange-200 hover:border-orange-400' : 'border-border hover:border-primary/30'}`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${isExternal ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' : 'bg-primary/10 text-primary'}`}>
                          {displayName[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" title={displayName}>
                            {displayName}
                          </p>
                          <div className="flex items-center gap-1.5">
                            {isExternal && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-orange-300 text-orange-600">
                                {member.type === 'gph' ? 'ГПХ' : 'Субподряд'}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">{roleLabel}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {(!project.team || project.team.length === 0) && (
                    <div className="col-span-full text-center py-6 text-muted-foreground border-2 border-dashed rounded-xl">
                      Команда пока не назначена
                    </div>
                  )}
                </div>
              </Card>

              {/* Финансовая сводка */}
              {((project.financialVisibility?.enabled && project.financialVisibility?.visibleTo?.includes(user?.id || '')) ||
                !project.financialVisibility || (project.finances && (isPartner || isDirector || isAdmin || isPM))) ? (
                <Card className="p-6 lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-muted/30 border-border">
                  <div className="col-span-full flex items-center gap-2 mb-2">
                    <DollarSign className="w-6 h-6 text-green-600" />
                    <h3 className="text-xl font-bold">Финансовая сводка</h3>
                  </div>

                  <div className="bg-card p-4 rounded-lg border border-border">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Сумма без НДС</p>
                    <p className="text-2xl font-bold">
                      {project.finances?.amountWithoutVAT ? Number(project.finances.amountWithoutVAT).toLocaleString('ru-RU') : '0'} ₸
                    </p>
                  </div>

                  <div className="bg-card p-4 rounded-lg border border-border">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">База бонусов</p>
                    <p className="text-2xl font-bold">
                      {project.finances?.bonusBase ? Number(project.finances.bonusBase).toLocaleString('ru-RU') : '0'} ₸
                    </p>
                  </div>

                  {(isDirector || isAdmin || isPartner || isPM) && (
                    <div className="bg-card p-4 rounded-lg border border-green-500/20">
                      <p className="text-xs text-green-700 font-medium uppercase tracking-wider mb-1">Общие бонусы</p>
                      <p className="text-2xl font-bold text-green-600">
                        {project.finances?.totalBonusAmount ? Number(project.finances.totalBonusAmount).toLocaleString('ru-RU') : '0'} ₸
                      </p>
                    </div>
                  )}

                  {(isDirector || isAdmin || isPartner || isPM) && (
                    <div className="bg-card p-4 rounded-lg border border-blue-500/20">
                      <p className="text-xs text-blue-700 font-medium uppercase tracking-wider mb-1">Валовая прибыль</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {project.finances?.grossProfit ? Number(project.finances.grossProfit).toLocaleString('ru-RU') : '0'} ₸
                      </p>
                    </div>
                  )}
                </Card>
              ) : project.finances ? (
                <Card className="p-6 lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/30 border-border">
                  <div className="col-span-full flex items-center gap-2 mb-2">
                    <DollarSign className="w-6 h-6 text-muted-foreground" />
                    <h3 className="text-xl font-bold text-muted-foreground">Финансовая информация</h3>
                  </div>

                  <div className="bg-card p-4 rounded-lg border border-border">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Сумма без НДС</p>
                    <p className="text-2xl font-bold">
                      {project.finances?.amountWithoutVAT ? Number(project.finances.amountWithoutVAT).toLocaleString('ru-RU') : '0'} ₸
                    </p>
                  </div>
                  <div className="bg-card p-4 rounded-lg border border-border flex items-center justify-center">
                    <p className="text-sm text-muted-foreground text-center">Детальная финансовая информация доступна руководству, партнёрам и менеджерам</p>
                  </div>
                </Card>
              ) : null}
            </div>
          </TabsContent>
        )}

        {/* Вкладка задач */}
        {!(isDirector || isAdmin) && (
          <TabsContent value="tasks" className="mt-4">
            <Tasks projectId={project?.id || id} embedded />
          </TabsContent>
        )}

        {/* Вкладка файлов */}
        <TabsContent value="files" className="space-y-4 mt-4">
          <ProjectFileManager
            projectId={project?.id || id || ''}
            uploadedBy={user?.id || ''}
            initialFiles={project?.notes?.files || []}
            canDelete={() => isProcurementOrAdmin}
            onFilesChange={(files) => {
              // Можно обновить состояние если нужно
            }}
          />
        </TabsContent>

        {/* Вкладка договора и доп соглашений */}
        <TabsContent value="contract" className="space-y-4 mt-4">
          <ContractEditor
            projectId={project?.id || id || ''}
            contract={project?.contract || project?.notes?.contract || null}
            amendments={amendments}
            projectType={project?.type || project?.notes?.type || ''}
            companyId={project?.companyId || project?.notes?.companyId || ''}
            companyName={project?.companyName || project?.notes?.companyName || ''}
            projectFiles={project?.notes?.files || []}
            onContractUpdate={async (updatedContract) => {
              if (project) {
                const newAmount = updatedContract.amountWithoutVAT || 0;
                const newVat = updatedContract.vatRate || 0;
                const newVatAmount = newAmount * (newVat / 100);
                const newFinances = {
                  ...(project.notes?.finances || {}),
                  amountWithoutVAT: newAmount,
                  vatRate: newVat,
                  vatAmount: newVatAmount,
                  amountWithVAT: newAmount + newVatAmount,
                  currency: updatedContract.currency || 'KZT',
                };

                // Обновляем ВСЕ поля локального состояния сразу
                setProject({
                  ...project,
                  contract: updatedContract,
                  amountWithoutVAT: newAmount,
                  finances: newFinances,
                  notes: {
                    ...(project.notes || {}),
                    contract: updatedContract,
                    finances: newFinances,
                    amountWithoutVAT: newAmount,
                  },
                });

                // Сохраняем в Supabase
                try {
                  await supabaseDataStore.updateProject(project.id || id, {
                    contract: updatedContract,
                    finances: newFinances,
                    amountWithoutVAT: newAmount,
                  });
                  toast({
                    title: '✅ Договор обновлён',
                    description: 'Изменения сохранены',
                  });
                } catch (error) {
                  console.error('Error updating project:', error);
                  toast({
                    title: '❌ Ошибка',
                    description: 'Не удалось сохранить договор',
                    variant: 'destructive',
                  });
                }
              }
            }}
            onProjectSettingsUpdate={async (settings) => {
              if (project) {
                const updatedProject = {
                  ...project,
                  ...(settings.type && { type: settings.type }),
                  ...(settings.companyId && { companyId: settings.companyId }),
                  ...(settings.companyName && { companyName: settings.companyName }),
                };
                setProject(updatedProject);

                try {
                  await supabaseDataStore.updateProject(project.id || id, {
                    ...(settings.type && { type: settings.type }),
                    ...(settings.companyId && { companyId: settings.companyId }),
                    ...(settings.companyName && { companyName: settings.companyName }),
                  });
                } catch (error) {
                  console.error('Error updating project settings:', error);
                }
              }
            }}
            onAmendmentAdd={async (amendment) => {
              const newAmendments = [amendment, ...amendments];
              setAmendments(newAmendments);

              // Сохраняем в JSON проекта
              if (project) {
                const currentContract = project.contract || project.notes?.contract || {};
                const updatedContract = {
                  ...currentContract,
                  amendments: newAmendments,
                };
                const updatedProject = {
                  ...project,
                  contract: updatedContract,
                  notes: { ...(project.notes || {}), contract: updatedContract },
                };
                setProject(updatedProject);

                try {
                  await supabaseDataStore.updateProject(project.id || id, {
                    contract: updatedContract,
                  });
                  toast({
                    title: '✅ Доп. соглашение сохранено',
                  });
                } catch (error) {
                  console.error('Error saving amendment:', error);
                  toast({
                    title: '❌ Ошибка',
                    description: 'Не удалось сохранить доп. соглашение',
                    variant: 'destructive',
                  });
                }
              }
            }}
            onAmendmentDelete={async (amendmentId) => {
              const newAmendments = amendments.filter(a => a.id !== amendmentId);
              setAmendments(newAmendments);

              // Сохраняем в JSON проекта
              if (project) {
                const currentContract = project.contract || project.notes?.contract || {};
                const updatedContract = {
                  ...currentContract,
                  amendments: newAmendments,
                };
                const updatedProject = {
                  ...project,
                  contract: updatedContract,
                  notes: { ...(project.notes || {}), contract: updatedContract },
                };
                setProject(updatedProject);

                try {
                  await supabaseDataStore.updateProject(project.id || id, {
                    contract: updatedContract,
                  });
                } catch (error) {
                  console.error('Error deleting amendment:', error);
                }
              }
            }}
            canEdit={isProcurementOrAdmin}
          />
        </TabsContent>
      </Tabs>

      {/* Этапы аудита и паспорт проекта — УБРАНЫ */}

      {/* Кнопка завершения проекта */}
      {canCompleteProject && projectTasks.length === 0 && !isCompleted && !isPendingPaymentApproval && (
        <Card className="p-6 border-green-200 bg-green-50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold mb-2">Завершить проект</h3>
              <p className="text-sm text-muted-foreground">
                После завершения проекта автоматически рассчитаются и начислятся бонусы всем членам команды.
              </p>
            </div>
            <Button
              onClick={() => setShowCompleteDialog(true)}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Завершить проект
            </Button>
          </div>
        </Card>
      )}

      {/* Статус завершенного проекта */}
      {isPendingPaymentApproval && (
        <Card className="p-6 border-blue-200 bg-blue-50">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-blue-600" />
            <div>
              <h3 className="font-semibold text-blue-900">Ожидает утверждения CEO</h3>
              <p className="text-sm text-blue-700">
                Проект уже передан на финальную проверку. CEO может скорректировать бонусы и закрыть его в разделе "Бонусы".
              </p>
            </div>
          </div>
        </Card>
      )}

      {isCompleted && (
        <Card className="p-6 border-green-200 bg-green-50">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
            <div>
              <h3 className="font-semibold text-green-900">Проект завершен</h3>
              <p className="text-sm text-green-700">
                Бонусы автоматически рассчитаны и начислены команде. Проверьте раздел "Бонусы".
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Диалог подтверждения завершения */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Завершить проект?</DialogTitle>
            <DialogDescription>
              После завершения проекта:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Статус проекта изменится на "Завершен"</li>
                <li>Автоматически рассчитаются бонусы для всех членов команды</li>
                <li>Уведомления будут отправлены всем участникам</li>
                <li>Бонусы будут отображаться в разделе "Бонусы"</li>
              </ul>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>
              Отмена
            </Button>
            <Button
              onClick={async () => {
                if (!project || !user) return;

                try {
                  // Обновляем статус проекта
                  const updatedProject = {
                    ...project,
                    status: 'completed',
                    notes: {
                      ...project.notes,
                      status: 'completed',
                      completedAt: new Date().toISOString()
                    }
                  };

                  // Сохраняем в Supabase
                  await supabaseDataStore.updateProject(project.id, updatedProject);

                  // Рассчитываем финансы и бонусы
                  const finances = calculateProjectFinances(updatedProject);

                  // Обновляем финансы проекта
                  const projectWithFinances = {
                    ...updatedProject,
                    finances: {
                      ...updatedProject.finances,
                      ...finances
                    }
                  };

                  await supabaseDataStore.updateProject(project.id, projectWithFinances);

                  // Получаем команду проекта
                  const team = updatedProject.team || [];
                  const teamIds = team.map((m: any) => m.userId);
                  const partner = team.find((m: any) => m.role === 'partner');
                  const pm = team.find((m: any) => m.role === 'manager_1' || m.role === 'manager_2' || m.role === 'manager_3');

                  // Отправляем уведомления о завершении проекта
                  notifyProjectClosed({
                    projectName: updatedProject.name || updatedProject.title || 'Проект',
                    partnerId: partner?.userId || user.id,
                    pmId: pm?.userId || user.id,
                    teamIds: teamIds,
                    totalAmount: finances.totalBonusAmount.toLocaleString('ru-RU'),
                    currency: '₸',
                    projectId: project.id
                  });

                  // Отправляем уведомления о бонусах
                  if (Object.keys(finances.teamBonuses).length > 0) {
                    notifyBonusesApproved({
                      projectName: updatedProject.name || updatedProject.title || 'Проект',
                      teamIds: teamIds,
                      ceoName: 'Система',
                      projectId: project.id
                    });
                  }

                  toast({
                    title: 'Проект завершен!',
                    description: 'Бонусы автоматически рассчитаны и начислены команде.',
                  });

                  setShowCompleteDialog(false);

                  // Обновляем проект в локальном состоянии
                  setProject(projectWithFinances);

                  // Перезагружаем страницу через 2 секунды
                  setTimeout(() => {
                    window.location.reload();
                  }, 2000);
                } catch (error: any) {
                  console.error('Ошибка при завершении проекта:', error);
                  toast({
                    title: 'Ошибка',
                    description: error.message || 'Не удалось завершить проект',
                    variant: 'destructive'
                  });
                }
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              Да, завершить проект
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог назначения команды — слоты по ролям */}
      <Dialog open={showTeamDialog} onOpenChange={(open) => {
        setShowTeamDialog(open);
        if (!open) {
          setOpenSlotDropdown(null);
          setAddingNewInSlot(null);
          setNewEmployeeName('');
          setSlotSearch('');
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Назначение команды проекта
            </DialogTitle>
            <DialogDescription>
              Выберите сотрудника для каждой роли или добавьте нового прямо здесь
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4 flex-1 overflow-y-auto">
            <TeamAssignment
              employees={employees || []}
              teamSlots={teamSlots}
              slots={TEAM_ROLE_SLOTS as any}
              onChange={setTeamSlots}
              onAddNewEmployee={(slotKey) => {
                setAddingNewInSlot(slotKey);
                setNewEmployeeName('');
                setNewEmployeeType(slotKey.startsWith('gph') ? 'gph' : 'staff');
              }}
            />

            {addingNewInSlot && (
              <div className="mt-4 p-4 border rounded-xl bg-muted/30 space-y-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase">
                  Новый сотрудник для роли «{TEAM_ROLE_SLOTS.find(s => s.key === addingNewInSlot)?.label}»
                </div>
                <Input
                  placeholder="ФИО сотрудника"
                  value={newEmployeeName}
                  onChange={(e) => setNewEmployeeName(e.target.value)}
                  className="h-10 text-sm"
                  autoFocus
                />
                {addingNewInSlot.startsWith('gph') && (
                  <div className="flex gap-2">
                    <Button
                      variant={newEmployeeType === 'gph' ? 'default' : 'outline'}
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => setNewEmployeeType('gph')}
                    >
                      ГПХ
                    </Button>
                    <Button
                      variant={newEmployeeType === 'subcontract' ? 'default' : 'outline'}
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => setNewEmployeeType('subcontract')}
                    >
                      Субподряд
                    </Button>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs h-9"
                    onClick={() => setAddingNewInSlot(null)}
                  >
                    Отмена
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 text-xs h-9"
                    disabled={!newEmployeeName.trim()}
                    onClick={async () => {
                      try {
                        const slot = TEAM_ROLE_SLOTS.find(s => s.key === addingNewInSlot)!;
                        const empRole = addingNewInSlot.startsWith('gph')
                          ? (newEmployeeType === 'gph' ? 'employee' : 'employee')
                          : (slot.roles[0] || 'employee');

                        const { data: newEmp, error } = await supabase
                          .from('employees')
                          .insert({
                            name: newEmployeeName.trim(),
                            role: empRole as any,
                            level: '1' as any,
                            email: `placeholder_${Date.now()}@temp.local`,
                          })
                          .select('id')
                          .single();

                        if (error) throw error;

                        setTeamSlots(prev => ({ ...prev, [addingNewInSlot]: newEmp.id }));
                        setAddingNewInSlot(null);
                        setNewEmployeeName('');

                        toast({
                          title: 'Сотрудник создан',
                          description: `${newEmployeeName.trim()} добавлен и назначен на роль`,
                        });
                      } catch (err: any) {
                        toast({
                          title: 'Ошибка',
                          description: err.message || 'Не удалось создать сотрудника',
                          variant: 'destructive',
                        });
                      }
                    }}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Создать и назначить
                  </Button>
                </div>
              </div>
            )}
          </div>


          <div className="flex justify-between items-center pt-2 border-t">
            <div className="text-xs text-muted-foreground">
              Назначено: {Object.values(teamSlots).filter(Boolean).length} из {TEAM_ROLE_SLOTS.length}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowTeamDialog(false)}>
                Отмена
              </Button>
              <Button
                onClick={async () => {
                  try {
                    // Формируем команду из слотов
                    const fullTeam = TEAM_ROLE_SLOTS
                      .filter(slot => teamSlots[slot.key])
                      .map(slot => {
                        const empId = teamSlots[slot.key]!;
                        const emp = (employees || []).find((e: any) => e.id === empId);
                        const isGph = slot.key.startsWith('gph');
                        return {
                          userId: empId,
                          name: emp?.name || '',
                          role: emp?.role || slot.label,
                          slotKey: slot.key,
                          type: isGph ? (newEmployeeType || 'gph') : 'staff',
                        };
                      });

                    const projectId = project?.id || project?.notes?.id || id;
                    const updatedNotes = {
                      ...(project?.notes || {}),
                      team: fullTeam,
                      status: fullTeam.length > 0 ? 'team_assembled' : (project?.notes?.status || 'approved')
                    };

                    await supabaseDataStore.updateProject(projectId, {
                      team: fullTeam,
                      notes: updatedNotes
                    });

                    setProject((prev: any) => ({
                      ...prev,
                      team: fullTeam,
                      notes: updatedNotes
                    }));

                    setShowTeamDialog(false);

                    toast({
                      title: 'Команда назначена',
                      description: `${fullTeam.length} участников добавлены в проект`
                    });
                  } catch (error: any) {
                    console.error('Ошибка назначения команды:', error);
                    toast({
                      title: 'Ошибка',
                      description: error.message || 'Не удалось назначить команду',
                      variant: 'destructive'
                    });
                  }
                }}
                disabled={Object.values(teamSlots).filter(Boolean).length === 0}
              >
                <Users className="w-4 h-4 mr-2" />
                Назначить команду ({Object.values(teamSlots).filter(Boolean).length})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог редактирования для закупщика */}
      {project && (
        <ProjectEditProcurement
          project={project}
          isOpen={isEditDialogOpen}
          onClose={() => setIsEditDialogOpen(false)}
          onSave={(updatedProject) => {
            setProject(updatedProject);
            setIsEditDialogOpen(false);
          }}
        />
      )}
    </div>
  );
}


