import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TaskChecklist } from "./TaskChecklist";
import { KanbanBoard } from "./KanbanBoard";
import { Task, TaskStatus, PriorityLevel, ChecklistItem, Project } from "@/types/project";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Calendar, 
  User, 
  Flag, 
  Clock, 
  CheckCircle2,
  AlertCircle,
  Play,
  Pause,
  Eye,
  MoreHorizontal
} from "lucide-react";

interface TaskManagerProps {
  project: Project;
  tasks: Task[];
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onDeleteTask: (taskId: string) => void;
  onAddTask: (task: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => void;
}

export function TaskManager({ 
  project, 
  tasks, 
  onUpdateTask, 
  onDeleteTask, 
  onAddTask 
}: TaskManagerProps) {
  const { hasRole, user } = useAuth();
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

  const canEdit = hasRole('partner') || hasRole('admin');
  const canView = true; // Все роли могут просматривать


  const handleAddTask = () => {
    if (!newTask.title.trim()) return;

    const task: Omit<Task, 'id' | 'created_at' | 'updated_at'> = {
      project_id: project.id,
      title: newTask.title.trim(),
      description: newTask.description.trim(),
      assignees: newTask.assignees,
      reporter: user?.id || '',
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

  const handleStatusChange = (taskId: string, status: TaskStatus) => {
    if (!canEdit) return;
    onUpdateTask(taskId, { status });
  };

  const handlePriorityChange = (taskId: string, priority: PriorityLevel) => {
    if (!canEdit) return;
    onUpdateTask(taskId, { priority });
  };


  if (!canView) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground">У вас нет прав для просмотра задач</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Задачи проекта</h3>
          <p className="text-sm text-muted-foreground">
            {tasks.length} задач • {tasks.filter(t => t.status === 'done').length} выполнено
          </p>
        </div>
        {canEdit && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Добавить задачу
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Создать новую задачу</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Название задачи</label>
                  <Input
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    placeholder="Введите название задачи..."
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Описание</label>
                  <Textarea
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    placeholder="Описание задачи..."
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Приоритет</label>
                    <Select
                      value={newTask.priority}
                      onValueChange={(value: PriorityLevel) => setNewTask({ ...newTask, priority: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Низкий</SelectItem>
                        <SelectItem value="med">Средний</SelectItem>
                        <SelectItem value="high">Высокий</SelectItem>
                        <SelectItem value="critical">Критический</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Статус</label>
                    <Select
                      value={newTask.status}
                      onValueChange={(value: TaskStatus) => setNewTask({ ...newTask, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="backlog">Бэклог</SelectItem>
                        <SelectItem value="todo">К выполнению</SelectItem>
                        <SelectItem value="in_progress">В работе</SelectItem>
                        <SelectItem value="in_review">На проверке</SelectItem>
                        <SelectItem value="done">Выполнено</SelectItem>
                        <SelectItem value="blocked">Заблокировано</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Оценка времени (часы)</label>
                  <Input
                    type="number"
                    value={newTask.estimate_h}
                    onChange={(e) => setNewTask({ ...newTask, estimate_h: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Отмена
                  </Button>
                  <Button onClick={handleAddTask} disabled={!newTask.title.trim()}>
                    Создать задачу
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Kanban Board */}
      <KanbanBoard
        project={project}
        tasks={tasks}
        onUpdateTask={onUpdateTask}
        onDeleteTask={onDeleteTask}
        onAddTask={onAddTask}
      />

      {/* Task Detail Modal */}
      {selectedTask && (
        <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <span>{selectedTask.title}</span>
                {canEdit && (
                  <div className="flex items-center space-x-2">
                    <Select
                      value={selectedTask.status}
                      onValueChange={(value: TaskStatus) => handleStatusChange(selectedTask.id, value)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="backlog">Бэклог</SelectItem>
                        <SelectItem value="todo">К выполнению</SelectItem>
                        <SelectItem value="in_progress">В работе</SelectItem>
                        <SelectItem value="in_review">На проверке</SelectItem>
                        <SelectItem value="done">Выполнено</SelectItem>
                        <SelectItem value="blocked">Заблокировано</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={selectedTask.priority}
                      onValueChange={(value: PriorityLevel) => handlePriorityChange(selectedTask.id, value)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Низкий</SelectItem>
                        <SelectItem value="med">Средний</SelectItem>
                        <SelectItem value="high">Высокий</SelectItem>
                        <SelectItem value="critical">Критический</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
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
    </div>
  );
}
