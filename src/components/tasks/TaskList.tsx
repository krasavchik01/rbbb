import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Search, 
  Filter, 
  Clock, 
  AlertTriangle,
  MessageSquare,
  Paperclip,
  CheckSquare,
  MoreHorizontal
} from "lucide-react";
import { Task, TaskStatus, PriorityLevel, TASK_STATUS_LABELS, PRIORITY_LABELS } from "@/types/project";
import { format } from "date-fns";

interface TaskListProps {
  tasks: Task[];
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onTaskClick: (task: Task) => void;
  onBulkUpdate: (taskIds: string[], updates: Partial<Task>) => void;
}

export function TaskList({ tasks, onTaskUpdate, onTaskClick, onBulkUpdate }: TaskListProps) {
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         task.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;
    const matchesAssignee = assigneeFilter === "all" || 
                           task.assignees.includes(assigneeFilter);
    
    return matchesSearch && matchesStatus && matchesPriority && matchesAssignee;
  });

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'backlog':
        return 'bg-muted text-muted-foreground';
      case 'todo':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'in_review':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'done':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'blocked':
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

  const isOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTasks(filteredTasks.map(task => task.id));
    } else {
      setSelectedTasks([]);
    }
  };

  const handleSelectTask = (taskId: string, checked: boolean) => {
    if (checked) {
      setSelectedTasks([...selectedTasks, taskId]);
    } else {
      setSelectedTasks(selectedTasks.filter(id => id !== taskId));
    }
  };

  const handleBulkStatusChange = (newStatus: TaskStatus) => {
    onBulkUpdate(selectedTasks, { status: newStatus });
    setSelectedTasks([]);
  };

  const handleBulkPriorityChange = (newPriority: PriorityLevel) => {
    onBulkUpdate(selectedTasks, { priority: newPriority });
    setSelectedTasks([]);
  };

  // Получаем уникальных исполнителей для фильтра
  const allAssignees = Array.from(new Set(
    tasks.flatMap(task => task.assignee_employees || [])
      .map(assignee => assignee.id)
  ));

  return (
    <div className="space-y-4">
      {/* Фильтры */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск задач..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все статусы</SelectItem>
              {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Приоритет" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все приоритеты</SelectItem>
              {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Массовые операции */}
      {selectedTasks.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
          <span className="text-sm">Выбрано: {selectedTasks.length}</span>
          
          <Select onValueChange={(value) => handleBulkStatusChange(value as TaskStatus)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Изменить статус" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select onValueChange={(value) => handleBulkPriorityChange(value as PriorityLevel)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Изменить приоритет" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setSelectedTasks([])}
          >
            Отменить
          </Button>
        </div>
      )}

      {/* Таблица */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox 
                  checked={selectedTasks.length === filteredTasks.length && filteredTasks.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>Задача</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Приоритет</TableHead>
              <TableHead>Исполнители</TableHead>
              <TableHead>Срок</TableHead>
              <TableHead>Время</TableHead>
              <TableHead>Прогресс</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTasks.map((task) => (
              <TableRow 
                key={task.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onTaskClick(task)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox 
                    checked={selectedTasks.includes(task.id)}
                    onCheckedChange={(checked) => handleSelectTask(task.id, checked as boolean)}
                  />
                </TableCell>
                
                <TableCell>
                  <div>
                    <div className="font-medium">{task.title}</div>
                    {task.description && (
                      <div className="text-sm text-muted-foreground line-clamp-1">
                        {task.description}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      {task.comments.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MessageSquare className="w-3 h-3" />
                          <span>{task.comments.length}</span>
                        </div>
                      )}
                      {task.attachments.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Paperclip className="w-3 h-3" />
                          <span>{task.attachments.length}</span>
                        </div>
                      )}
                      {task.checklist.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <CheckSquare className="w-3 h-3" />
                          <span>
                            {task.checklist.filter(item => item.done).length}/{task.checklist.length}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                
                <TableCell>
                  <Badge className={getStatusColor(task.status)}>
                    {TASK_STATUS_LABELS[task.status]}
                  </Badge>
                </TableCell>
                
                <TableCell>
                  <Badge className={getPriorityColor(task.priority)}>
                    {PRIORITY_LABELS[task.priority]}
                  </Badge>
                </TableCell>
                
                <TableCell>
                  {task.assignee_employees && task.assignee_employees.length > 0 && (
                    <div className="flex -space-x-1">
                      {task.assignee_employees.slice(0, 3).map((assignee) => (
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
                  )}
                </TableCell>
                
                <TableCell>
                  {task.due_at && (
                    <div className={`flex items-center gap-1 ${
                      isOverdue(task.due_at) ? 'text-destructive' : ''
                    }`}>
                      <span className="text-sm">{formatDate(task.due_at)}</span>
                      {isOverdue(task.due_at) && (
                        <AlertTriangle className="w-4 h-4" />
                      )}
                    </div>
                  )}
                </TableCell>
                
                <TableCell>
                  <div className="text-sm">
                    {task.spent_h || 0}ч
                    {task.estimate_h && ` / ${task.estimate_h}ч`}
                  </div>
                </TableCell>
                
                <TableCell>
                  {task.checklist.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-muted rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full"
                          style={{ 
                            width: `${(task.checklist.filter(item => item.done).length / task.checklist.length) * 100}%` 
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {Math.round((task.checklist.filter(item => item.done).length / task.checklist.length) * 100)}%
                      </span>
                    </div>
                  )}
                </TableCell>
                
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}