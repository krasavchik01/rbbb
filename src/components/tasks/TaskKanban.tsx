import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { 
  Clock, 
  AlertTriangle, 
  MessageSquare, 
  Paperclip,
  CheckSquare,
  User
} from "lucide-react";
import { Task, TaskStatus, TASK_STATUS_LABELS, PRIORITY_LABELS } from "@/types/project";
import { format } from "date-fns";

interface TaskKanbanProps {
  tasks: Task[];
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onTaskClick: (task: Task) => void;
}

export function TaskKanban({ tasks, onTaskUpdate, onTaskClick }: TaskKanbanProps) {
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  const columns: { status: TaskStatus; label: string; color: string }[] = [
    { status: 'backlog', label: 'Бэклог', color: 'bg-muted' },
    { status: 'todo', label: 'К выполнению', color: 'bg-blue-100' },
    { status: 'in_progress', label: 'В работе', color: 'bg-yellow-100' },
    { status: 'in_review', label: 'На проверке', color: 'bg-orange-100' },
    { status: 'done', label: 'Выполнено', color: 'bg-green-100' },
    { status: 'blocked', label: 'Заблокировано', color: 'bg-red-100' }
  ];

  const getTasksByStatus = (status: TaskStatus) => {
    return tasks.filter(task => task.status === status);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-500 text-white';
      case 'high':
        return 'bg-orange-500 text-white';
      case 'med':
        return 'bg-yellow-500 text-white';
      case 'low':
        return 'bg-green-500 text-white';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    try {
      return format(new Date(dateString), 'dd.MM');
    } catch {
      return null;
    }
  };

  const isOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const handleDragStart = (task: Task) => {
    setDraggedTask(task);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, newStatus: TaskStatus) => {
    e.preventDefault();
    if (draggedTask && draggedTask.status !== newStatus) {
      // Валидация переходов
      if (draggedTask.status === 'blocked' && newStatus === 'done') {
        return; // Нельзя перевести заблокированную задачу в выполненную
      }
      
      if (newStatus === 'done' && draggedTask.checklist.some(item => item.required && !item.done)) {
        return; // Нельзя завершить задачу с невыполненными обязательными пунктами
      }

      onTaskUpdate(draggedTask.id, { status: newStatus });
    }
    setDraggedTask(null);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((column) => {
        const columnTasks = getTasksByStatus(column.status);
        
        return (
          <div 
            key={column.status} 
            className="flex-shrink-0 w-80"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.status)}
          >
            <div className={`${column.color} rounded-lg p-3 mb-4`}>
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm">{column.label}</h3>
                <Badge variant="secondary" className="text-xs">
                  {columnTasks.length}
                </Badge>
              </div>
            </div>
            
            <div className="space-y-3 min-h-20">
              {columnTasks.map((task) => (
                <Card
                  key={task.id}
                  className="p-4 hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
                  draggable
                  onDragStart={() => handleDragStart(task)}
                  onClick={() => onTaskClick(task)}
                >
                  {/* Заголовок и приоритет */}
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="font-medium text-sm leading-tight flex-1 mr-2">
                      {task.title}
                    </h4>
                    <Badge className={`${getPriorityColor(task.priority)} text-xs`}>
                      {PRIORITY_LABELS[task.priority]}
                    </Badge>
                  </div>

                  {/* Описание */}
                  {task.description && (
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                      {task.description}
                    </p>
                  )}

                  {/* Метрики и иконки */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {task.comments.length > 0 && (
                        <div className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          <span>{task.comments.length}</span>
                        </div>
                      )}
                      {task.attachments.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Paperclip className="w-3 h-3" />
                          <span>{task.attachments.length}</span>
                        </div>
                      )}
                      {task.checklist.length > 0 && (
                        <div className="flex items-center gap-1">
                          <CheckSquare className="w-3 h-3" />
                          <span>
                            {task.checklist.filter(item => item.done).length}/{task.checklist.length}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {task.due_at && (
                      <div className={`flex items-center gap-1 text-xs ${
                        isOverdue(task.due_at) ? 'text-destructive' : 'text-muted-foreground'
                      }`}>
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(task.due_at)}</span>
                        {isOverdue(task.due_at) && (
                          <AlertTriangle className="w-3 h-3" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Время */}
                  {(task.estimate_h || task.spent_h > 0) && (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Время</span>
                        <span>
                          {task.spent_h || 0}ч
                          {task.estimate_h && ` / ${task.estimate_h}ч`}
                        </span>
                      </div>
                      {task.estimate_h && (
                        <div className="w-full bg-muted rounded-full h-1 mt-1">
                          <div 
                            className="bg-primary h-1 rounded-full"
                            style={{ 
                              width: `${Math.min((task.spent_h / task.estimate_h) * 100, 100)}%` 
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Исполнители */}
                  {task.assignee_employees && task.assignee_employees.length > 0 && (
                    <div className="flex items-center gap-2">
                      <User className="w-3 h-3 text-muted-foreground" />
                      <div className="flex -space-x-1">
                        {task.assignee_employees.slice(0, 3).map((assignee, index) => (
                          <Avatar key={assignee.id} className="w-6 h-6 border-2 border-background">
                            <AvatarFallback className="text-xs">
                              {getInitials(assignee.full_name || assignee.name)}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        {task.assignee_employees.length > 3 && (
                          <div className="w-6 h-6 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                            <span className="text-xs">+{task.assignee_employees.length - 3}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Лейблы */}
                  {task.labels.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {task.labels.slice(0, 3).map((label) => (
                        <Badge key={label} variant="outline" className="text-xs">
                          {label}
                        </Badge>
                      ))}
                      {task.labels.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{task.labels.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}