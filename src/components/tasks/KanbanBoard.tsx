import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskChecklist } from "./TaskChecklist";
import { Task, TaskStatus, PriorityLevel, ChecklistItem, Project } from "@/types/project";
import { useAuth } from "@/contexts/AuthContext";
import { notifyTaskCompleted } from "@/lib/projectNotifications";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Calendar,
  Clock,
  Flag,
  CheckCircle2,
  AlertCircle,
  Play,
  Pause,
  Eye,
  Trash2,
} from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface KanbanBoardProps {
  project: Project;
  tasks: Task[];
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onDeleteTask: (taskId: string) => void;
  onAddTask: (task: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => void;
}

interface TaskCardProps {
  task: Task;
  onUpdate: (updates: Partial<Task>) => void;
  onDelete: () => void;
  onOpen: () => void;
  isDragging?: boolean;
}

function TaskCard({ task, onUpdate: _onUpdate, onDelete, onOpen, isDragging = false }: TaskCardProps) {
  const { hasRole } = useAuth();
  const canEdit = hasRole('partner') || hasRole('admin');

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  };

  const getPriorityColor = (priority: PriorityLevel) => {
    switch (priority) {
      case 'low': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      case 'med': return 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-800 dark:text-orange-200';
      case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const getPriorityIcon = (priority: PriorityLevel) => {
    switch (priority) {
      case 'critical': return <AlertCircle className="w-3 h-3" />;
      case 'high': return <Flag className="w-3 h-3" />;
      case 'med': return <Clock className="w-3 h-3" />;
      case 'low': return <CheckCircle2 className="w-3 h-3" />;
      default: return <Clock className="w-3 h-3" />;
    }
  };

  const completedChecklist = task.checklist.filter(item => item.done).length;
  const totalChecklist = task.checklist.length;
  const checklistProgress = totalChecklist > 0 ? Math.round((completedChecklist / totalChecklist) * 100) : 0;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`p-4 cursor-pointer hover:shadow-lg transition-all duration-200 border-2 hover:border-primary/50 ${
        isDragging ? 'shadow-2xl scale-105' : ''
      }`}
      onClick={onOpen}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <h5 className="font-semibold text-sm line-clamp-2 flex-1 pr-2">{task.title}</h5>
          {canEdit && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="h-6 w-6 p-0 text-red-600 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
        
        {/* Description */}
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {task.description}
          </p>
        )}

        {/* Priority and Time */}
        <div className="flex items-center justify-between">
          <Badge className={`text-xs flex items-center space-x-1 ${getPriorityColor(task.priority)}`}>
            {getPriorityIcon(task.priority)}
            <span>
              {task.priority === 'low' ? 'Низкий' :
               task.priority === 'med' ? 'Средний' :
               task.priority === 'high' ? 'Высокий' :
               task.priority === 'critical' ? 'Критический' : task.priority}
            </span>
          </Badge>
          
          {task.estimate_h > 0 && (
            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>{task.estimate_h}ч</span>
            </div>
          )}
        </div>

        {/* Checklist Progress */}
        {totalChecklist > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Чек-лист</span>
              <span className="font-medium">{completedChecklist}/{totalChecklist}</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-1.5">
              <div 
                className="bg-primary h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${checklistProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Labels */}
        {task.labels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {task.labels.slice(0, 2).map((label, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {label}
              </Badge>
            ))}
            {task.labels.length > 2 && (
              <Badge variant="outline" className="text-xs">
                +{task.labels.length - 2}
              </Badge>
            )}
          </div>
        )}

        {/* Due Date */}
        {task.due_at && (
          <div className="flex items-center space-x-1 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            <span>{new Date(task.due_at).toLocaleDateString('ru-RU')}</span>
          </div>
        )}
      </div>
    </Card>
  );
}

interface TaskColumnProps {
  status: TaskStatus;
  tasks: Task[];
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onDeleteTask: (taskId: string) => void;
  onOpenTask: (task: Task) => void;
  onAddTask: (status: TaskStatus) => void;
}

function TaskColumn({ status, tasks, onUpdateTask, onDeleteTask, onOpenTask, onAddTask }: TaskColumnProps) {
  const { hasRole } = useAuth();
  const canEdit = hasRole('partner') || hasRole('admin');

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case 'backlog': return <AlertCircle className="w-4 h-4 text-gray-500" />;
      case 'todo': return <Clock className="w-4 h-4 text-blue-500" />;
      case 'in_progress': return <Play className="w-4 h-4 text-yellow-500" />;
      case 'in_review': return <Eye className="w-4 h-4 text-purple-500" />;
      case 'done': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'blocked': return <Pause className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusLabel = (status: TaskStatus) => {
    switch (status) {
      case 'backlog': return 'Бэклог';
      case 'todo': return 'К выполнению';
      case 'in_progress': return 'В работе';
      case 'in_review': return 'На проверке';
      case 'done': return 'Выполнено';
      case 'blocked': return 'Заблокировано';
      default: return status;
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[500px]">
      {/* Column Header */}
      <div className="flex items-center justify-between mb-4 p-3 bg-secondary/20 rounded-lg">
        <div className="flex items-center space-x-2">
          {getStatusIcon(status)}
          <h4 className="font-semibold text-sm">{getStatusLabel(status)}</h4>
          <Badge variant="secondary" className="text-xs">
            {tasks.length}
          </Badge>
        </div>
        {canEdit && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onAddTask(status)}
            className="h-6 w-6 p-0"
          >
            <Plus className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Tasks */}
      <SortableContext items={tasks.map(task => task.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3 flex-1">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onUpdate={(updates) => onUpdateTask(task.id, updates)}
              onDelete={() => onDeleteTask(task.id)}
              onOpen={() => onOpenTask(task)}
            />
          ))}
        </div>
      </SortableContext>

      {/* Empty State */}
      {tasks.length === 0 && (
        <div className="flex-1 flex items-center justify-center p-8 text-center text-muted-foreground">
          <div>
            <div className="text-4xl mb-2">📋</div>
            <p className="text-sm">Нет задач</p>
            {canEdit && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAddTask(status)}
                className="mt-2"
              >
                <Plus className="w-4 h-4 mr-1" />
                Добавить задачу
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function KanbanBoard({ 
  project, 
  tasks, 
  onUpdateTask, 
  onDeleteTask, 
  onAddTask 
}: KanbanBoardProps) {
  const { hasRole, user } = useAuth();
  const { toast } = useToast();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "med" as PriorityLevel,
    status: "todo" as TaskStatus,
    estimate_h: 0,
    assignees: [] as string[],
    labels: [] as string[],
    checklist: [] as ChecklistItem[]
  });
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  const canEdit = hasRole('partner') || hasRole('admin');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const tasksByStatus = tasks.reduce((acc, task) => {
    if (!acc[task.status]) acc[task.status] = [];
    acc[task.status].push(task);
    return acc;
  }, {} as Record<TaskStatus, Task[]>);

  const statusOrder: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'in_review', 'done', 'blocked'];

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id);
    setDraggedTask(task || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedTask(null);

    if (!over || !canEdit) return;

    const taskId = active.id as string;
    const newStatus = over.id as TaskStatus;
    const task = tasks.find(t => t.id === taskId);

    if (statusOrder.includes(newStatus)) {
      onUpdateTask(taskId, { status: newStatus });
      
      // Если задача перешла в статус "done" - отправляем уведомление PM
      if (newStatus === 'done' && task && task.status !== 'done') {
        // Находим PM проекта (обычно это project.pm_id или в команде)
        const pmId = (project as any).pm_id || 'pm_1'; // TODO: получить из проекта
        
        notifyTaskCompleted({
          taskName: task.title,
          pmId: pmId,
          completorName: user?.name || 'Сотрудник',
          projectName: project.name || 'Проект',
          projectId: project.id
        });

        toast({
          title: "✅ Задача завершена",
          description: `PM получил уведомление о завершении задачи "${task.title}"`,
        });
      }
    }
  };

  const handleAddTask = (status: TaskStatus) => {
    setNewTask(prev => ({ ...prev, status }));
    setIsAddDialogOpen(true);
  };

  const handleCreateTask = () => {
    if (!newTask.title.trim()) return;

    const task: Omit<Task, 'id' | 'created_at' | 'updated_at'> = {
      project_id: project.id,
      title: newTask.title.trim(),
      description: newTask.description.trim(),
      assignees: newTask.assignees,
      reporter: 'demo-user',
      priority: newTask.priority,
      status: newTask.status,
      due_at: undefined,
      estimate_h: newTask.estimate_h,
      spent_h: 0,
      labels: newTask.labels,
      checklist: newTask.checklist,
      attachments: [],
      comments: [],
      parent_task_id: undefined
    };

    onAddTask(task);
    setNewTask({
      title: "",
      description: "",
      priority: "med",
      status: "todo",
      estimate_h: 0,
      assignees: [],
      labels: [],
      checklist: []
    });
    setIsAddDialogOpen(false);
  };

  const handleUpdateChecklist = (taskId: string, checklist: ChecklistItem[]) => {
    onUpdateTask(taskId, { checklist });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Kanban доска</h3>
          <p className="text-sm text-muted-foreground">
            {tasks.length} задач • {tasks.filter(t => t.status === 'done').length} выполнено
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Создать задачу
          </Button>
        )}
      </div>

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          {statusOrder.map((status) => (
            <TaskColumn
              key={status}
              status={status}
              tasks={tasksByStatus[status] || []}
              onUpdateTask={onUpdateTask}
              onDeleteTask={onDeleteTask}
              onOpenTask={setSelectedTask}
              onAddTask={handleAddTask}
            />
          ))}
        </div>

        <DragOverlay>
          {draggedTask ? (
            <TaskCard
              task={draggedTask}
              onUpdate={() => {}}
              onDelete={() => {}}
              onOpen={() => {}}
              isDragging={true}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Task Detail Modal */}
      {selectedTask && (
        <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <span>{selectedTask.title}</span>
              </DialogTitle>
            </DialogHeader>

            <Tabs defaultValue="details" className="space-y-4">
              <TabsList>
                <TabsTrigger value="details">Детали</TabsTrigger>
                <TabsTrigger value="checklist">Чек-лист</TabsTrigger>
                <TabsTrigger value="comments">Комментарии</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Описание</label>
                    <p className="text-sm mt-1">{selectedTask.description || 'Нет описания'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Оценка времени</label>
                    <p className="text-sm mt-1">{selectedTask.estimate_h} часов</p>
                  </div>
                </div>
                
                {selectedTask.labels.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Метки</label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedTask.labels.map((label, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="checklist">
                <TaskChecklist
                  checklist={selectedTask.checklist}
                  onUpdate={(checklist) => handleUpdateChecklist(selectedTask.id, checklist)}
                  taskId={selectedTask.id}
                  disabled={!canEdit}
                />
              </TabsContent>

              <TabsContent value="comments">
                <div className="text-center py-8 text-muted-foreground">
                  <p>Комментарии в разработке</p>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}

      {/* Add Task Modal */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Создать новую задачу</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Название задачи</label>
              <input
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                placeholder="Введите название задачи..."
                className="w-full mt-1 px-3 py-2 border border-border rounded-md bg-background"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Описание</label>
              <textarea
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                placeholder="Описание задачи..."
                rows={3}
                className="w-full mt-1 px-3 py-2 border border-border rounded-md bg-background"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Приоритет</label>
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as PriorityLevel })}
                  className="w-full mt-1 px-3 py-2 border border-border rounded-md bg-background"
                >
                  <option value="low">Низкий</option>
                  <option value="med">Средний</option>
                  <option value="high">Высокий</option>
                  <option value="critical">Критический</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Статус</label>
                <select
                  value={newTask.status}
                  onChange={(e) => setNewTask({ ...newTask, status: e.target.value as TaskStatus })}
                  className="w-full mt-1 px-3 py-2 border border-border rounded-md bg-background"
                >
                  <option value="backlog">Бэклог</option>
                  <option value="todo">К выполнению</option>
                  <option value="in_progress">В работе</option>
                  <option value="in_review">На проверке</option>
                  <option value="done">Выполнено</option>
                  <option value="blocked">Заблокировано</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Оценка времени (часы)</label>
              <input
                type="number"
                value={newTask.estimate_h}
                onChange={(e) => setNewTask({ ...newTask, estimate_h: parseInt(e.target.value) || 0 })}
                placeholder="0"
                className="w-full mt-1 px-3 py-2 border border-border rounded-md bg-background"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Отмена
              </Button>
              <Button onClick={handleCreateTask} disabled={!newTask.title.trim()}>
                Создать задачу
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
