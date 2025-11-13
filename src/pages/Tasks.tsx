import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProjects } from '@/hooks/useProjects-simple';
import { useEmployees } from '@/hooks/useSupabaseData';
import { useAuth } from '@/contexts/AuthContext';
import { 
  CheckSquare,
  Search,
  Filter,
  Clock,
  User,
  AlertCircle,
  CheckCircle2,
  Circle,
  XCircle,
  Flag,
  Briefcase
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export default function Tasks() {
  const { user } = useAuth();
  const { projects = [] } = useProjects();
  const { employees = [] } = useEmployees();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'todo' | 'in_progress' | 'done'>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | 'low' | 'med' | 'high'>('all');
  const [selectedProject, setSelectedProject] = useState<string>('all');

  // Получаем все задачи из проектов
  const allTasks = useMemo(() => {
    const tasks: Array<{
      id: string;
      projectId: string;
      projectName: string;
      title: string;
      description?: string;
      status: string;
      priority: string;
      assignees: string[];
      assigneeNames: string[];
      reporter?: string;
      reporterName?: string;
      dueDate?: string;
      estimateHours?: number;
      spentHours?: number;
      created_at: string;
    }> = [];

    projects.forEach((project: any) => {
      if (project.tasks && Array.isArray(project.tasks)) {
        project.tasks.forEach((task: any) => {
          const assigneeNames = (task.assignees || []).map((id: string) => {
            const emp = employees.find((e: any) => e.id === id);
            return emp?.name || `Сотрудник ${id}`;
          });
          
          const reporter = task.reporter ? employees.find((e: any) => e.id === task.reporter) : null;

          tasks.push({
            id: task.id || `${project.id}-${task.title}`,
            projectId: project.id,
            projectName: project.name || project.title || 'Без названия',
            title: task.title || 'Без названия',
            description: task.description,
            status: task.status || 'todo',
            priority: task.priority || 'med',
            assignees: task.assignees || [],
            assigneeNames,
            reporter: task.reporter,
            reporterName: reporter?.name,
            dueDate: task.due_at || task.dueDate,
            estimateHours: task.estimate_h || task.estimateHours,
            spentHours: task.spent_h || task.spentHours || 0,
            created_at: task.created_at || project.created_at
          });
        });
      }
    });

    return tasks;
  }, [projects, employees]);

  // Фильтрация задач
  const filteredTasks = useMemo(() => {
    return allTasks.filter(task => {
      const matchesSearch = 
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.assigneeNames.some(name => name.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
      const matchesPriority = filterPriority === 'all' || task.priority === filterPriority;
      const matchesProject = selectedProject === 'all' || task.projectId === selectedProject;

      return matchesSearch && matchesStatus && matchesPriority && matchesProject;
    });
  }, [allTasks, searchTerm, filterStatus, filterPriority, selectedProject]);

  // Группировка по статусам
  const tasksByStatus = useMemo(() => {
    return {
      todo: filteredTasks.filter(t => t.status === 'todo'),
      in_progress: filteredTasks.filter(t => t.status === 'in_progress'),
      done: filteredTasks.filter(t => t.status === 'done' || t.status === 'completed')
    };
  }, [filteredTasks]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'done':
      case 'completed':
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Выполнено</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-500"><Clock className="w-3 h-3 mr-1" />В работе</Badge>;
      case 'todo':
        return <Badge variant="outline"><Circle className="w-3 h-3 mr-1" />К выполнению</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge variant="destructive"><Flag className="w-3 h-3 mr-1" />Высокий</Badge>;
      case 'med':
        return <Badge className="bg-yellow-500"><Flag className="w-3 h-3 mr-1" />Средний</Badge>;
      case 'low':
        return <Badge className="bg-gray-500"><Flag className="w-3 h-3 mr-1" />Низкий</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  // Статистика
  const stats = useMemo(() => {
    return {
      total: allTasks.length,
      todo: allTasks.filter(t => t.status === 'todo').length,
      inProgress: allTasks.filter(t => t.status === 'in_progress').length,
      done: allTasks.filter(t => t.status === 'done' || t.status === 'completed').length,
      myTasks: allTasks.filter(t => t.assignees.includes(user?.id || '')).length
    };
  }, [allTasks, user]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <CheckSquare className="w-8 h-8" />
          Задачи
        </h1>
        <p className="text-muted-foreground mt-2">Управление задачами и проектами</p>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Всего задач</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <CheckSquare className="w-8 h-8 text-primary" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">К выполнению</p>
              <p className="text-2xl font-bold">{stats.todo}</p>
            </div>
            <Circle className="w-8 h-8 text-gray-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">В работе</p>
              <p className="text-2xl font-bold">{stats.inProgress}</p>
            </div>
            <Clock className="w-8 h-8 text-blue-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Выполнено</p>
              <p className="text-2xl font-bold">{stats.done}</p>
            </div>
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Мои задачи</p>
              <p className="text-2xl font-bold">{stats.myTasks}</p>
            </div>
            <User className="w-8 h-8 text-purple-500" />
          </div>
        </Card>
      </div>

      {/* Фильтры */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Поиск задач..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-3 py-2 border rounded-md bg-background"
          >
            <option value="all">Все статусы</option>
            <option value="todo">К выполнению</option>
            <option value="in_progress">В работе</option>
            <option value="done">Выполнено</option>
          </select>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value as any)}
            className="px-3 py-2 border rounded-md bg-background"
          >
            <option value="all">Все приоритеты</option>
            <option value="high">Высокий</option>
            <option value="med">Средний</option>
            <option value="low">Низкий</option>
          </select>
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="px-3 py-2 border rounded-md bg-background"
          >
            <option value="all">Все проекты</option>
            {projects.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.name || p.title || 'Без названия'}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">Список</TabsTrigger>
          <TabsTrigger value="kanban">Канбан</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          {filteredTasks.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">Задачи не найдены</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredTasks.map((task) => (
                <Card key={task.id} className="p-4 hover:bg-secondary/50 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="font-semibold">{task.title}</h3>
                        {getStatusBadge(task.status)}
                        {getPriorityBadge(task.priority)}
                      </div>
                      {task.description && (
                        <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
                      )}
                      <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Briefcase className="w-3 h-3" />
                          <span>{task.projectName}</span>
                        </div>
                        {task.assigneeNames.length > 0 && (
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <span>{task.assigneeNames.join(', ')}</span>
                          </div>
                        )}
                        {task.dueDate && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{format(new Date(task.dueDate), 'dd MMM yyyy', { locale: ru })}</span>
                          </div>
                        )}
                        {task.estimateHours && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>Оценка: {task.estimateHours}ч</span>
                            {task.spentHours > 0 && (
                              <span> / Потрачено: {task.spentHours}ч</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="kanban" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* К выполнению */}
            <div>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Circle className="w-4 h-4" />
                К выполнению ({tasksByStatus.todo.length})
              </h3>
              <div className="space-y-2">
                {tasksByStatus.todo.map((task) => (
                  <Card key={task.id} className="p-3 hover:bg-secondary/50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-sm flex-1">{task.title}</h4>
                      {getPriorityBadge(task.priority)}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{task.projectName}</p>
                    {task.assigneeNames.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="w-3 h-3" />
                        <span>{task.assigneeNames.join(', ')}</span>
                      </div>
                    )}
                  </Card>
                ))}
                {tasksByStatus.todo.length === 0 && (
                  <Card className="p-4 text-center text-sm text-muted-foreground">
                    Нет задач
                  </Card>
                )}
              </div>
            </div>

            {/* В работе */}
            <div>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                В работе ({tasksByStatus.in_progress.length})
              </h3>
              <div className="space-y-2">
                {tasksByStatus.in_progress.map((task) => (
                  <Card key={task.id} className="p-3 hover:bg-secondary/50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-sm flex-1">{task.title}</h4>
                      {getPriorityBadge(task.priority)}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{task.projectName}</p>
                    {task.assigneeNames.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="w-3 h-3" />
                        <span>{task.assigneeNames.join(', ')}</span>
                      </div>
                    )}
                  </Card>
                ))}
                {tasksByStatus.in_progress.length === 0 && (
                  <Card className="p-4 text-center text-sm text-muted-foreground">
                    Нет задач
                  </Card>
                )}
              </div>
            </div>

            {/* Выполнено */}
            <div>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Выполнено ({tasksByStatus.done.length})
              </h3>
              <div className="space-y-2">
                {tasksByStatus.done.map((task) => (
                  <Card key={task.id} className="p-3 hover:bg-secondary/50 transition-colors opacity-75">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-sm flex-1 line-through">{task.title}</h4>
                      {getPriorityBadge(task.priority)}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{task.projectName}</p>
                    {task.assigneeNames.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="w-3 h-3" />
                        <span>{task.assigneeNames.join(', ')}</span>
                      </div>
                    )}
                  </Card>
                ))}
                {tasksByStatus.done.length === 0 && (
                  <Card className="p-4 text-center text-sm text-muted-foreground">
                    Нет задач
                  </Card>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
