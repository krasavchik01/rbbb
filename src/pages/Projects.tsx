import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Calendar, Users, ArrowRight, Edit, Trash2, Eye } from "lucide-react";
import { useProjects } from "@/hooks/useDataStore";
import { useEmployees } from "@/hooks/useDataStore";
import { Project } from "@/store/dataStore";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function Projects() {
  const { projects, addProject, updateProject, deleteProject } = useProjects();
  const { employees } = useEmployees();
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const navigate = useNavigate();

  // Форма для создания/редактирования проекта
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'Черновик' as Project['status'],
    company: 'RB Partners IT Audit',
    deadline: '',
    budget: 0,
    team: [] as string[],
    completion: 0,
  });

  useEffect(() => {
    let filtered = projects;

    // Фильтр по статусу
    if (filterStatus !== 'all') {
      filtered = filtered.filter(p => p.status === filterStatus);
    }

    // Фильтр по поиску
    if (searchQuery) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.company.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredProjects(filtered);
  }, [projects, searchQuery, filterStatus]);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      status: 'Черновик',
      company: 'RB Partners IT Audit',
      deadline: '',
      budget: 0,
      team: [],
      completion: 0,
    });
  };

  const handleCreate = () => {
    if (!formData.name.trim()) return;
    
    addProject(formData);
    setIsCreateModalOpen(false);
    resetForm();
  };

  const handleEdit = (project: Project) => {
    setSelectedProject(project);
    setFormData({
      name: project.name,
      description: project.description || '',
      status: project.status,
      company: project.company,
      deadline: project.deadline,
      budget: project.budget || 0,
      team: project.team,
      completion: project.completion,
    });
    setIsEditModalOpen(true);
  };

  const handleUpdate = () => {
    if (!selectedProject) return;
    
    updateProject(selectedProject.id, formData);
    setIsEditModalOpen(false);
    setSelectedProject(null);
    resetForm();
  };

  const handleDeleteClick = (project: Project) => {
    setSelectedProject(project);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!selectedProject) return;
    
    deleteProject(selectedProject.id);
    setIsDeleteDialogOpen(false);
    setSelectedProject(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'В работе': return 'bg-blue-500 text-white';
      case 'На проверке': return 'bg-yellow-500 text-white';
      case 'Черновик': return 'bg-gray-500 text-white';
      case 'Завершён': return 'bg-green-500 text-white';
      case 'Приостановлен': return 'bg-red-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const ProjectCard = ({ project }: { project: Project }) => (
    <Card className="p-6 hover:shadow-lg transition-all duration-200 border glass-card group">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="font-semibold text-lg mb-2 line-clamp-2">{project.name}</h3>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Badge className={getStatusColor(project.status)}>
              {project.status}
            </Badge>
            <span className="text-sm text-muted-foreground">{project.company}</span>
          </div>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" onClick={() => handleEdit(project)}>
            <Edit className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(project)}>
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Прогресс</span>
            <span>{project.completion}%</span>
          </div>
          <Progress value={project.completion} className="h-2" />
        </div>

        <div className="flex justify-between items-center text-sm">
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span>{project.team.length} участников</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            <span>{new Date(project.deadline).toLocaleDateString('ru-RU')}</span>
          </div>
        </div>

        {project.budget && (
          <div className="text-sm">
            <span className="text-muted-foreground">Бюджет: </span>
            <span className="font-semibold">{project.budget.toLocaleString('ru-RU')}₽</span>
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-4">
        <Button 
          className="flex-1" 
          variant="default"
          onClick={() => {
            // Проверяем есть ли данные проекта на основе шаблона
            const projectDataKey = `rb_project_data_${project.id}`;
            const savedData = localStorage.getItem(projectDataKey);
            if (savedData) {
              navigate(`/project/${project.id}`);
            } else {
              handleEdit(project);
            }
          }}
        >
          Открыть <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
        <Button 
          variant="outline"
          size="icon"
          onClick={() => handleEdit(project)}
        >
          <Edit className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );

  const ProjectFormFields = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="name">Название проекта *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Введите название проекта"
        />
      </div>

      <div>
        <Label htmlFor="description">Описание</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Описание проекта"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="status">Статус</Label>
          <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as Project['status'] })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Черновик">Черновик</SelectItem>
              <SelectItem value="В работе">В работе</SelectItem>
              <SelectItem value="На проверке">На проверке</SelectItem>
              <SelectItem value="Завершён">Завершён</SelectItem>
              <SelectItem value="Приостановлен">Приостановлен</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="company">Компания</Label>
          <Select value={formData.company} onValueChange={(value) => setFormData({ ...formData, company: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="RB Partners IT Audit">RB Partners IT Audit</SelectItem>
              <SelectItem value="Russell Bedford A+ Partners">Russell Bedford A+ Partners</SelectItem>
              <SelectItem value="Parker Russell">Parker Russell</SelectItem>
              <SelectItem value="RB Partners">RB Partners</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="deadline">Дедлайн</Label>
          <Input
            id="deadline"
            type="date"
            value={formData.deadline}
            onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="budget">Бюджет (₽)</Label>
          <Input
            id="budget"
            type="number"
            value={formData.budget}
            onChange={(e) => setFormData({ ...formData, budget: Number(e.target.value) })}
            placeholder="0"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="completion">Прогресс выполнения (%)</Label>
        <Input
          id="completion"
          type="number"
          min="0"
          max="100"
          value={formData.completion}
          onChange={(e) => setFormData({ ...formData, completion: Math.min(100, Math.max(0, Number(e.target.value))) })}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in p-4 md:p-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-warning bg-clip-text text-transparent">
            Проекты
          </h1>
          <p className="text-muted-foreground mt-1">Управление проектами компании</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button onClick={() => navigate('/create-project')} className="flex-1 md:flex-none" variant="default">
            <Plus className="w-4 h-4 mr-2" />
            Создать из шаблона
          </Button>
          <Button onClick={() => setIsCreateModalOpen(true)} className="flex-1 md:flex-none" variant="outline">
            Простой проект
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск проектов..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full md:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все проекты</SelectItem>
            <SelectItem value="В работе">В работе</SelectItem>
            <SelectItem value="На проверке">На проверке</SelectItem>
            <SelectItem value="Черновик">Черновик</SelectItem>
            <SelectItem value="Завершён">Завершён</SelectItem>
            <SelectItem value="Приостановлен">Приостановлен</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-2xl font-bold">{projects.length}</div>
          <div className="text-sm text-muted-foreground">Всего проектов</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-blue-500">
            {projects.filter(p => p.status === 'В работе').length}
          </div>
          <div className="text-sm text-muted-foreground">В работе</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-yellow-500">
            {projects.filter(p => p.status === 'На проверке').length}
          </div>
          <div className="text-sm text-muted-foreground">На проверке</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-green-500">
            {projects.filter(p => p.status === 'Завершён').length}
          </div>
          <div className="text-sm text-muted-foreground">Завершено</div>
        </Card>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>

      {filteredProjects.length === 0 && (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">Проекты не найдены</p>
          <Button onClick={() => setIsCreateModalOpen(true)} variant="link" className="mt-2">
            Создать первый проект
          </Button>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Создать новый проект</DialogTitle>
            <DialogDescription>
              Заполните информацию о проекте
            </DialogDescription>
          </DialogHeader>
          <ProjectFormFields />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleCreate}>
              Создать проект
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Редактировать проект</DialogTitle>
            <DialogDescription>
              Измените информацию о проекте
            </DialogDescription>
          </DialogHeader>
          <ProjectFormFields />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleUpdate}>
              Сохранить изменения
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Alert Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить проект?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить проект "{selectedProject?.name}"? 
              Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-500 hover:bg-red-600">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
