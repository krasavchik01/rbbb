import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TaskManager } from "@/components/tasks/TaskManager";
import { KanbanBoard } from "@/components/tasks/KanbanBoard";
import { Task, Project as ProjectType, PriorityLevel, TaskStatus } from "@/types/project";
import { useAuth } from "@/hooks/useAuth";
import { 
  Search, 
  Filter, 
  Plus, 
  CheckSquare, 
  Clock, 
  Play, 
  Eye, 
  CheckCircle2, 
  Pause,
  AlertCircle,
  Calendar,
  User,
  Flag
} from "lucide-react";

// Демо данные для всех задач
const allTasks: Task[] = [
  {
    id: '1-1',
    project_id: '1',
    title: 'Сбор документов по налогам',
    description: 'Собрать все необходимые документы для налогового аудита',
    assignees: ['user1'],
    reporter: 'user1',
    priority: 'high' as PriorityLevel,
    status: 'in_progress' as TaskStatus,
    due_at: '2024-02-15',
    estimate_h: 16,
    spent_h: 8,
    labels: ['документы', 'налоги'],
    checklist: [
      { item: 'Получить справки из налоговой', required: true, done: true },
      { item: 'Собрать декларации за 3 года', required: true, done: true },
      { item: 'Получить выписки по счетам', required: true, done: false },
      { item: 'Проверить корректность документов', required: false, done: false }
    ],
    attachments: [],
    comments: [],
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-20T15:30:00Z'
  },
  {
    id: '1-2',
    project_id: '1',
    title: 'Анализ налоговых обязательств',
    description: 'Провести анализ правильности исчисления налогов',
    assignees: ['user2'],
    reporter: 'user1',
    priority: 'critical' as PriorityLevel,
    status: 'todo' as TaskStatus,
    due_at: '2024-02-20',
    estimate_h: 24,
    spent_h: 0,
    labels: ['анализ', 'налоги'],
    checklist: [
      { item: 'Проверить НДС', required: true, done: false },
      { item: 'Проверить налог на прибыль', required: true, done: false },
      { item: 'Проверить НДФЛ', required: true, done: false }
    ],
    attachments: [],
    comments: [],
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z'
  },
  {
    id: '2-1',
    project_id: '2',
    title: 'Проверка системы безопасности',
    description: 'Аудит системы информационной безопасности',
    assignees: ['user3'],
    reporter: 'user2',
    priority: 'high' as PriorityLevel,
    status: 'done' as TaskStatus,
    due_at: '2024-02-10',
    estimate_h: 32,
    spent_h: 32,
    labels: ['безопасность', 'IT'],
    checklist: [
      { item: 'Проверить настройки файрвола', required: true, done: true },
      { item: 'Аудит прав доступа', required: true, done: true },
      { item: 'Проверка антивирусной защиты', required: true, done: true },
      { item: 'Тестирование на проникновение', required: true, done: true }
    ],
    attachments: [],
    comments: [],
    created_at: '2024-01-10T09:00:00Z',
    updated_at: '2024-02-10T17:00:00Z'
  },
  {
    id: '3-1',
    project_id: '3',
    title: 'Планирование Due Diligence',
    description: 'Разработка плана проведения Due Diligence',
    assignees: ['user4'],
    reporter: 'user3',
    priority: 'med' as PriorityLevel,
    status: 'backlog' as TaskStatus,
    due_at: '2024-03-01',
    estimate_h: 8,
    spent_h: 0,
    labels: ['планирование', 'due-diligence'],
    checklist: [
      { item: 'Определить объем работ', required: true, done: false },
      { item: 'Составить календарный план', required: true, done: false },
      { item: 'Согласовать с клиентом', required: true, done: false }
    ],
    attachments: [],
    comments: [],
    created_at: '2024-01-20T14:00:00Z',
    updated_at: '2024-01-20T14:00:00Z'
  },
  {
    id: '4-1',
    project_id: '4',
    title: 'Анализ финансовой отчетности',
    description: 'Проведение аудита финансовой отчетности банка',
    assignees: ['user5', 'user6'],
    reporter: 'user4',
    priority: 'critical' as PriorityLevel,
    status: 'in_progress' as TaskStatus,
    due_at: '2024-03-01',
    estimate_h: 40,
    spent_h: 18,
    labels: ['финансы', 'аудит', 'банк'],
    checklist: [
      { item: 'Проверить баланс', required: true, done: true },
      { item: 'Проверить отчет о прибылях и убытках', required: true, done: true },
      { item: 'Проверить отчет о движении денежных средств', required: true, done: false },
      { item: 'Проверить примечания к отчетности', required: true, done: false }
    ],
    attachments: [],
    comments: [],
    created_at: '2024-01-25T11:00:00Z',
    updated_at: '2024-02-01T16:45:00Z'
  }
];

const projectNames: Record<string, string> = {
  '1': 'Аудит налогов ПАО "Газпром"',
  '2': 'IT-аудит безопасности Сбербанк',
  '3': 'Due Diligence ВТБ',
  '4': 'Аудит ФНО Альфа-Банк'
};

export default function Tasks() {
  const { hasRole } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [tasks, setTasks] = useState<Task[]>(allTasks);

  const canEdit = hasRole('partner');

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

  const getPriorityColor = (priority: PriorityLevel) => {
    switch (priority) {
      case 'low': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      case 'med': return 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-800 dark:text-orange-200';
      case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'backlog': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      case 'todo': return 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200';
      case 'in_review': return 'bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-200';
      case 'done': return 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200';
      case 'blocked': return 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         task.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         task.labels.some(label => label.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = filterStatus === "all" || task.status === filterStatus;
    const matchesPriority = filterPriority === "all" || task.priority === filterPriority;
    const matchesProject = filterProject === "all" || task.project_id === filterProject;
    
    return matchesSearch && matchesStatus && matchesPriority && matchesProject;
  });

  const handleUpdateTask = (taskId: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId ? { ...task, ...updates } : task
    ));
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
  };

  const handleAddTask = (task: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => {
    const newTask: Task = {
      ...task,
      id: `task-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setTasks(prev => [...prev, newTask]);
  };

  const tasksByStatus = filteredTasks.reduce((acc, task) => {
    if (!acc[task.status]) acc[task.status] = [];
    acc[task.status].push(task);
    return acc;
  }, {} as Record<TaskStatus, Task[]>);

  const statusOrder: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'in_review', 'done', 'blocked'];

  const getTaskStats = () => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'done').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const overdue = tasks.filter(t => t.due_at && new Date(t.due_at) < new Date() && t.status !== 'done').length;
    
    return { total, completed, inProgress, overdue };
  };

  const stats = getTaskStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Задачи</h1>
          <p className="text-muted-foreground">Управление задачами и чек-листами</p>
        </div>
        {canEdit && (
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Создать задачу
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <CheckSquare className="w-5 h-5 text-primary" />
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-sm text-muted-foreground">Всего задач</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{stats.completed}</p>
              <p className="text-sm text-muted-foreground">Выполнено</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <Play className="w-5 h-5 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold">{stats.inProgress}</p>
              <p className="text-sm text-muted-foreground">В работе</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <div>
              <p className="text-2xl font-bold">{stats.overdue}</p>
              <p className="text-sm text-muted-foreground">Просрочено</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Поиск задач..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все статусы</SelectItem>
              <SelectItem value="backlog">Бэклог</SelectItem>
              <SelectItem value="todo">К выполнению</SelectItem>
              <SelectItem value="in_progress">В работе</SelectItem>
              <SelectItem value="in_review">На проверке</SelectItem>
              <SelectItem value="done">Выполнено</SelectItem>
              <SelectItem value="blocked">Заблокировано</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Приоритет" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все приоритеты</SelectItem>
              <SelectItem value="low">Низкий</SelectItem>
              <SelectItem value="med">Средний</SelectItem>
              <SelectItem value="high">Высокий</SelectItem>
              <SelectItem value="critical">Критический</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Проект" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все проекты</SelectItem>
              {Object.entries(projectNames).map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Kanban Board */}
      <Tabs defaultValue="kanban" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="list">Список</TabsTrigger>
          <TabsTrigger value="calendar">Календарь</TabsTrigger>
        </TabsList>

        <TabsContent value="kanban">
          <KanbanBoard
            project={{
              id: 'all-tasks',
              code: 'ALL',
              name: 'Все задачи',
              company_id: '1',
              status: 'in_progress' as any,
              risk_level: 'med' as any,
              description: 'Все задачи системы',
              tags: [],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              completion_percentage: 0
            }}
            tasks={filteredTasks}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
            onAddTask={handleAddTask}
          />
        </TabsContent>

        <TabsContent value="list">
          <div className="space-y-4">
            {filteredTasks.map((task) => (
              <Card key={task.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      {getStatusIcon(task.status)}
                      <h3 className="font-semibold">{task.title}</h3>
                      <Badge className={`text-xs ${getStatusColor(task.status)}`}>
                        {task.status === 'backlog' ? 'Бэклог' :
                         task.status === 'todo' ? 'К выполнению' :
                         task.status === 'in_progress' ? 'В работе' :
                         task.status === 'in_review' ? 'На проверке' :
                         task.status === 'done' ? 'Выполнено' :
                         task.status === 'blocked' ? 'Заблокировано' : task.status}
                      </Badge>
                      <Badge className={`text-xs ${getPriorityColor(task.priority)}`}>
                        {task.priority === 'low' ? 'Низкий' :
                         task.priority === 'med' ? 'Средний' :
                         task.priority === 'high' ? 'Высокий' :
                         task.priority === 'critical' ? 'Критический' : task.priority}
                      </Badge>
                    </div>
                    
                    {task.description && (
                      <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
                    )}
                    
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <Flag className="w-4 h-4" />
                        <span>{projectNames[task.project_id]}</span>
                      </div>
                      {task.due_at && (
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-4 h-4" />
                          <span>{new Date(task.due_at).toLocaleDateString('ru-RU')}</span>
                        </div>
                      )}
                      {task.estimate_h > 0 && (
                        <div className="flex items-center space-x-1">
                          <Clock className="w-4 h-4" />
                          <span>{task.estimate_h}ч</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {canEdit && (
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateTask(task.id, { 
                          status: task.status === 'done' ? 'todo' : 'done' 
                        })}
                      >
                        {task.status === 'done' ? 'Отменить' : 'Выполнить'}
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="calendar">
          <Card className="p-8 text-center">
            <h3 className="text-lg font-semibold mb-2">Календарь задач</h3>
            <p className="text-muted-foreground">
              Календарный вид задач будет доступен в следующих версиях
            </p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
