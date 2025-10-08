import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Search, Calendar, Users, ArrowRight } from "lucide-react";
import { CreateProjectForm } from "@/components/projects/CreateProjectForm";

// Простые типы
interface SimpleProject {
  id: string;
  name: string;
  status: string;
  completion: number;
  team: number;
  deadline: string;
  company: string;
}

const demoProjects: SimpleProject[] = [
  {
    id: '1',
    name: 'Аудит финансовой отчетности ООО "Технологии"',
    status: 'В работе',
    completion: 65,
    team: 3,
    deadline: '2024-03-01',
    company: 'RB Partners IT Audit'
  },
  {
    id: '2',
    name: 'Налоговое консультирование ПАО "Строй"',
    status: 'На проверке',
    completion: 85,
    team: 2,
    deadline: '2024-02-15',
    company: 'Russell Bedford A+ Partners'
  },
  {
    id: '3',
    name: 'IT-аудит системы безопасности',
    status: 'Черновик',
    completion: 10,
    team: 1,
    deadline: '2024-04-01',
    company: 'Parker Russell'
  }
];

export default function Projects() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredProjects, setFilteredProjects] = useState(demoProjects);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const navigate = useNavigate();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'В работе': return 'bg-blue-500';
      case 'На проверке': return 'bg-yellow-500';
      case 'Черновик': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const ProjectCard = ({ project }: { project: SimpleProject }) => (
    <Card className="p-6 hover:shadow-lg transition-all duration-200 border glass-card">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="font-semibold text-lg mb-2 line-clamp-2">{project.name}</h3>
          <div className="flex items-center gap-2 mb-3">
          <Badge variant="secondary" className="badge-status">
            {project.status}
          </Badge>
            <span className="text-sm text-muted-foreground">{project.company}</span>
          </div>
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
            <span>{project.team} участников</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            <span>{new Date(project.deadline).toLocaleDateString('ru-RU')}</span>
          </div>
        </div>

        <div className="flex justify-end pt-2">
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

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Проекты</h1>
          <p className="text-muted-foreground">Управление проектами и задачами</p>
        </div>
        <Button 
          className="btn-gradient"
          onClick={() => setIsCreateModalOpen(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Создать проект
        </Button>
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
          <Button 
            variant="outline"
            onClick={() => {
              setFilteredProjects(demoProjects);
              console.log('Show all projects clicked');
            }}
          >
            Все проекты
          </Button>
          <Button 
            variant="outline"
            onClick={() => {
              setFilteredProjects(demoProjects.filter(p => p.status === 'В работе'));
              console.log('Show in progress projects clicked');
            }}
          >
            В работе
          </Button>
          <Button 
            variant="outline"
            onClick={() => {
              setFilteredProjects(demoProjects.filter(p => p.status === 'На проверке'));
              console.log('Show review projects clicked');
            }}
          >
            На проверке
          </Button>
        </div>
      </Card>

      {/* Контент */}
      <Tabs defaultValue="list" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="list">Список</TabsTrigger>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="gantt">Gantt</TabsTrigger>
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

      {/* Модальное окно создания проекта */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Создание нового проекта</DialogTitle>
          </DialogHeader>
          <CreateProjectForm
            onSave={(projectData) => {
              console.log('Создание проекта:', projectData);
              // TODO: Implement actual project creation
              setIsCreateModalOpen(false);
            }}
            onCancel={() => setIsCreateModalOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}