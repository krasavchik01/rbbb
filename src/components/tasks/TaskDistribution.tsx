import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { 
  Users, 
  UserCheck, 
  MessageSquare, 
  CheckCircle2, 
  Circle,
  GripVertical,
  Plus,
  Eye,
  Edit
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployees } from "@/hooks/useSupabaseData";
import { useToast } from "@/hooks/use-toast";
import { supabaseDataStore } from "@/lib/supabaseDataStore";

interface Task {
  id: string;
  code: string;
  name: string;
  status: 'not_assigned' | 'assigned' | 'in_progress' | 'review' | 'completed';
  assigned_to?: string;
  assigned_user?: {
    id: string;
    name: string;
    email: string;
  };
  reviewer_id?: string;
  reviewer?: {
    id: string;
    name: string;
    email: string;
  };
  default_assignee_role?: string;
  comment?: string;
  partner_comment?: string;
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
      partner_comment: (wp.data as any)?.partner_comment || ''
    }));

    setTasks(tasksData);
  }, [workPapers]);

  // Автоматическое распределение задач при первом открытии менеджером
  useEffect(() => {
    if (isManager && tasks.length > 0 && tasks.every(t => t.status === 'not_assigned')) {
      autoAssignTasks();
    }
  }, [isManager, tasks.length]);

  const autoAssignTasks = async () => {
    try {
      const tasksToAssign = tasks.filter(t => t.status === 'not_assigned' && t.default_assignee_role);
      
      for (const task of tasksToAssign) {
        const role = task.default_assignee_role?.toLowerCase();
        
        // Ищем подходящего члена команды
        const suitableMember = teamMembers.find(tm => {
          const tmRole = tm.role?.toLowerCase() || '';
          
          if (role === 'assistant') {
            return tmRole.includes('assistant');
          } else if (role === 'supervisor') {
            return tmRole.includes('supervisor');
          } else if (role === 'manager') {
            return tmRole.includes('manager');
          } else if (role === 'tax') {
            return tmRole.includes('tax');
          }
          return false;
        });

        if (suitableMember) {
          await supabaseDataStore.updateWorkPaper(task.id, {
            assigned_to: suitableMember.userId || suitableMember.id,
            status: 'assigned'
          });
        }
      }

      toast({
        title: "Задачи распределены",
        description: "Задачи автоматически назначены участникам команды",
      });

      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Ошибка автоматического распределения:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось автоматически распределить задачи",
        variant: "destructive"
      });
    }
  };

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

  const tasksByStatus = useMemo(() => {
    const grouped: Record<string, Task[]> = {};
    STATUS_COLUMNS.forEach(col => {
      grouped[col.id] = tasks.filter(t => t.status === col.id);
    });
    return grouped;
  }, [tasks]);

  return (
    <div className="space-y-6">
      {/* Заголовок и переключатель режима */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Распределение задач</h2>
          <p className="text-muted-foreground">
            {isManager ? 'Управляйте распределением задач между участниками' : 
             isPartner ? 'Проверьте распределение задач и оставьте комментарии' :
             'Просмотр распределения задач'}
          </p>
        </div>
        {isManager && (
          <Button
            variant="outline"
            onClick={() => setIsViewMode(!isViewMode)}
          >
            {isViewMode ? <Edit className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
            {isViewMode ? 'Редактировать' : 'Просмотр'}
          </Button>
        )}
      </div>

      {/* Канбан-доска */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {STATUS_COLUMNS.map(column => (
          <Card key={column.id} className="p-4">
            <div className={`${column.color} p-2 rounded-lg mb-4`}>
              <h3 className="font-semibold text-sm">{column.label}</h3>
              <Badge variant="secondary" className="mt-1">
                {tasksByStatus[column.id]?.length || 0}
              </Badge>
            </div>

            <div className="space-y-2 min-h-[200px]">
              {tasksByStatus[column.id]?.map(task => (
                <Card
                  key={task.id}
                  className={`p-3 cursor-pointer hover:shadow-md transition-shadow ${
                    draggedTask === task.id ? 'opacity-50' : ''
                  }`}
                  draggable={isManager && !isViewMode && column.id !== 'completed'}
                  onDragStart={() => handleDragStart(task.id)}
                  onClick={() => handleTaskClick(task)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <GripVertical className="w-4 h-4 text-muted-foreground" />
                        <span className="text-xs font-mono text-muted-foreground">{task.code}</span>
                      </div>
                      <p className="text-sm font-medium">{task.name}</p>
                    </div>
                  </div>

                  {task.assigned_user && (
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <UserCheck className="w-3 h-3" />
                      <span>{task.assigned_user.name}</span>
                    </div>
                  )}

                  {task.partner_comment && (
                    <div className="mt-2 p-2 bg-yellow-50 rounded text-xs">
                      <MessageSquare className="w-3 h-3 inline mr-1" />
                      Комментарий партнера
                    </div>
                  )}
                </Card>
              ))}
            </div>

            {/* Зона для перетаскивания на участника */}
            {isManager && !isViewMode && column.id !== 'not_assigned' && column.id !== 'completed' && (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-muted-foreground mb-2">Перетащите задачу на участника:</p>
                {teamMembers.map(member => (
                  <div
                    key={member.userId || member.id}
                    className="p-2 border-2 border-dashed border-gray-300 rounded hover:border-primary transition-colors"
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(member.userId || member.id, column.id)}
                  >
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs">{member.name || member.displayName}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Диалог комментария */}
      <Dialog open={isCommentDialogOpen} onOpenChange={setIsCommentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Задача: {selectedTask?.code} - {selectedTask?.name}</DialogTitle>
            <DialogDescription>
              {isPartner ? 'Оставьте комментарий к распределению задачи' : 'Просмотр задачи'}
            </DialogDescription>
          </DialogHeader>

          {selectedTask && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-1">Исполнитель:</p>
                <p className="text-sm text-muted-foreground">
                  {selectedTask.assigned_user?.name || 'Не назначено'}
                </p>
              </div>

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
                  <p className="text-sm text-muted-foreground bg-yellow-50 p-2 rounded">
                    {selectedTask.partner_comment}
                  </p>
                </div>
              )}

              {isPartner && (
                <div className="flex justify-end gap-2">
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

