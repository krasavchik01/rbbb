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
  Edit
} from "lucide-react";
import { useTemplates, useProjects } from "@/hooks/useDataStore";
import { ProjectTemplate, ProcedureElement, ELEMENT_TYPE_ICONS } from "@/types/methodology";
import { ProjectData, ElementData } from "@/types/methodology";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useProjectDataSync } from "@/hooks/useProjectDataSync";
import { MethodologySelector, SelectedProcedure } from "@/components/projects/MethodologySelector";
import { RUSSELL_BEDFORD_AUDIT_METHODOLOGY } from "@/lib/auditMethodology";
import { useEmployees } from "@/hooks/useSupabaseData";
import { supabaseDataStore } from "@/lib/supabaseDataStore";
import { notifyTaskAssigned, notifyProjectClosed, notifyBonusesApproved } from "@/lib/projectNotifications";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { calculateProjectFinances } from "@/types/project-v3";
import { TaskManager } from "@/components/tasks/TaskManager";
import { TaskDistribution } from "@/components/tasks/TaskDistribution";
import { ProjectFileManager } from "@/components/projects/ProjectFileManager";
import { TemplateManager } from "@/components/projects/TemplateManager";
import { WorkPaperTree } from "@/components/projects/WorkPaperTree";
import { WorkPaperViewer } from "@/components/projects/WorkPaperViewer";
import { ContractEditor } from "@/components/projects/ContractEditor";
import { ProjectEditProcurement } from "@/components/projects/ProjectEditProcurement";
import { Task, ChecklistItem } from "@/types/project";
import { WorkPaper, WorkPaperTemplate } from "@/types/workPapers";
import { ContractInfo, ProjectAmendment } from "@/types/project-v3";
import { useMemo } from "react";

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
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [isPlanningMode, setIsPlanningMode] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showTeamDialog, setShowTeamDialog] = useState(false);
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<string[]>([]);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Рабочие документы
  const [workPapers, setWorkPapers] = useState<WorkPaper[]>([]);
  const [selectedWorkPaper, setSelectedWorkPaper] = useState<WorkPaper | null>(null);
  const [workPaperSearchQuery, setWorkPaperSearchQuery] = useState('');

  // Дополнительные соглашения
  const [amendments, setAmendments] = useState<ProjectAmendment[]>([]);
  
  // Проверка роли партнёра
  const isPartner = user?.role === 'partner';
  const isPM = user?.role === 'manager_1' || user?.role === 'manager_2' || user?.role === 'manager_3';
  const isDirector = user?.role === 'ceo' || user?.role === 'deputy_director';
  const isProcurement = user?.role === 'procurement';
  const projectStatus = project?.status || project?.notes?.status;
  const isCompleted = projectStatus === 'completed';
  const isInProgress = projectStatus === 'in_progress';
  const canCompleteProject = (isPartner || isPM) && isInProgress;
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

  // Открыть диалог назначения команды если пришли с флагом
  useEffect(() => {
    if (openTeamAssignment && project) {
      setShowTeamDialog(true);
      // Инициализируем уже назначенных членов команды
      const existingTeam = project.team || project.notes?.team || [];
      setSelectedTeamMembers(existingTeam.map((m: any) => m.userId || m.id));
    }
  }, [openTeamAssignment, project]);

  // Функция загрузки рабочих документов - вынесена для использования в onUpdate
  const loadWorkPapers = useCallback(async () => {
    if (!id) return;
    try {
      const papers = await supabaseDataStore.getWorkPapers(id);
      setWorkPapers(papers);

      // Если есть выбранный документ, обновляем его
      if (selectedWorkPaper) {
        const updated = papers.find(wp => wp.id === selectedWorkPaper.id);
        if (updated) {
          setSelectedWorkPaper(updated);
        }
      }
    } catch (error) {
      // Ошибка уже обработана в getWorkPapers, просто устанавливаем пустой массив
      setWorkPapers([]);
    }
  }, [id, selectedWorkPaper]);

  // Загрузка рабочих документов проекта при монтировании
  useEffect(() => {
    loadWorkPapers();
  }, [id]); // Загружаем только при смене id

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
  const handleSaveMethodologySelection = async (procedures: SelectedProcedure[]) => {
    if (!project || !template) return;

    try {
      // Создаём структуру методологии
      const methodology = {
        templateId: RUSSELL_BEDFORD_AUDIT_METHODOLOGY.id,
        selectedProcedures: procedures,
        stages: RUSSELL_BEDFORD_AUDIT_METHODOLOGY.stages
          .filter(stage => procedures.some(p => p.stageId === stage.id))
          .map(stage => ({
            stageId: stage.id,
            stageName: stage.name,
            status: 'pending' as const,
            elements: stage.elements
              .filter(el => procedures.some(p => p.elementId === el.id && p.stageId === stage.id))
              .map(el => {
                const procedure = procedures.find(p => p.elementId === el.id && p.stageId === stage.id);
                return {
                  elementId: el.id,
                  elementType: el.type,
                  title: el.title,
                  completed: false,
                  completedAt: null,
                  completedBy: null,
                  responsibleRole: procedure?.responsibleRole,
                  responsibleUserId: procedure?.responsibleUserId
                };
              })
          }))
      };

      // Обновляем или создаём projectData
      const updatedProjectData: ProjectData = projectData || {
        projectId: project.id || id || '',
        templateId: RUSSELL_BEDFORD_AUDIT_METHODOLOGY.id,
        templateVersion: 1,
        passportData: {},
        stagesData: {},
        completionStatus: {
          totalElements: 0,
          completedElements: 0,
          percentage: 0
        },
        history: []
      };

      updatedProjectData.methodology = methodology;

      // Инициализируем stagesData для выбранных процедур
      methodology.stages.forEach(stage => {
        if (!updatedProjectData.stagesData[stage.stageId]) {
          updatedProjectData.stagesData[stage.stageId] = {};
        }
        stage.elements.forEach(element => {
          if (!updatedProjectData.stagesData[stage.stageId][element.elementId]) {
            updatedProjectData.stagesData[stage.stageId][element.elementId] = {
              elementId: element.elementId,
              completed: false
            };
          }
        });
      });

      // Пересчитываем прогресс
      const totalElements = methodology.stages.reduce((sum, stage) => sum + stage.elements.length, 0);
      updatedProjectData.completionStatus = {
        totalElements,
        completedElements: 0,
        percentage: 0
      };

      setProjectData(updatedProjectData);
      saveProjectDataLocal(updatedProjectData);

      // Обновляем проект в Supabase
      const projectId = project.id || (project as any).notes?.id;
      if (projectId) {
        await supabaseDataStore.updateProject(projectId, {
          ...project,
          notes: {
            ...project.notes,
            methodology: methodology
          }
        });
      }

      // Отправляем уведомления назначенным ответственным
      procedures.forEach(procedure => {
        if (procedure.responsibleUserId) {
          const employee = employees.find((e: any) => e.id === procedure.responsibleUserId);
          if (employee) {
            const element = RUSSELL_BEDFORD_AUDIT_METHODOLOGY.stages
              .flatMap(s => s.elements)
              .find(e => e.id === procedure.elementId);
            
            notifyTaskAssigned({
              taskName: element?.title || 'Процедура',
              assigneeId: procedure.responsibleUserId,
              projectName: project.name || project.client?.name || 'Проект',
              deadline: project.contract?.serviceEndDate || project.deadline || 'Не указан',
              creatorName: user?.name || 'Партнёр',
              projectId: project.id || id || ''
            });
          }
        }
      });

      toast({
        title: "✅ Планирование сохранено",
        description: `Выбрано ${procedures.length} процедур. Уведомления отправлены назначенным ответственным.`,
      });

      setIsPlanningMode(false);
    } catch (error) {
      console.error('Ошибка сохранения планирования:', error);
      toast({
        title: "❌ Ошибка",
        description: "Не удалось сохранить планирование",
        variant: "destructive",
      });
    }
  };

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
    <div className="space-y-6 animate-fade-in p-4 md:p-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/projects')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{project.name || project.client?.name || 'Проект'}</h1>
            <p className="text-sm text-muted-foreground">
              {activeTemplate?.name || project.contract?.subject || 'Проект'}
              {projectTasks.length > 0 && ` • ${projectTasks.length} задач`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Кнопка редактирования для закупщика */}
          {isProcurement && project && (
            <Button variant="outline" onClick={() => setIsEditDialogOpen(true)}>
              <Edit className="w-4 h-4 mr-2" />
              Редактировать
            </Button>
          )}
          {/* Индикатор синхронизации */}
          {syncStatus.isSyncing && (
            <Badge variant="outline" className="animate-pulse">
              🔄 Синхронизация...
            </Badge>
          )}
          {!syncStatus.isSyncing && syncStatus.isOnline && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              ✅ Синхронизировано
            </Badge>
          )}
          {!syncStatus.isSyncing && !syncStatus.isOnline && (
            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
              💾 Только локально
            </Badge>
          )}
          {projectData && projectData.completionStatus && (
            <Badge className="bg-gradient-to-r from-blue-500 to-blue-700 text-lg px-4 py-2">
              {projectData.completionStatus.percentage || 0}% выполнено
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
                {projectTasks.filter((t: any) => t.status === 'done').length} из {projectTasks.length} выполнено
              </span>
            </div>
            <Progress 
              value={projectTasks.length > 0 ? 
                (projectTasks.filter((t: any) => t.status === 'done').length / projectTasks.length) * 100 : 0} 
              className="h-3" 
            />
          </div>
        </Card>
      )}

      {/* Информационная панель для директора/зама - только общая информация */}
      {isDirector && project && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Команда проекта */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Команда</h3>
            </div>
            <div className="space-y-2">
              <p className="text-2xl font-bold">{(project.team || project.notes?.team || []).length}</p>
              <p className="text-xs text-muted-foreground">участников</p>
            </div>
          </Card>

          {/* Статус */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Статус</h3>
            </div>
            <Badge variant="outline" className="text-sm">
              {project.status === 'approved' ? 'Утвержден' :
               project.status === 'in_progress' ? 'В работе' :
               project.status === 'completed' ? 'Завершен' :
               project.notes?.status === 'approved' ? 'Утвержден' :
               project.notes?.status === 'in_progress' ? 'В работе' :
               project.notes?.status === 'completed' ? 'Завершен' :
               'Неизвестно'}
            </Badge>
          </Card>

          {/* Прогресс */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Прогресс</h3>
            </div>
            <div className="space-y-2">
              <p className="text-2xl font-bold">{project.completionPercent || project.completion || 0}%</p>
              <Progress value={project.completionPercent || project.completion || 0} className="h-2" />
            </div>
          </Card>

          {/* Дедлайн */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Дедлайн</h3>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {project.contract?.serviceEndDate || project.deadline || project.contract?.date 
                  ? new Date(project.contract?.serviceEndDate || project.deadline || project.contract?.date).toLocaleDateString('ru-RU')
                  : 'Не указан'}
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* Информационная панель для партнера */}
      {isPartner && project && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Команда проекта */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Команда проекта</h3>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowTeamDialog(true)}>
                <Edit className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {(project.team || project.notes?.team || []).map((member: any, index: number) => {
                const employee = employees.find((e: any) => e.id === (member.userId || member.id || member.employeeId));
                const roleLabel = member.role === 'partner' ? 'Партнер' :
                                 member.role === 'manager_1' ? 'Менеджер 1' :
                                 member.role === 'manager_2' ? 'Менеджер 2' :
                                 member.role === 'manager_3' ? 'Менеджер 3' :
                                 member.role || 'Участник';
                return (
                  <div key={index} className="flex items-center justify-between p-2 bg-secondary/50 rounded">
                    <span className="text-sm font-medium">{employee?.name || member.userName || 'Неизвестный'}</span>
                    <Badge variant="outline" className="text-xs">{roleLabel}</Badge>
                  </div>
                );
              })}
              {(!project.team || project.team.length === 0) && (
                <p className="text-sm text-muted-foreground">Команда не назначена</p>
              )}
            </div>
          </Card>

          {/* Сроки и статус */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Сроки и статус</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Дедлайн:</span>
                <p className="font-medium">
                  {project.contract?.serviceEndDate || project.deadline || project.contract?.date 
                    ? new Date(project.contract?.serviceEndDate || project.deadline || project.contract?.date).toLocaleDateString('ru-RU')
                    : 'Не указан'}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Статус:</span>
                <p className="font-medium">
                  {project.status === 'approved' ? 'Утвержден' :
                   project.status === 'in_progress' ? 'В работе' :
                   project.status === 'completed' ? 'Завершен' :
                   project.notes?.status === 'approved' ? 'Утвержден' :
                   project.notes?.status === 'in_progress' ? 'В работе' :
                   project.notes?.status === 'completed' ? 'Завершен' :
                   'Неизвестно'}
                </p>
              </div>
              {project.approvedAt && (
                <div>
                  <span className="text-muted-foreground">Утвержден:</span>
                  <p className="font-medium text-xs">
                    {new Date(project.approvedAt).toLocaleDateString('ru-RU')}
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Финансовая информация (если разрешено) */}
          {(project.financialVisibility?.enabled && project.financialVisibility?.visibleTo?.includes(user?.id || '')) || 
           !project.financialVisibility || 
           (project.finances && isPartner) ? (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Финансы</h3>
              </div>
              <div className="space-y-2 text-sm">
                {project.finances?.amountWithoutVAT && (
                  <div>
                    <span className="text-muted-foreground">Сумма без НДС:</span>
                    <p className="font-medium">
                      {Number(project.finances.amountWithoutVAT).toLocaleString('ru-RU')} ₸
                    </p>
                  </div>
                )}
                {project.finances?.bonusBase && (
                  <div>
                    <span className="text-muted-foreground">База бонусов:</span>
                    <p className="font-medium">
                      {Number(project.finances.bonusBase).toLocaleString('ru-RU')} ₸
                    </p>
                  </div>
                )}
                {project.finances?.totalBonusAmount && (
                  <div>
                    <span className="text-muted-foreground">Общая сумма бонусов:</span>
                    <p className="font-medium text-green-600">
                      {Number(project.finances.totalBonusAmount).toLocaleString('ru-RU')} ₸
                    </p>
                  </div>
                )}
                {project.finances?.grossProfit && (
                  <div>
                    <span className="text-muted-foreground">Валовая прибыль:</span>
                    <p className="font-medium text-blue-600">
                      {Number(project.finances.grossProfit).toLocaleString('ru-RU')} ₸
                    </p>
                  </div>
                )}
                {(!project.finances || Object.keys(project.finances).length === 0) && (
                  <p className="text-muted-foreground">Финансовая информация не доступна</p>
                )}
              </div>
            </Card>
          ) : (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="w-5 h-5 text-muted-foreground" />
                <h3 className="font-semibold text-muted-foreground">Финансы</h3>
              </div>
              <p className="text-sm text-muted-foreground">Финансовая информация скрыта</p>
            </Card>
          )}
        </div>
      )}

      {/* Вкладки: Планирование (для партнера), Задачи, Распределение задач, Рабочие процедуры, Шаблоны, Файлы, Договор */}
      <Tabs defaultValue={isPartner && projectData?.methodology ? "planning" : isProcurement ? "contract" : "tasks"} className="w-full">
        <TabsList className="flex flex-wrap gap-1">
          {isPartner && (
            <TabsTrigger value="planning">
              📋 Планирование
            </TabsTrigger>
          )}
          {!isProcurement && (
            <TabsTrigger value="tasks">
              ✅ Задачи
            </TabsTrigger>
          )}
          {isPM && (
            <TabsTrigger value="task-distribution">
              👥 Распределение задач
            </TabsTrigger>
          )}
          {activeTemplate && showFullDetails && !isProcurement && (
            <TabsTrigger value="procedures">
              🔧 Рабочие процедуры
            </TabsTrigger>
          )}
          {showFullDetails && !isProcurement && (
            <TabsTrigger value="templates">
              📄 Шаблоны
            </TabsTrigger>
          )}
          <TabsTrigger value="files">
            📁 Файлы
          </TabsTrigger>
          <TabsTrigger value="contract">
            📜 Договор
          </TabsTrigger>
        </TabsList>

        {/* Вкладка планирования для партнёра */}
        {isPartner && (
          <TabsContent value="planning" className="space-y-4 mt-4">
            <Card className="p-6">
              {projectData?.methodology ? (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">Выбранные процедуры</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Планирование выполнено. Выбрано {projectData.methodology.selectedProcedures.length} процедур
                      </p>
                    </div>
                    <Button variant="outline" onClick={() => setIsPlanningMode(true)}>
                      Изменить планирование
                    </Button>
                  </div>
                  
                  {/* Отображение выбранных процедур по этапам */}
                  <div className="space-y-4">
                    {projectData.methodology.stages.map((stage: any) => {
                      const stageTemplate = RUSSELL_BEDFORD_AUDIT_METHODOLOGY.stages.find(s => s.id === stage.stageId);
                      return (
                        <Card key={stage.stageId} className="p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Badge 
                              style={{ backgroundColor: stageTemplate?.color || '#3b82f6' }}
                              className="text-white"
                            >
                              Этап {stageTemplate?.order || 0}
                            </Badge>
                            <h4 className="font-semibold">{stage.stageName}</h4>
                          </div>
                          <div className="space-y-2 pl-6">
                            {stage.elements.map((element: any) => {
                              const responsible = employees.find((e: any) => e.id === element.responsibleUserId);
                              const roleLabel = element.responsibleRole === 'assistant' ? 'Ассистент' :
                                               element.responsibleRole === 'senior_auditor' ? 'Старший аудитор' :
                                               element.responsibleRole === 'manager' ? 'Менеджер' :
                                               element.responsibleRole === 'partner' ? 'Партнёр' : element.responsibleRole;
                              return (
                                <div key={element.elementId} className="flex items-center justify-between p-2 bg-secondary/50 rounded">
                                  <span className="text-sm">{element.title}</span>
                                  <Badge variant="outline">
                                    {responsible?.name || roleLabel}
                                  </Badge>
                                </div>
                              );
                            })}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    Планирование ещё не выполнено. Выберите необходимые процедуры и распределите их по ответственным.
                  </p>
                  <Button onClick={() => setIsPlanningMode(true)}>
                    Начать планирование
                  </Button>
                </div>
              )}
            </Card>

            {/* Диалог выбора методологии */}
            {isPlanningMode && (
              <Dialog open={isPlanningMode} onOpenChange={setIsPlanningMode}>
                <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Выбор процедур и распределение ответственности</DialogTitle>
                    <DialogDescription>
                      Выберите необходимые процедуры для проекта и назначьте ответственных (Ассистент, Старший аудитор, Менеджер, Партнёр)
                    </DialogDescription>
                  </DialogHeader>
                  
                  <MethodologySelector
                    template={RUSSELL_BEDFORD_AUDIT_METHODOLOGY}
                    projectId={project?.id || id || ''}
                    employees={employees}
                    onSave={handleSaveMethodologySelection}
                    onCancel={() => setIsPlanningMode(false)}
                    initialSelection={projectData?.methodology?.selectedProcedures || []}
                  />
                </DialogContent>
              </Dialog>
            )}
          </TabsContent>
        )}

        {/* Вкладка задач (не для ОЗ) */}
        {!isProcurement && <TabsContent value="tasks" className="space-y-4 mt-4">
          <Card className="p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">Задачи проекта</h3>
              <p className="text-sm text-muted-foreground">
                Все задачи проекта, сгруппированные по ответственным сотрудникам
              </p>
            </div>
            
            {projectTasks.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">Задач пока нет</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Задачи по сотрудникам */}
                {Object.entries(tasksByEmployee).map(([employeeId, tasks]) => {
                  const employee = employeeId === 'unassigned' ? null : employees.find((e: any) => e.id === employeeId);
                  const employeeName = employee ? employee.name : 'Не назначены';
                  
                  return (
                    <Card key={employeeId} className="p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <Users className="w-5 h-5 text-primary" />
                        <h4 className="font-semibold">{employeeName}</h4>
                        <Badge variant="outline">{tasks.length} задач</Badge>
                      </div>
                      
                      <div className="space-y-3">
                        {tasks.map((task: any) => {
                          const completedChecklist = (task.checklist || []).filter((item: ChecklistItem) => item.done).length;
                          const totalChecklist = (task.checklist || []).length;
                          const checklistProgress = totalChecklist > 0 ? (completedChecklist / totalChecklist) * 100 : 0;
                          
                          return (
                            <Card key={task.id} className="p-4 border-l-4 border-l-primary">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h5 className="font-medium">{task.title}</h5>
                                    <Badge variant={
                                      task.priority === 'high' ? 'destructive' :
                                      task.priority === 'med' ? 'default' : 'secondary'
                                    }>
                                      {task.priority === 'high' ? 'Высокий' :
                                       task.priority === 'med' ? 'Средний' : 'Низкий'}
                                    </Badge>
                                    <Badge variant={
                                      task.status === 'done' ? 'default' :
                                      task.status === 'in_progress' ? 'secondary' : 'outline'
                                    }>
                                      {task.status === 'done' ? 'Выполнено' :
                                       task.status === 'in_progress' ? 'В работе' : 'К выполнению'}
                                    </Badge>
                                  </div>
                                  
                                  {task.description && (
                                    <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
                                  )}
                                  
                                  {/* Чек-лист */}
                                  {task.checklist && task.checklist.length > 0 && (
                                    <div className="mt-3 space-y-2">
                                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span>Чек-лист: {completedChecklist}/{totalChecklist}</span>
                                        <span>{Math.round(checklistProgress)}%</span>
                                      </div>
                                      <Progress value={checklistProgress} className="h-1" />
                                      <div className="space-y-1">
                                        {task.checklist.map((item: ChecklistItem, idx: number) => (
                                          <div key={idx} className="flex items-center gap-2 text-sm">
                                            {item.done ? (
                                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                                            ) : (
                                              <Circle className="w-4 h-4 text-muted-foreground" />
                                            )}
                                            <span className={item.done ? 'line-through text-muted-foreground' : ''}>
                                              {item.item}
                                            </span>
                                            {item.required && (
                                              <Badge variant="outline" className="text-xs">Обязательно</Badge>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Время */}
                                  {(task.estimate_h || task.spent_h) && (
                                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                      {task.estimate_h && (
                                        <span>Оценка: {task.estimate_h}ч</span>
                                      )}
                                      {task.spent_h > 0 && (
                                        <span>Потрачено: {task.spent_h}ч</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>}

        {/* Вкладка рабочих процедур (только если есть шаблон, не директор и не закупки) */}
        {activeTemplate && showFullDetails && !isProcurement && (
          <TabsContent value="procedures" className="space-y-4 mt-4">
          {/* Навигация по этапам */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {displayStages.map((stage, index) => {
              const stageData = projectData?.stagesData[stage.id] || {};
              const completedCount = Object.values(stageData).filter(e => e.completed).length;
              const totalCount = stage.elements.length;
              const isCompleted = completedCount === totalCount && totalCount > 0;
              const isCurrent = index === currentStageIndex;

              return (
                <Button
                  key={stage.id}
                  variant={isCurrent ? "default" : "outline"}
                  className={`flex-shrink-0 ${isCompleted ? 'bg-green-500 hover:bg-green-600' : ''}`}
                  onClick={() => setCurrentStageIndex(index)}
                >
                  <span className="mr-2">{index + 1}.</span>
                  {stage.name}
                  <Badge variant="secondary" className="ml-2">
                    {completedCount}/{totalCount}
                  </Badge>
                  {isCompleted && <CheckCircle2 className="w-4 h-4 ml-2" />}
                </Button>
              );
            })}
          </div>
        </TabsContent>
        )}

        {/* Вкладка распределения задач (только для менеджеров) */}
        {isPM && (
          <TabsContent value="task-distribution" className="space-y-4 mt-4">
            <TaskDistribution
              projectId={project?.id || id || ''}
              teamMembers={project?.team || project?.notes?.team || []}
              workPapers={workPapers}
              onUpdate={() => {
                // Обновляем список work papers
                loadWorkPapers();
              }}
            />
          </TabsContent>
        )}

        {/* Вкладка шаблонов (только если не директор и не закупки) */}
        {showFullDetails && !isProcurement && (
          <TabsContent value="templates" className="space-y-4 mt-4">
            <TemplateManager
              projectId={project?.id || id || ''}
              stageId={currentStage?.id}
              elementId={undefined}
              onTemplateSelect={(template) => {
                toast({
                  title: "Шаблон выбран",
                  description: `Шаблон "${template.name}" готов к использованию`,
                });
              }}
            />
          </TabsContent>
        )}

        {/* Вкладка рабочих документов */}
        {workPapers.length > 0 && (
          <TabsContent value="workpapers" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Дерево документов */}
              <div className="lg:col-span-1">
                <WorkPaperTree
                  workPapers={workPapers}
                  selectedWorkPaperId={selectedWorkPaper?.id}
                  onSelectWorkPaper={(wp) => {
                    setSelectedWorkPaper(wp);
                  }}
                  searchQuery={workPaperSearchQuery}
                  onSearchChange={setWorkPaperSearchQuery}
                />
              </div>
              
              {/* Просмотр документа */}
              <div className="lg:col-span-2">
                {selectedWorkPaper ? (
                  <WorkPaperViewer
                    workPaper={selectedWorkPaper}
                    template={selectedWorkPaper.template as WorkPaperTemplate}
                    onStatusChange={(status) => {
                      // Обновляем статус в списке
                      setWorkPapers(prev => 
                        prev.map(wp => 
                          wp.id === selectedWorkPaper.id 
                            ? { ...wp, status }
                            : wp
                        )
                      );
                      setSelectedWorkPaper(prev => prev ? { ...prev, status } : null);
                    }}
                    onSave={(data) => {
                      // Обновляем данные в списке
                      setWorkPapers(prev => 
                        prev.map(wp => 
                          wp.id === selectedWorkPaper.id 
                            ? { ...wp, data }
                            : wp
                        )
                      );
                      setSelectedWorkPaper(prev => prev ? { ...prev, data } : null);
                    }}
                    readOnly={false}
                    showReviewActions={true}
                  />
                ) : (
                  <Card className="p-8 text-center">
                    <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">
                      Выберите документ из списка для просмотра и редактирования
                    </p>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>
        )}

        {/* Вкладка файлов */}
        <TabsContent value="files" className="space-y-4 mt-4">
          <ProjectFileManager
            projectId={project?.id || id || ''}
            uploadedBy={user?.id || ''}
            initialFiles={project?.notes?.files || []}
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
            canEdit={user?.role === 'procurement' || user?.role === 'admin' || user?.role === 'partner' || user?.role === 'deputy_director' || user?.role === 'ceo'}
          />
        </TabsContent>
      </Tabs>

      {/* Текущий этап - только если не вкладка планирования и не директор */}
      {!isPartner && !isDirector && currentStage && showFullDetails && (
        <Card className="p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-2xl font-bold" style={{ color: currentStage.color }}>
                Этап {currentStageIndex + 1}: {currentStage.name}
              </h2>
              <Badge variant="outline" className="text-sm">
                {Math.round(stageProgress)}% завершено
              </Badge>
            </div>
            {currentStage.description && (
              <p className="text-muted-foreground">{currentStage.description}</p>
            )}
            <Progress value={stageProgress} className="h-2 mt-3" />
          </div>

          <div className="space-y-6">
            {currentStage.elements.map((element) => {
              // Показываем информацию о назначенном ответственном
              const elementData = projectData?.stagesData[currentStage.id]?.[element.id];
              const responsible = elementData?.responsibleUserId ? 
                employees.find((e: any) => e.id === elementData.responsibleUserId) : null;
              
              return (
                <div key={element.id}>
                  {responsible && (
                    <div className="mb-2 text-xs text-muted-foreground">
                      Ответственный: <strong>{responsible.name}</strong>
                    </div>
                  )}
                  {renderElementInput(currentStage.id, element)}
                </div>
              );
            })}
          </div>

          {/* Навигация между этапами */}
          <div className="flex gap-4 mt-6 pt-6 border-t">
            <Button
              variant="outline"
              onClick={() => setCurrentStageIndex(Math.max(0, currentStageIndex - 1))}
              disabled={currentStageIndex === 0}
              className="flex-1"
            >
              Предыдущий этап
            </Button>
            <Button
              onClick={() => setCurrentStageIndex(Math.min(displayStages.length - 1, currentStageIndex + 1))}
              disabled={currentStageIndex === displayStages.length - 1}
              className="flex-1"
            >
              Следующий этап
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </Card>
      )}

      {/* Текущий этап для партнёра в режиме просмотра процедур */}
      {isPartner && currentStage && (
        <Card className="p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-2xl font-bold" style={{ color: currentStage.color }}>
                Этап {currentStageIndex + 1}: {currentStage.name}
              </h2>
              <Badge variant="outline" className="text-sm">
                {Math.round(stageProgress)}% завершено
              </Badge>
            </div>
            {currentStage.description && (
              <p className="text-muted-foreground">{currentStage.description}</p>
            )}
            <Progress value={stageProgress} className="h-2 mt-3" />
          </div>

          <div className="space-y-6">
            {currentStage.elements.map((element) => {
              const elementData = projectData?.stagesData[currentStage.id]?.[element.id];
              const methodologyElement = projectData?.methodology?.stages
                .find((s: any) => s.stageId === currentStage.id)
                ?.elements.find((e: any) => e.elementId === element.id);
              const responsible = methodologyElement?.responsibleUserId ? 
                employees.find((e: any) => e.id === methodologyElement.responsibleUserId) : null;
              
              return (
                <div key={element.id}>
                  {responsible && (
                    <div className="mb-2 text-xs text-muted-foreground">
                      Ответственный: <strong>{responsible.name}</strong>
                    </div>
                  )}
                  {renderElementInput(currentStage.id, element)}
                </div>
              );
            })}
          </div>

          {/* Навигация между этапами */}
          <div className="flex gap-4 mt-6 pt-6 border-t">
            <Button
              variant="outline"
              onClick={() => setCurrentStageIndex(Math.max(0, currentStageIndex - 1))}
              disabled={currentStageIndex === 0}
              className="flex-1"
            >
              Предыдущий этап
            </Button>
            <Button
              onClick={() => setCurrentStageIndex(Math.min(displayStages.length - 1, currentStageIndex + 1))}
              disabled={currentStageIndex === displayStages.length - 1}
              className="flex-1"
            >
              Следующий этап
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </Card>
      )}

      {/* Информация о паспорте */}
      {activeTemplate && projectData && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Информация о проекте</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeTemplate.customFields.map(field => (
              <div key={field.id}>
                <Label className="text-sm text-muted-foreground">{field.label}</Label>
                <p className="font-medium">{projectData.passportData[field.name] || '-'}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Кнопка завершения проекта */}
      {canCompleteProject && !isCompleted && (
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

      {/* Диалог назначения команды */}
      <Dialog open={showTeamDialog} onOpenChange={setShowTeamDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Назначение команды проекта
            </DialogTitle>
            <DialogDescription>
              Перетаскивайте сотрудников в команду проекта "{project?.name || project?.client}"
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-4 flex-1 overflow-hidden">
            {/* Левая колонка - Доступные сотрудники */}
            <div className="space-y-3 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Доступные сотрудники
                </h3>
                <Badge variant="secondary" className="text-xs">
                  {employees?.filter(emp => emp.status === 'active' && !selectedTeamMembers.includes(emp.id)).length || 0}
                </Badge>
              </div>

              <div className="grid grid-cols-1 gap-2 overflow-y-auto pr-2 flex-1">
                {employees?.filter(emp => emp.status === 'active' && !selectedTeamMembers.includes(emp.id)).map((employee) => {
                  const roleLabels: Record<string, string> = {
                    partner: 'Партнер',
                    manager_1: 'Менеджер 1',
                    manager_2: 'Менеджер 2',
                    manager_3: 'Менеджер 3',
                    supervisor_1: 'Супервайзер 1',
                    supervisor_2: 'Супервайзер 2',
                    supervisor_3: 'Супервайзер 3',
                    assistant_1: 'Ассистент 1',
                    assistant_2: 'Ассистент 2',
                    assistant_3: 'Ассистент 3',
                  };

                  const getRoleColor = (role: string) => {
                    if (role === 'partner') return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
                    if (role.includes('manager')) return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
                    if (role.includes('supervisor')) return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
                    if (role.includes('assistant')) return 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300';
                    return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
                  };

                  const getInitials = (name: string) => {
                    const parts = name.split(' ');
                    return parts.slice(0, 2).map(p => p[0]).join('').toUpperCase();
                  };

                  return (
                    <div
                      key={employee.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('employeeId', employee.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      className="group p-3 rounded-lg border border-border bg-card hover:border-primary/50 hover:shadow-md cursor-move transition-all"
                      onClick={() => {
                        setSelectedTeamMembers(prev => [...prev, employee.id]);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${getRoleColor(employee.role)}`}>
                          {getInitials(employee.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{employee.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {roleLabels[employee.role] || employee.role}
                          </div>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Правая колонка - Команда проекта */}
            <div className="space-y-3 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Команда проекта
                </h3>
                <Badge variant="default" className="text-xs">
                  {selectedTeamMembers.length}
                </Badge>
              </div>

              <div
                className="border-2 border-dashed border-primary/30 bg-primary/5 rounded-lg p-4 flex-1 overflow-y-auto"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add('border-primary', 'bg-primary/10');
                }}
                onDragLeave={(e) => {
                  e.currentTarget.classList.remove('border-primary', 'bg-primary/10');
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('border-primary', 'bg-primary/10');
                  const employeeId = e.dataTransfer.getData('employeeId');
                  if (employeeId && !selectedTeamMembers.includes(employeeId)) {
                    setSelectedTeamMembers(prev => [...prev, employeeId]);
                  }
                }}
              >
                {selectedTeamMembers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                    <Users className="w-12 h-12 mb-3 opacity-20" />
                    <p className="text-sm">Перетащите сотрудников сюда</p>
                    <p className="text-xs mt-1">или нажмите на них</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {selectedTeamMembers.map((empId) => {
                      const employee = employees?.find(e => e.id === empId);
                      if (!employee) return null;

                      const roleLabels: Record<string, string> = {
                        partner: 'Партнер',
                        manager_1: 'Менеджер 1',
                        manager_2: 'Менеджер 2',
                        manager_3: 'Менеджер 3',
                        supervisor_1: 'Супервайзер 1',
                        supervisor_2: 'Супервайзер 2',
                        supervisor_3: 'Супервайзер 3',
                        assistant_1: 'Ассистент 1',
                        assistant_2: 'Ассистент 2',
                        assistant_3: 'Ассистент 3',
                      };

                      const getRoleColor = (role: string) => {
                        if (role === 'partner') return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
                        if (role.includes('manager')) return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
                        if (role.includes('supervisor')) return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
                        if (role.includes('assistant')) return 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300';
                        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
                      };

                      const getInitials = (name: string) => {
                        const parts = name.split(' ');
                        return parts.slice(0, 2).map(p => p[0]).join('').toUpperCase();
                      };

                      return (
                        <div
                          key={employee.id}
                          className="group p-3 rounded-lg border border-primary/30 bg-card shadow-sm hover:shadow-md transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${getRoleColor(employee.role)}`}>
                              {getInitials(employee.name)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">{employee.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {roleLabels[employee.role] || employee.role}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100"
                              onClick={() => {
                                setSelectedTeamMembers(prev => prev.filter(id => id !== employee.id));
                              }}
                            >
                              <X className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowTeamDialog(false)}>
              Отмена
            </Button>
            <Button
              onClick={async () => {
                try {
                  // Формируем команду из выбранных сотрудников
                  const team = selectedTeamMembers.map(empId => {
                    const emp = employees?.find(e => e.id === empId);
                    return {
                      userId: empId,
                      name: emp?.name || '',
                      role: emp?.role || ''
                    };
                  });

                  // Обновляем проект
                  const projectId = project?.id || project?.notes?.id || id;
                  const updatedNotes = {
                    ...(project?.notes || {}),
                    team: team,
                    status: team.length > 0 ? 'team_assembled' : (project?.notes?.status || 'approved')
                  };

                  await supabaseDataStore.updateProject(projectId, {
                    team: team,
                    notes: updatedNotes
                  });

                  // Обновляем локальное состояние
                  setProject((prev: any) => ({
                    ...prev,
                    team: team,
                    notes: updatedNotes
                  }));

                  setShowTeamDialog(false);

                  toast({
                    title: '✅ Команда назначена',
                    description: `${team.length} сотрудников добавлены в проект`
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
              disabled={selectedTeamMembers.length === 0}
            >
              <Users className="w-4 h-4 mr-2" />
              Назначить команду
            </Button>
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


