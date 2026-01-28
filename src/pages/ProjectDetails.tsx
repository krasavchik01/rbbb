import { useMemo, useState, useEffect } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, Users, ArrowLeft, CheckSquare, File, Briefcase, FileText, Plus, Edit, DollarSign } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useProjects } from "@/hooks/useSupabaseData";
import { useAuth } from "@/contexts/AuthContext";
import { supabaseDataStore } from "@/lib/supabaseDataStore";
import { ProjectFileManager } from "@/components/projects/ProjectFileManager";
import { ProjectAmendmentForm } from "@/components/projects/ProjectAmendmentForm";
import { ProjectTeamEvaluation } from "@/components/projects/ProjectTeamEvaluation";
import { ProjectEditProcurement } from "@/components/projects/ProjectEditProcurement";
import { ProjectStage, AdditionalService, ProjectAmendment } from "@/types/project-v3";

export default function ProjectDetails() {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { project?: any } | null;
  const { projects } = useProjects();
  const { user } = useAuth();
  
  const [project, setProject] = useState<any>(null);
  const [projectFiles, setProjectFiles] = useState<any[]>([]);
  const [projectAmendments, setProjectAmendments] = useState<ProjectAmendment[]>([]);
  const [isAmendmentDialogOpen, setIsAmendmentDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Загрузка проекта
  useEffect(() => {
    const loadProject = async () => {
      if (state?.project) {
        setProject(state.project);
      } else if (params.id) {
        // Загружаем из списка проектов
        const foundProject = projects.find(p => p.id === params.id);
        if (foundProject) {
          setProject(foundProject);
        } else {
          // Пробуем загрузить напрямую из Supabase
          const allProjects = await supabaseDataStore.getProjects();
          const found = allProjects.find(p => p.id === params.id || p.notes?.id === params.id);
          if (found) {
            // Распаковываем notes если нужно
            const projectData = found.notes && typeof found.notes === 'object' 
              ? { ...found, ...found.notes, id: found.id }
              : found;
            setProject(projectData);
          }
        }
      }
    };
    
    loadProject();
  }, [params.id, state, projects]);

  // Загрузка файлов и доп соглашений
  useEffect(() => {
    if (!project?.id) return;
    
    const loadProjectData = async () => {
      try {
        const projectId = project.id || project.notes?.id;
        if (projectId) {
          const [files, amendments] = await Promise.all([
            supabaseDataStore.getProjectFiles(projectId),
            supabaseDataStore.getProjectAmendments(projectId),
          ]);
          setProjectFiles(files);
          setProjectAmendments(amendments);
        }
      } catch (error) {
        console.error('Error loading project data:', error);
      }
    };
    
    loadProjectData();
  }, [project]);

  // Проверка прав для добавления доп соглашений
  const canAddAmendment = user?.role === 'procurement' || user?.role === 'admin' || user?.role === 'ceo';

  // Проверка прав для редактирования проекта (отдел закупок)
  const canEditProject = user?.role === 'procurement' || user?.role === 'admin' || user?.role === 'ceo';

  // Получаем этапы проекта из notes
  const projectStages = useMemo<ProjectStage[]>(() => {
    if (!project) return [];
    const stages = project.stages || project.notes?.stages;
    return Array.isArray(stages) ? stages : [];
  }, [project]);

  // Получаем дополнительные услуги из notes
  const additionalServices = useMemo<AdditionalService[]>(() => {
    if (!project) return [];
    const services = project.additionalServices || project.notes?.additionalServices;
    return Array.isArray(services) ? services : [];
  }, [project]);

  // Получаем команду проекта
  const teamMembers = useMemo(() => {
    if (!project) return [];
    return project.team || project.notes?.team || [];
  }, [project]);

  const completionPct = useMemo(() => {
    return project?.completionPercent || project?.completion || 0;
  }, [project]);

  if (!project) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Проект не найден</p>
      </div>
    );
  }

  const projectName = project.name || project.client?.name || 'Без названия';
  const projectCompany = project.companyName || project.company || project.notes?.companyName || 'Не указана';
  const projectStatus = project.status || project.notes?.status || 'new';
  const projectDeadline = project.contract?.serviceEndDate || project.deadline || new Date().toISOString();

  const handleAmendmentSuccess = async () => {
    setIsAmendmentDialogOpen(false);
    // Перезагружаем доп соглашения
    const projectId = project.id || project.notes?.id;
    if (projectId) {
      const amendments = await supabaseDataStore.getProjectAmendments(projectId);
      setProjectAmendments(amendments);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{projectName}</h1>
          <p className="text-muted-foreground">Компания: {projectCompany}</p>
        </div>
        <div className="flex gap-2">
          {canEditProject && (
            <Button onClick={() => setIsEditDialogOpen(true)}>
              <Edit className="w-4 h-4 mr-2" /> Редактировать
            </Button>
          )}
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Назад
          </Button>
        </div>
      </div>

      {/* Карточка со статусом - для закупок упрощённая */}
      <Card className="p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{projectStatus}</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Команда - скрываем от закупок */}
          {user?.role !== 'procurement' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="w-4 h-4" /> Команда
              </div>
              <div className="text-lg font-semibold">{teamMembers.length} участников</div>
            </div>
          )}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" /> Дедлайн
            </div>
            <div className="text-lg font-semibold">
              {new Date(projectDeadline).toLocaleDateString('ru-RU')}
            </div>
          </div>
          {/* Прогресс - скрываем от закупок */}
          {user?.role !== 'procurement' && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Прогресс</div>
              <Progress value={completionPct} className="h-2" />
              <div className="text-sm">{completionPct}%</div>
            </div>
          )}
        </div>
      </Card>

      {/* Для закупок показываем только нужные вкладки */}
      <Tabs defaultValue={user?.role === 'procurement' ? 'contract' : 'overview'} className="space-y-4" data-testid="project-tabs">
        <TabsList>
          {user?.role !== 'procurement' && (
            <TabsTrigger value="overview" data-testid="tab-overview">Обзор</TabsTrigger>
          )}
          {user?.role === 'procurement' && (
            <TabsTrigger value="contract" data-testid="tab-contract">Договор</TabsTrigger>
          )}
          <TabsTrigger value="files" data-testid="tab-files">Документы</TabsTrigger>
          <TabsTrigger value="amendments" data-testid="tab-amendments">Доп соглашения</TabsTrigger>
          {user?.role !== 'procurement' && (
            <>
              <TabsTrigger value="tasks" data-testid="tab-tasks">Задачи</TabsTrigger>
              <TabsTrigger value="stages" data-testid="tab-stages">Этапы</TabsTrigger>
              <TabsTrigger value="services" data-testid="tab-services">Услуги</TabsTrigger>
              <TabsTrigger value="evaluation" data-testid="tab-evaluation">Оценка команды</TabsTrigger>
            </>
          )}
        </TabsList>

        {/* Вкладка Договор - для отдела закупок */}
        <TabsContent value="contract" className="space-y-4">
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Информация о договоре
            </h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <span className="text-sm text-muted-foreground">Номер договора</span>
                  <p className="font-medium">{project?.contract?.number || '—'}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Дата договора</span>
                  <p className="font-medium">{project?.contract?.date ? new Date(project.contract.date).toLocaleDateString('ru-RU') : '—'}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Предмет договора</span>
                  <p className="font-medium">{project?.contract?.subject || '—'}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <span className="text-sm text-muted-foreground">Срок оказания услуг</span>
                  <p className="font-medium">
                    {project?.contract?.serviceStartDate ? new Date(project.contract.serviceStartDate).toLocaleDateString('ru-RU') : '—'}
                    {' — '}
                    {project?.contract?.serviceEndDate ? new Date(project.contract.serviceEndDate).toLocaleDateString('ru-RU') : '—'}
                  </p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Сумма без НДС</span>
                  <p className="font-medium text-lg">{project?.contract?.amountWithoutVAT?.toLocaleString() || '—'} ₸</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">НДС ({project?.contract?.vatRate || 0}%)</span>
                  <p className="font-medium">{project?.contract?.vatAmount?.toLocaleString() || '—'} ₸</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Итого с НДС</span>
                  <p className="font-medium text-lg text-primary">{project?.contract?.amountWithVAT?.toLocaleString() || '—'} ₸</p>
                </div>
              </div>
            </div>

            {/* Разбивка по годам если есть */}
            {project?.contract?.isMultiYear && project?.contract?.yearlyAmounts?.length > 0 && (
              <div className="mt-6 pt-6 border-t">
                <h4 className="font-medium mb-3">Разбивка по годам</h4>
                <div className="space-y-2">
                  {project.contract.yearlyAmounts.map((ya: any) => (
                    <div key={ya.year} className="flex justify-between p-2 bg-muted rounded">
                      <span>{ya.year} год</span>
                      <span className="font-medium">{ya.amount?.toLocaleString()} ₸</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="p-6 lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold">Команда проекта</h3>
              </div>
              <div className="space-y-3">
                {teamMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Команда не назначена</p>
                ) : (
                  teamMembers.map((member: any) => {
                    const bonusAmount = project.finances?.teamBonuses?.[member.userId || member.id] || 0;
                    return (
                      <div key={member.userId || member.id} className="flex items-center gap-3 p-3 rounded bg-secondary/20">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback>
                            {(member.userName || member.name || 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{member.userName || member.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{member.role}</p>
                        </div>
                        {bonusAmount > 0 && (
                          <div className="flex items-center gap-1 text-primary">
                            <DollarSign className="w-4 h-4" />
                            <span className="text-sm font-semibold">{bonusAmount.toLocaleString()} ₸</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <CheckSquare className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold">Информация</h3>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Статус:</span>
                  <p className="font-medium">{projectStatus}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Прогресс:</span>
                  <p className="font-medium">{completionPct}%</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Дедлайн:</span>
                  <p className="font-medium">{new Date(projectDeadline).toLocaleDateString('ru-RU')}</p>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-primary" />
              Задачи проекта
            </h3>
            {!project.tasks || project.tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Задачи не созданы</p>
            ) : (
              <div className="space-y-3">
                {project.tasks.map((task: any, index: number) => {
                  const executor = teamMembers.find((m: any) => m.userId === task.assignedTo);
                  const bonusAmount = project.finances?.teamBonuses?.[task.assignedTo] || 0;
                  return (
                    <div key={task.id || index} className="p-4 border rounded-lg" data-testid="project-task">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{task.title || task.name}</h4>
                            <Badge variant={task.status === 'completed' ? 'default' : 'secondary'}>
                              {task.status === 'completed' ? '✅ Выполнено' : '🔄 В работе'}
                            </Badge>
                          </div>
                          {task.description && (
                            <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1">
                              <Users className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium">{executor?.userName || executor?.name || 'Не назначен'}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4 text-muted-foreground" />
                              <span>{task.deadline ? new Date(task.deadline).toLocaleDateString('ru-RU') : 'Нет дедлайна'}</span>
                            </div>
                            {bonusAmount > 0 && (
                              <div className="flex items-center gap-1 text-primary">
                                <DollarSign className="w-4 h-4" />
                                <span className="font-medium">{bonusAmount.toLocaleString()} ₸</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="files" className="space-y-4">
          <ProjectFileManager
            projectId={project.id || project.notes?.id}
            uploadedBy={user?.id || ""}
            onFilesChange={setProjectFiles}
          />
        </TabsContent>

        <TabsContent value="stages" className="space-y-4">
          <Card className="p-6" data-testid="stages-tab-content">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Этапы проекта
            </h3>
            {projectStages.length === 0 ? (
              <p className="text-sm text-muted-foreground">Этапы не добавлены</p>
            ) : (
              <div className="space-y-4">
                {projectStages.map((stage, index) => (
                  <div key={stage.id || index} className="p-4 border rounded-lg" data-testid="project-stage">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{stage.name}</h4>
                      <Badge variant="outline">
                        {new Date(stage.startDate).toLocaleDateString('ru-RU')} - {new Date(stage.endDate).toLocaleDateString('ru-RU')}
                      </Badge>
                    </div>
                    {stage.description && (
                      <p className="text-sm text-muted-foreground">{stage.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          <Card className="p-6" data-testid="services-tab-content">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Briefcase className="w-5 h-5" />
              Дополнительные услуги
            </h3>
            {additionalServices.length === 0 ? (
              <p className="text-sm text-muted-foreground">Дополнительные услуги не добавлены</p>
            ) : (
              <div className="space-y-3">
                {additionalServices.map((service, index) => (
                  <div key={service.id || index} className="p-4 border rounded-lg" data-testid="additional-service">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{service.name}</h4>
                        {service.description && (
                          <p className="text-sm text-muted-foreground mt-1">{service.description}</p>
                        )}
                      </div>
                      {service.cost && (
                        <Badge variant="secondary">
                          {new Intl.NumberFormat('ru-RU').format(service.cost)} ₸
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="amendments" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Дополнительные соглашения
            </h3>
            {canAddAmendment && (
              <Button onClick={() => setIsAmendmentDialogOpen(true)} size="sm" data-testid="add-amendment-button">
                <Plus className="w-4 h-4 mr-2" />
                Добавить доп соглашение
              </Button>
            )}
          </div>
          
          {projectAmendments.length === 0 ? (
            <Card className="p-6">
              <p className="text-sm text-muted-foreground text-center py-4">
                Доп соглашения не добавлены
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {projectAmendments.map((amendment) => (
                <Card key={amendment.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">№ {amendment.number}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(amendment.date).toLocaleDateString('ru-RU')}
                        </span>
                      </div>
                      <p className="text-sm">{amendment.description}</p>
                      {amendment.fileUrl && (
                        <a
                          href={amendment.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline mt-2 inline-block"
                        >
                          <File className="w-4 h-4 inline mr-1" />
                          Открыть файл
                        </a>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="evaluation" className="space-y-4">
          <ProjectTeamEvaluation
            projectId={project.id || project.notes?.id}
            projectStatus={projectStatus}
            teamMembers={teamMembers.map((m: any) => ({
              userId: m.userId || m.id,
              userName: m.userName || m.name,
              role: m.role,
            }))}
          />
        </TabsContent>
      </Tabs>

      {/* Диалог добавления доп соглашения */}
      <Dialog open={isAmendmentDialogOpen} onOpenChange={setIsAmendmentDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Добавить доп соглашение</DialogTitle>
          </DialogHeader>
          <ProjectAmendmentForm
            projectId={project.id || project.notes?.id}
            createdBy={user?.id || ""}
            onSuccess={handleAmendmentSuccess}
            onCancel={() => setIsAmendmentDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Диалог редактирования проекта (для отдела закупок) */}
      {canEditProject && project && (
        <ProjectEditProcurement
          project={project}
          isOpen={isEditDialogOpen}
          onClose={() => setIsEditDialogOpen(false)}
          onSave={(updatedProject) => {
            setProject(updatedProject);
          }}
        />
      )}
    </div>
  );
}


