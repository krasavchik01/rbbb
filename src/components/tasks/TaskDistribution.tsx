import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Users,
  UserCheck,
  MessageSquare,
  CheckCircle2,
  Circle,
  GripVertical,
  Plus,
  Eye,
  Edit,
  Calendar,
  Clock,
  AlertCircle,
  Search,
  X
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployees } from "@/hooks/useSupabaseData";
import { useToast } from "@/hooks/use-toast";
import { supabaseDataStore } from "@/lib/supabaseDataStore";
import { ALL_PROCEDURE_TEMPLATES_WITH_KZ, type ProcedureTemplate } from "@/lib/auditProceduresLibrary";

interface Task {
  id: string;
  code: string;
  name: string;
  status: 'not_assigned' | 'assigned' | 'in_progress' | 'review' | 'completed';
  assigned_to?: string;
  assigned_user?: {
    id: string;
    name: string;
    email: string | null;
  };
  reviewer_id?: string;
  reviewer?: {
    id: string;
    name: string;
    email: string | null;
  };
  default_assignee_role?: string;
  comment?: string;
  partner_comment?: string;
  deadline?: string;
  estimatedHours?: number;
}

interface TaskDistributionProps {
  projectId: string;
  teamMembers: any[];
  workPapers: any[];
  onUpdate?: () => void;
}

const STATUS_COLUMNS = [
  { id: 'not_assigned', label: 'Не назначено', color: 'bg-gray-100' },
  { id: 'assigned', label: 'Назначено', color: 'bg-blue-100' },
  { id: 'in_progress', label: 'В работе', color: 'bg-yellow-100' },
  { id: 'review', label: 'На проверке', color: 'bg-purple-100' },
  { id: 'completed', label: 'Завершено', color: 'bg-green-100' }
];

export function TaskDistribution({ projectId, teamMembers, workPapers, onUpdate }: TaskDistributionProps) {
  const { user } = useAuth();
  const { employees } = useEmployees();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [comment, setComment] = useState('');
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [draggedTask, setDraggedTask] = useState<string | null>(null);

  // Новые state для библиотеки процедур
  const [showProcedureLibrary, setShowProcedureLibrary] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [selectedProcedures, setSelectedProcedures] = useState<Set<string>>(new Set());
  const [isAddingProcedures, setIsAddingProcedures] = useState(false);

  const isManager = user?.role === 'manager_1' || user?.role === 'manager_2' || user?.role === 'manager_3';
  const isPartner = user?.role === 'partner';

  // Преобразуем workPapers в tasks
  useEffect(() => {
    if (!workPapers || workPapers.length === 0) return;

    const tasksData: Task[] = workPapers.map((wp: any) => ({
      id: wp.id,
      code: wp.code,
      name: wp.name,
      status: wp.status === 'not_started' ? 'not_assigned' :
              wp.status === 'in_progress' ? 'in_progress' :
              wp.status === 'awaiting_review' ? 'review' :
              wp.status === 'completed' ? 'completed' : 'assigned',
      assigned_to: wp.assigned_to,
      assigned_user: wp.assigned_user,
      reviewer_id: wp.reviewer_id,
      reviewer: wp.reviewer,
      default_assignee_role: wp.template?.default_assignee_role,
      partner_comment: (wp.data as any)?.partner_comment || '',
      deadline: (wp.data as any)?.deadline || '',
      estimatedHours: wp.template?.estimated_hours || (wp.data as any)?.estimated_hours || 0
    }));

    setTasks(tasksData);
  }, [workPapers]);

  // Фильтрованные процедуры из библиотеки
  const filteredProcedures = useMemo(() => {
    let procedures = ALL_PROCEDURE_TEMPLATES_WITH_KZ;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      procedures = procedures.filter(p =>
        p.code.toLowerCase().includes(query) ||
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query)
      );
    }

    if (selectedStage !== 'all') {
      procedures = procedures.filter(p => p.stage === selectedStage);
    }

    if (selectedArea !== 'all') {
      procedures = procedures.filter(p => p.area === selectedArea);
    }

    return procedures;
  }, [searchQuery, selectedStage, selectedArea]);

  // Группировка процедур по этапам
  const proceduresByStage = useMemo(() => {
    const grouped: Record<string, ProcedureTemplate[]> = {};
    filteredProcedures.forEach(proc => {
      if (!grouped[proc.stage]) {
        grouped[proc.stage] = [];
      }
      grouped[proc.stage].push(proc);
    });
    return grouped;
  }, [filteredProcedures]);

  // Статистика загруженности команды
  const teamWorkload = useMemo(() => {
    const workload: Record<string, { hours: number; tasks: number }> = {};

    teamMembers.forEach(member => {
      const memberId = member.userId || member.id;
      workload[memberId] = { hours: 0, tasks: 0 };
    });

    tasks.forEach(task => {
      if (task.assigned_to && workload[task.assigned_to] && task.status !== 'completed') {
        workload[task.assigned_to].hours += task.estimatedHours || 0;
        workload[task.assigned_to].tasks += 1;
      }
    });

    return workload;
  }, [tasks, teamMembers]);

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setComment(task.partner_comment || '');
    setIsCommentDialogOpen(true);
  };

  const handleSaveComment = async () => {
    if (!selectedTask) return;

    try {
      const currentData = selectedTask.partner_comment ? {} : {};
      await supabaseDataStore.updateWorkPaper(selectedTask.id, {
        data: {
          ...currentData,
          partner_comment: comment
        }
      });

      setTasks(tasks.map(t =>
        t.id === selectedTask.id
          ? { ...t, partner_comment: comment, data: { ...(t as any).data, partner_comment: comment } }
          : t
      ));

      toast({
        title: "Комментарий сохранен",
        description: "Ваш комментарий добавлен к задаче",
      });

      setIsCommentDialogOpen(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Ошибка сохранения комментария:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить комментарий",
        variant: "destructive"
      });
    }
  };

  const handleDragStart = (taskId: string) => {
    if (!isManager || isViewMode) return;
    setDraggedTask(taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (userId: string, status: string) => {
    if (!draggedTask || !isManager || isViewMode) return;

    try {
      await supabaseDataStore.updateWorkPaper(draggedTask, {
        assigned_to: userId,
        status: status as any
      });

      setTasks(tasks.map(t =>
        t.id === draggedTask
          ? {
              ...t,
              assigned_to: userId,
              assigned_user: employees.find(e => e.id === userId),
              status: status as any
            }
          : t
      ));

      toast({
        title: "Задача переназначена",
        description: "Задача успешно переназначена",
      });

      setDraggedTask(null);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Ошибка переназначения задачи:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось переназначить задачу",
        variant: "destructive"
      });
    }
  };

  const handleSetDeadline = async (taskId: string, deadline: string) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      await supabaseDataStore.updateWorkPaper(taskId, {
        data: {
          ...(task as any)?.data,
          deadline
        }
      });

      setTasks(tasks.map(t =>
        t.id === taskId ? { ...t, deadline } : t
      ));

      toast({
        title: "Дедлайн установлен",
        description: `Срок выполнения: ${new Date(deadline).toLocaleDateString('ru-RU')}`,
      });

      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Ошибка установки дедлайна:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось установить дедлайн",
        variant: "destructive"
      });
    }
  };

  const handleAddSelectedProcedures = async () => {
    if (selectedProcedures.size === 0) {
      toast({
        title: "Выберите процедуры",
        description: "Необходимо выбрать хотя бы одну процедуру",
        variant: "destructive"
      });
      return;
    }

    setIsAddingProcedures(true);
    try {
      const proceduresToAdd = ALL_PROCEDURE_TEMPLATES_WITH_KZ.filter(p =>
        selectedProcedures.has(p.code)
      );

      for (const procedure of proceduresToAdd) {
        // Создаем workpaper из процедуры
        await supabaseDataStore.createWorkPaper({
          project_id: projectId,
          code: procedure.code,
          name: procedure.name,
          status: 'not_started',
          data: {
            description: procedure.description,
            estimated_hours: procedure.estimatedHours,
            required_role: procedure.requiredRole,
            risk_level: procedure.riskLevel,
            is_required: procedure.isRequired
          }
        });
      }

      toast({
        title: "Процедуры добавлены",
        description: `Добавлено ${proceduresToAdd.length} процедур`,
      });

      setSelectedProcedures(new Set());
      setShowProcedureLibrary(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Ошибка добавления процедур:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось добавить процедуры",
        variant: "destructive"
      });
    } finally {
      setIsAddingProcedures(false);
    }
  };

  const toggleProcedureSelection = (code: string) => {
    const newSelection = new Set(selectedProcedures);
    if (newSelection.has(code)) {
      newSelection.delete(code);
    } else {
      newSelection.add(code);
    }
    setSelectedProcedures(newSelection);
  };

  const tasksByStatus = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    STATUS_COLUMNS.forEach(col => {
      grouped[col.id] = tasks.filter(t => t.status === col.id);
    });
    return grouped;
  }, [tasks]);

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
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
      tax_specialist: 'Налоговый специалист',
      senior: 'Старший аудитор',
      assistant: 'Ассистент',
      specialist: 'Специалист',
      manager: 'Менеджер'
    };
    return labels[role] || role;
  };

  const getRoleColor = (role: string) => {
    if (role === 'partner') return 'bg-purple-100 text-purple-700 border-purple-200';
    if (role.includes('manager')) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (role.includes('supervisor')) return 'bg-green-100 text-green-700 border-green-200';
    if (role.includes('assistant')) return 'bg-orange-100 text-orange-700 border-orange-200';
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const getInitials = (name: string) => {
    const parts = (name || '').split(' ');
    return parts.slice(0, 2).map(p => p[0]).join('').toUpperCase();
  };

  const stageLabels: Record<string, string> = {
    client_acceptance: 'Принятие клиента',
    planning: 'Планирование',
    risk_assessment: 'Оценка рисков',
    controls_testing: 'Тестирование контролей',
    substantive_testing: 'Субстантивные процедуры',
    completion: 'Завершение',
    reporting: 'Отчетность'
  };

  const areaLabels: Record<string, string> = {
    cash: 'Денежные средства',
    receivables: 'Дебиторская задолженность',
    inventory: 'Запасы',
    fixed_assets: 'Основные средства',
    payables: 'Кредиторская задолженность',
    revenue: 'Выручка',
    operating_expenses: 'Операционные расходы',
    cost_of_sales: 'Себестоимость',
    payroll: 'Расходы на персонал',
    tax_compliance: 'Налоговое соответствие',
    related_parties: 'Связанные стороны',
    going_concern: 'Непрерывность деятельности',
    subsequent_events: 'События после отчетной даты',
    disclosures: 'Раскрытия'
  };

  return (
    <div className="space-y-6">
      {/* Заголовок и кнопки */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Распределение задач</h2>
          <p className="text-muted-foreground">
            {isManager ? 'Выберите процедуры из библиотеки и распределите между участниками команды' :
             isPartner ? 'Проверьте распределение задач и оставьте комментарии' :
             'Просмотр распределения задач'}
          </p>
        </div>
        <div className="flex gap-2">
          {isManager && (
            <>
              <Button
                variant="default"
                onClick={() => setShowProcedureLibrary(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Добавить процедуры
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsViewMode(!isViewMode)}
              >
                {isViewMode ? <Edit className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                {isViewMode ? 'Редактировать' : 'Просмотр'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Команда проекта с загруженностью */}
      {isManager && teamMembers.length > 0 && (
        <Card className="p-6 bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-lg">Команда проекта ({teamMembers.length})</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {teamMembers.map(member => {
              const memberId = member.userId || member.id;
              const workload = teamWorkload[memberId] || { hours: 0, tasks: 0 };
              const maxHours = 40; // Максимальная недельная загрузка
              const loadPercentage = Math.min((workload.hours / maxHours) * 100, 100);

              return (
                <Card
                  key={memberId}
                  className={`p-4 border-2 ${getRoleColor(member.role)} transition-all hover:shadow-lg`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center font-bold shadow-sm">
                      {getInitials(member.name || member.displayName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {member.name || member.displayName}
                      </div>
                      <div className="text-xs opacity-70 mb-2">
                        {getRoleLabel(member.role)}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            {workload.tasks} задач
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {workload.hours}ч
                          </span>
                        </div>
                        <Progress value={loadPercentage} className="h-1.5" />
                        <div className="text-[10px] opacity-60">
                          {loadPercentage > 80 ? '⚠️ Высокая загрузка' :
                           loadPercentage > 50 ? '📊 Средняя загрузка' :
                           '✅ Доступен'}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </Card>
      )}

      {/* Канбан-доска */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {STATUS_COLUMNS.map(column => (
          <Card key={column.id} className="p-4">
            <div className={`${column.color} p-3 rounded-lg mb-4`}>
              <h3 className="font-semibold text-sm">{column.label}</h3>
              <Badge variant="secondary" className="mt-1">
                {tasksByStatus[column.id]?.length || 0}
              </Badge>
            </div>

            <div className="space-y-2 min-h-[300px]">
              {tasksByStatus[column.id]?.map(task => (
                <Card
                  key={task.id}
                  className={`p-3 cursor-pointer hover:shadow-md transition-all ${
                    draggedTask === task.id ? 'opacity-50' : ''
                  } ${task.deadline && new Date(task.deadline) < new Date() && task.status !== 'completed' ? 'border-red-400 border-2' : ''}`}
                  draggable={isManager && !isViewMode && column.id !== 'completed'}
                  onDragStart={() => handleDragStart(task.id)}
                  onClick={() => handleTaskClick(task)}
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-xs font-mono text-muted-foreground">{task.code}</span>
                    </div>
                    <p className="text-sm font-medium leading-tight">{task.name}</p>

                    {task.assigned_user && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <UserCheck className="w-3 h-3" />
                        <span className="truncate">{task.assigned_user.name}</span>
                      </div>
                    )}

                    {task.estimatedHours && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>{task.estimatedHours}ч</span>
                      </div>
                    )}

                    {task.deadline && (
                      <div className={`flex items-center gap-2 text-xs ${
                        new Date(task.deadline) < new Date() && task.status !== 'completed'
                          ? 'text-red-600 font-semibold'
                          : 'text-muted-foreground'
                      }`}>
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(task.deadline).toLocaleDateString('ru-RU')}</span>
                      </div>
                    )}

                    {task.partner_comment && (
                      <div className="mt-2 p-2 bg-yellow-50 rounded text-xs">
                        <MessageSquare className="w-3 h-3 inline mr-1" />
                        Комментарий партнера
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>

            {/* Зона для перетаскивания */}
            {isManager && !isViewMode && column.id !== 'not_assigned' && column.id !== 'completed' && (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-muted-foreground font-semibold mb-2">Перетащите на:</p>
                {teamMembers.map(member => (
                  <div
                    key={member.userId || member.id}
                    className="p-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary hover:bg-primary/5 transition-colors"
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(member.userId || member.id, column.id)}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-[10px] font-bold">
                        {getInitials(member.name || member.displayName)}
                      </div>
                      <span className="text-xs truncate">{member.name || member.displayName}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Диалог библиотеки процедур */}
      <Dialog open={showProcedureLibrary} onOpenChange={setShowProcedureLibrary}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl">Библиотека аудиторских процедур</DialogTitle>
            <DialogDescription>
              Выберите процедуры для добавления в проект. {selectedProcedures.size} выбрано
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            {/* Фильтры */}
            <div className="flex gap-2 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Поиск по коду, названию или описанию..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={selectedStage} onValueChange={setSelectedStage}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Этап" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все этапы</SelectItem>
                  {Object.entries(stageLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedArea} onValueChange={setSelectedArea}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Область" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все области</SelectItem>
                  {Object.entries(areaLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(searchQuery || selectedStage !== 'all' || selectedArea !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedStage('all');
                    setSelectedArea('all');
                  }}
                >
                  <X className="w-4 h-4 mr-1" />
                  Сбросить
                </Button>
              )}
            </div>

            {/* Список процедур */}
            <div className="flex-1 overflow-y-auto border rounded-lg">
              {Object.entries(proceduresByStage).map(([stage, procedures]) => (
                <div key={stage} className="border-b last:border-b-0">
                  <div className="sticky top-0 bg-secondary/50 backdrop-blur-sm p-3 font-semibold text-sm border-b z-10">
                    {stageLabels[stage]} ({procedures.length})
                  </div>
                  <div className="divide-y">
                    {procedures.map(procedure => (
                      <div
                        key={procedure.code}
                        className={`p-4 hover:bg-accent/50 cursor-pointer transition-colors ${
                          selectedProcedures.has(procedure.code) ? 'bg-primary/10' : ''
                        }`}
                        onClick={() => toggleProcedureSelection(procedure.code)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-1">
                            {selectedProcedures.has(procedure.code) ? (
                              <CheckCircle2 className="w-5 h-5 text-primary" />
                            ) : (
                              <Circle className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="font-mono text-xs text-primary font-semibold">{procedure.code}</span>
                                <h4 className="font-medium text-sm mt-1">{procedure.name}</h4>
                              </div>
                              <div className="flex gap-1 flex-shrink-0">
                                <Badge variant={procedure.isRequired ? "default" : "outline"} className="text-xs">
                                  {procedure.isRequired ? 'Обязательно' : 'Опционально'}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  {procedure.estimatedHours}ч
                                </Badge>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {procedure.description}
                            </p>
                            <div className="flex gap-2 flex-wrap">
                              <Badge variant="outline" className="text-[10px]">
                                {getRoleLabel(procedure.requiredRole)}
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">
                                {areaLabels[procedure.area]}
                              </Badge>
                              {procedure.riskLevel === 'high' || procedure.riskLevel === 'very_high' ? (
                                <Badge variant="destructive" className="text-[10px]">
                                  ⚠️ Высокий риск
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {filteredProcedures.length === 0 && (
                <div className="p-12 text-center text-muted-foreground">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Процедуры не найдены</p>
                  <p className="text-xs mt-1">Попробуйте изменить параметры поиска</p>
                </div>
              )}
            </div>
          </div>

          {/* Кнопки действий */}
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Выбрано: <span className="font-semibold text-foreground">{selectedProcedures.size}</span> процедур
              {selectedProcedures.size > 0 && (
                <>
                  {' '}• Общее время: <span className="font-semibold text-foreground">
                    {ALL_PROCEDURE_TEMPLATES_WITH_KZ
                      .filter(p => selectedProcedures.has(p.code))
                      .reduce((sum, p) => sum + p.estimatedHours, 0)}
                  </span> часов
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowProcedureLibrary(false)}>
                Отмена
              </Button>
              <Button
                onClick={handleAddSelectedProcedures}
                disabled={selectedProcedures.size === 0 || isAddingProcedures}
              >
                {isAddingProcedures ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Добавление...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Добавить выбранные
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог комментария и деталей задачи */}
      <Dialog open={isCommentDialogOpen} onOpenChange={setIsCommentDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Задача: {selectedTask?.code} - {selectedTask?.name}</DialogTitle>
            <DialogDescription>
              {isPartner ? 'Оставьте комментарий к распределению задачи' :
               isManager ? 'Управление задачей' :
               'Просмотр задачи'}
            </DialogDescription>
          </DialogHeader>

          {selectedTask && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium mb-1">Исполнитель:</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedTask.assigned_user?.name || 'Не назначено'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Оценка времени:</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedTask.estimatedHours ? `${selectedTask.estimatedHours} часов` : 'Не указано'}
                  </p>
                </div>
              </div>

              {isManager && (
                <div>
                  <p className="text-sm font-medium mb-2">Дедлайн:</p>
                  <Input
                    type="date"
                    value={selectedTask.deadline || ''}
                    onChange={(e) => handleSetDeadline(selectedTask.id, e.target.value)}
                  />
                </div>
              )}

              {selectedTask.reviewer && (
                <div>
                  <p className="text-sm font-medium mb-1">Проверяющий:</p>
                  <p className="text-sm text-muted-foreground">{selectedTask.reviewer.name}</p>
                </div>
              )}

              {isPartner && (
                <div>
                  <p className="text-sm font-medium mb-2">Ваш комментарий:</p>
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Оставьте комментарий к распределению задачи..."
                    rows={4}
                  />
                </div>
              )}

              {selectedTask.partner_comment && (
                <div>
                  <p className="text-sm font-medium mb-1">Комментарий партнера:</p>
                  <p className="text-sm text-muted-foreground bg-yellow-50 p-3 rounded border border-yellow-200">
                    {selectedTask.partner_comment}
                  </p>
                </div>
              )}

              {isPartner && (
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setIsCommentDialogOpen(false)}>
                    Отмена
                  </Button>
                  <Button onClick={handleSaveComment}>
                    Сохранить комментарий
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
