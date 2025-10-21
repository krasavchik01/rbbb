import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TaskManager } from "@/components/tasks/TaskManager";
import { Task, Project as ProjectType, ChecklistItem, PriorityLevel, TaskStatus } from "@/types/project";
import { Plus, Search, Calendar, Users, ArrowRight, CheckSquare, Clock, CheckCircle, Circle, AlertCircle, XCircle, FileText, BarChart3 } from "lucide-react";
import { useProjects } from "@/hooks/useSupabaseData";
import { supabaseDataStore } from "@/lib/supabaseDataStore";

// Простые типы
interface SimpleProject {
  id: string;
  name: string;
  status: string;
  completion: number;
  team: number;
  deadline: string;
  company: string;
  tasks?: Task[];
}

// ВСЕ ДЕМО-ПРОЕКТЫ УДАЛЕНЫ - используем только реальные данные из Supabase
const demoProjects: SimpleProject[] = [];

export default function Projects() {
  const { projects: realProjects, loading } = useProjects();
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredProjects, setFilteredProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const navigate = useNavigate();
  const [newProject, setNewProject] = useState({
    name: "",
    company: "",
    deadline: "",
    status: "Черновик",
    budget: ""
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Загружаем реальные проекты при монтировании
  useEffect(() => {
    console.log('📦 Загружены проекты:', realProjects.length);
    setFilteredProjects(realProjects);
  }, [realProjects]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'В работе': return 'bg-blue-500';
      case 'На проверке': return 'bg-yellow-500';
      case 'Черновик': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  // Функции для управления задачами
  const handleUpdateTask = (projectId: string, taskId: string, updates: Partial<Task>) => {
    setFilteredProjects(prev => prev.map(project => {
      if (project.id === projectId) {
        return {
          ...project,
          tasks: project.tasks?.map(task => 
            task.id === taskId ? { ...task, ...updates } : task
          ) || []
        };
      }
      return project;
    }));
  };

  const handleDeleteTask = (projectId: string, taskId: string) => {
    setFilteredProjects(prev => prev.map(project => {
      if (project.id === projectId) {
        return {
          ...project,
          tasks: project.tasks?.filter(task => task.id !== taskId) || []
        };
      }
      return project;
    }));
  };

  const handleAddTask = (projectId: string, task: Omit<Task, 'id' | 'created_at' | 'updated_at'>) => {
    const newTask: Task = {
      ...task,
      id: `${projectId}-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    setFilteredProjects(prev => prev.map(project => {
      if (project.id === projectId) {
        return {
          ...project,
          tasks: [...(project.tasks || []), newTask]
        };
      }
      return project;
    }));
  };

  const getProjectTasks = (project: SimpleProject): Task[] => {
    return project.tasks || [];
  };

  const getProjectStats = (project: SimpleProject) => {
    const tasks = getProjectTasks(project);
    const completedTasks = tasks.filter(task => task.status === 'done').length;
    const totalTasks = tasks.length;
    const checklistProgress = tasks.reduce((acc, task) => {
      const completed = task.checklist.filter(item => item.done).length;
      const total = task.checklist.length;
      return acc + (total > 0 ? completed / total : 0);
    }, 0) / Math.max(totalTasks, 1);
    
    return {
      totalTasks,
      completedTasks,
      checklistProgress: Math.round(checklistProgress * 100)
    };
  };

  const ProjectCard = ({ project }: { project: any }) => {
    const projectName = project.name || project.client?.name || 'Без названия';
    const projectStatus = project.status || 'new';
    const projectCompany = project.companyName || project.company || project.ourCompany || 'Не указана';
    const projectCompletion = project.completionPercent || project.completion || 0;
    const projectDeadline = project.contract?.serviceEndDate || project.deadline || new Date().toISOString();
    const projectTeam = project.team?.length || 1;
    
    const stats = getProjectStats(project);
    
    return (
      <Card className="p-6 hover:shadow-lg transition-all duration-200 border glass-card cursor-pointer"
            onClick={() => navigate(`/project-approval`)}>
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-2 line-clamp-2">{projectName}</h3>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Badge variant="secondary" className={`text-white ${getStatusColor(projectStatus)}`}>
                {projectStatus === 'new' ? 'Новый' : projectStatus}
              </Badge>
              <span className="text-sm text-muted-foreground">{projectCompany}</span>
            </div>
            {project.client?.name && (
              <p className="text-xs text-muted-foreground mb-2">Клиент: {project.client.name}</p>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Прогресс</span>
              <span>{projectCompletion}%</span>
            </div>
            <Progress value={projectCompletion} className="h-2" />
          </div>

          {/* Task Stats */}
          {stats.totalTasks > 0 && (
            <div className="grid grid-cols-2 gap-4 p-3 bg-secondary/10 rounded-lg">
              <div className="text-center">
                <div className="flex items-center justify-center space-x-1 text-sm text-muted-foreground">
                  <CheckSquare className="w-4 h-4" />
                  <span>Задачи</span>
                </div>
                <div className="text-lg font-semibold">
                  {stats.completedTasks}/{stats.totalTasks}
                </div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center space-x-1 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>Чек-лист</span>
                </div>
                <div className="text-lg font-semibold">
                  {stats.checklistProgress}%
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>{projectTeam} участников</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span>{new Date(projectDeadline).toLocaleDateString('ru-RU')}</span>
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setSelectedProject(project)}
            >
              <CheckSquare className="w-4 h-4 mr-1" />
              Задачи
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate(`/projects/${project.id}`, { state: { project } })}
            >
              <ArrowRight className="w-4 h-4 mr-1" />
              Открыть
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Проекты</h1>
          <p className="text-muted-foreground">Управление проектами и задачами</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="btn-gradient">
              <Plus className="w-4 h-4 mr-2" />
              Создать проект
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Создать новый проект</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Название
                </Label>
                <Input
                  id="name"
                  value={newProject.name}
                  onChange={(e) => setNewProject({...newProject, name: e.target.value})}
                  className="col-span-3"
                  placeholder="Введите название проекта"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="company" className="text-right">
                  Компания
                </Label>
                <Select value={newProject.company} onValueChange={(value) => setNewProject({...newProject, company: value})}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Выберите компанию" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RB Partners Tax Audit">RB Partners Tax Audit</SelectItem>
                    <SelectItem value="Russell Bedford IT Audit">Russell Bedford IT Audit</SelectItem>
                    <SelectItem value="Parker Russell Due Diligence">Parker Russell Due Diligence</SelectItem>
                    <SelectItem value="RB Partners FNO Audit">RB Partners FNO Audit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="deadline" className="text-right">
                  Срок
                </Label>
                <Input
                  id="deadline"
                  type="date"
                  value={newProject.deadline}
                  onChange={(e) => setNewProject({...newProject, deadline: e.target.value})}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="budget" className="text-right">
                  Бюджет
                </Label>
                <Input
                  id="budget"
                  type="number"
                  value={newProject.budget}
                  onChange={(e) => setNewProject({...newProject, budget: e.target.value})}
                  className="col-span-3"
                  placeholder="Введите бюджет проекта"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status" className="text-right">
                  Статус
                </Label>
                <Select value={newProject.status} onValueChange={(value) => setNewProject({...newProject, status: value})}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Черновик">Черновик</SelectItem>
                    <SelectItem value="В работе">В работе</SelectItem>
                    <SelectItem value="На проверке">На проверке</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Отмена
              </Button>
              <Button 
                className="btn-gradient"
                onClick={() => {
                  if (newProject.name && newProject.company && newProject.deadline) {
                    const project: SimpleProject = {
                      id: String(Date.now()),
                      name: newProject.name,
                      company: newProject.company,
                      deadline: newProject.deadline,
                      status: newProject.status,
                      completion: 0,
                      team: 1
                    };
                    setFilteredProjects([...filteredProjects, project]);
                    setNewProject({ name: "", company: "", deadline: "", status: "Черновик", budget: "" });
                    setIsDialogOpen(false);
                  }
                }}
              >
                Создать
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Фильтры */}
      <Card className="p-4 glass-card">
        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Поиск проектов..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline">
            Все проекты
          </Button>
          <Button variant="outline">
            В работе
          </Button>
          <Button variant="outline">
            На проверке
          </Button>
        </div>
      </Card>

      {/* Контент */}
      <Tabs defaultValue="summary" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="list">Список</TabsTrigger>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="gantt">Gantt</TabsTrigger>
          <TabsTrigger value="summary">Свод</TabsTrigger>
          <TabsTrigger value="reports">Отчёты</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="kanban" className="space-y-4">
          <Card className="p-8 text-center glass-card">
            <h3 className="text-lg font-semibold mb-2">Kanban доска</h3>
            <p className="text-muted-foreground">
              Kanban доска для управления задачами будет доступна после настройки базы данных
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="gantt" className="space-y-4">
          <Card className="p-8 text-center glass-card">
            <h3 className="text-lg font-semibold mb-2">Диаграмма Gantt</h3>
            <p className="text-muted-foreground">
              Диаграмма Gantt для планирования проектов будет доступна после настройки базы данных
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="space-y-4">
          <Card className="glass-card">
            <div className="p-4 border-b border-border">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">📊 Свод по проектам</h3>
                  <p className="text-sm text-muted-foreground">Детальная информация о всех проектах и их задачах</p>
                </div>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">📋 Проект</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">🏢 Компания</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">📊 Статус</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">📈 Прогресс</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">✅ Задачи</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">📝 Чек-лист</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">👥 Команда</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">📅 Дедлайн</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">⚡ Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredProjects.map((project) => {
                    const stats = getProjectStats(project);
                    const tasks = getProjectTasks(project);
                    
                    return (
                      <tr key={project.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="px-3 py-3">
                          <div className="flex items-center space-x-2">
                            <div className="w-6 h-6 bg-gradient-to-r from-primary to-secondary rounded flex items-center justify-center text-xs">
                              📄
                            </div>
                            <div>
                              <div className="font-medium text-xs">{project.name}</div>
                              <div className="text-xs text-muted-foreground">#{project.id}</div>
                            </div>
                          </div>
                        </td>
                        
                        <td className="px-3 py-3">
                          <span className="text-xs">{project.company}</span>
                        </td>
                        
                        <td className="px-3 py-3">
                          <Badge variant="secondary" className={`text-xs text-white ${getStatusColor(project.status)}`}>
                            {project.status === 'В работе' ? '🟢' : project.status === 'На проверке' ? '🟡' : '⚪'} {project.status}
                          </Badge>
                        </td>
                        
                        <td className="px-3 py-3">
                          <div className="space-y-1">
                            <div className="text-xs font-medium">{project.completion}%</div>
                            <Progress value={project.completion} className="h-1.5 w-16" />
                          </div>
                        </td>
                        
                        <td className="px-3 py-3">
                          <div className="text-xs">
                            <div className="flex items-center space-x-1">
                              <span>✅</span>
                              <span>{stats.completedTasks}/{stats.totalTasks}</span>
                            </div>
                            {tasks.filter(t => t.status === 'in_progress').length > 0 && (
                              <div className="text-xs text-muted-foreground">
                                🔄 {tasks.filter(t => t.status === 'in_progress').length} в работе
                              </div>
                            )}
                          </div>
                        </td>
                        
                        <td className="px-3 py-3">
                          <div className="space-y-1">
                            <div className="text-xs">
                              📝 {stats.checklistProgress}%
                            </div>
                            {tasks.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {tasks.map((task, index) => {
                                  const completed = task.checklist.filter(item => item.done).length;
                                  const total = task.checklist.length;
                                  
                                  return (
                                    <div key={index} className="flex items-center space-x-1 text-xs">
                                      <span className="text-xs">{task.title.substring(0, 6)}...</span>
                                      <div className="flex space-x-0.5">
                                        {task.checklist.map((item, itemIndex) => (
                                          <span key={itemIndex} className="text-xs">
                                            {item.done ? '✅' : '⭕'}
                                          </span>
                                        ))}
                                      </div>
                                      <span className="text-xs text-muted-foreground">({completed}/{total})</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </td>
                        
                        <td className="px-3 py-3">
                          <div className="flex items-center space-x-1 text-xs">
                            <span>👥</span>
                            <span>{project.team}</span>
                          </div>
                        </td>
                        
                        <td className="px-3 py-3">
                          <div className="flex items-center space-x-1 text-xs">
                            <span>📅</span>
                            <span>{new Date(project.deadline).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}</span>
                          </div>
                        </td>
                        
                        <td className="px-3 py-3">
                          <div className="flex space-x-1">
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => setSelectedProject(project)}
                            >
                              ✅
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => navigate(`/projects/${project.id}`, { state: { project } })}
                            >
                              ➡️
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Сводная статистика */}
            <div className="p-4 border-t border-border bg-secondary/20">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-xl font-bold text-primary flex items-center justify-center space-x-1">
                    <span>📊</span>
                    <span>{filteredProjects.length}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">Всего проектов</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-green-500 flex items-center justify-center space-x-1">
                    <span>🟢</span>
                    <span>{filteredProjects.filter(p => p.status === 'В работе').length}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">Активных</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-blue-500 flex items-center justify-center space-x-1">
                    <span>📈</span>
                    <span>{Math.round(filteredProjects.reduce((acc, p) => acc + p.completion, 0) / filteredProjects.length)}%</span>
                  </div>
                  <div className="text-xs text-muted-foreground">Средний прогресс</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-orange-500 flex items-center justify-center space-x-1">
                    <span>👥</span>
                    <span>{filteredProjects.reduce((acc, p) => acc + p.team, 0)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">Участников</div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="p-6 glass-card">
              <h3 className="font-semibold mb-2">Активные проекты</h3>
              <div className="text-3xl font-bold text-primary">3</div>
              <p className="text-sm text-muted-foreground">в работе</p>
            </Card>
            <Card className="p-6 glass-card">
              <h3 className="font-semibold mb-2">Средний прогресс</h3>
              <div className="text-3xl font-bold text-primary">53%</div>
              <p className="text-sm text-muted-foreground">по всем проектам</p>
            </Card>
            <Card className="p-6 glass-card">
              <h3 className="font-semibold mb-2">Участников</h3>
              <div className="text-3xl font-bold text-primary">6</div>
              <p className="text-sm text-muted-foreground">в команде</p>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Task Management Modal */}
      {selectedProject && (
        <Dialog open={!!selectedProject} onOpenChange={() => setSelectedProject(null)}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <CheckSquare className="w-5 h-5" />
                <span>Задачи проекта: {selectedProject.name}</span>
              </DialogTitle>
            </DialogHeader>
            
            <TaskManager
              project={{
                id: selectedProject.id,
                code: `PRJ-${selectedProject.id}`,
                name: selectedProject.name,
                company_id: '1',
                status: 'in_progress' as any,
                risk_level: 'med' as any,
                description: '',
                tags: [],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                completion_percentage: selectedProject.completion
              }}
              tasks={getProjectTasks(selectedProject)}
              onUpdateTask={(taskId, updates) => handleUpdateTask(selectedProject.id, taskId, updates)}
              onDeleteTask={(taskId) => handleDeleteTask(selectedProject.id, taskId)}
              onAddTask={(task) => handleAddTask(selectedProject.id, task)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}