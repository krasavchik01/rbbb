import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  CheckCircle2, 
  XCircle, 
  Users, 
  Calendar,
  DollarSign,
  FileText,
  Plus,
  Trash2,
  UserPlus,
  TrendingUp,
  Building2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { ProjectV3 } from "@/types/project-v3";
import { PROJECT_ROLES, ROLE_LABELS, UserRole } from "@/types/roles";
import { Contractor } from "@/types/project-v3";
import { notifyProjectApproved, notifyProjectRejected, notifyPMAssigned, notifyTeamMemberAdded } from "@/lib/projectNotifications";

export default function ProjectApproval() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [projects, setProjects] = useState<ProjectV3[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectV3 | null>(null);
  const [isApproving, setIsApproving] = useState(false);

  // Команда проекта
  const [teamMembers, setTeamMembers] = useState<{[key: string]: string}>({});
  const [contractors, setContractors] = useState<Contractor[]>([]);
  
  // Отображение для зам директора
  const [selectedRoles, setSelectedRoles] = useState<{[key: string]: boolean}>({
    partner: true // Партнер обязателен
  });
  
  // Новый ГПХ
  const [newContractorName, setNewContractorName] = useState("");
  const [newContractorAmount, setNewContractorAmount] = useState("");

  // Демо-сотрудники с занятостью
  const demoEmployees = [
    { id: 'emp-1', name: 'Иванов И.И.', role: 'partner', activeProjects: 2, loadPercent: 85, location: 'office' },
    { id: 'emp-2', name: 'Петров П.П.', role: 'partner', activeProjects: 1, loadPercent: 60, location: 'project' },
    { id: 'emp-3', name: 'Сидоров С.С.', role: 'project_manager', activeProjects: 3, loadPercent: 95, location: 'office' },
    { id: 'emp-4', name: 'Козлова К.К.', role: 'project_manager', activeProjects: 1, loadPercent: 45, location: 'office' },
    { id: 'emp-5', name: 'Новикова Н.Н.', role: 'supervisor_3', activeProjects: 2, loadPercent: 70, location: 'project' },
    { id: 'emp-6', name: 'Волков В.В.', role: 'supervisor_3', activeProjects: 1, loadPercent: 40, location: 'office' },
    { id: 'emp-7', name: 'Морозова М.М.', role: 'supervisor_2', activeProjects: 1, loadPercent: 55, location: 'office' },
    { id: 'emp-8', name: 'Лебедев Л.Л.', role: 'supervisor_2', activeProjects: 2, loadPercent: 80, location: 'office' },
    { id: 'emp-9', name: 'Орлова О.О.', role: 'supervisor_1', activeProjects: 0, loadPercent: 0, location: 'office' },
    { id: 'emp-10', name: 'Зайцев З.З.', role: 'supervisor_1', activeProjects: 1, loadPercent: 50, location: 'office' },
    { id: 'emp-11', name: 'Соколова С.С.', role: 'tax_specialist_1', activeProjects: 3, loadPercent: 90, location: 'project' },
    { id: 'emp-12', name: 'Медведев М.М.', role: 'tax_specialist_1', activeProjects: 1, loadPercent: 35, location: 'office' },
    { id: 'emp-13', name: 'Кузнецов К.К.', role: 'tax_specialist_2', activeProjects: 2, loadPercent: 65, location: 'office' },
    { id: 'emp-14', name: 'Белова Б.Б.', role: 'tax_specialist_2', activeProjects: 1, loadPercent: 40, location: 'office' },
    { id: 'emp-15', name: 'Смирнова С.С.', role: 'assistant_3', activeProjects: 2, loadPercent: 75, location: 'office' },
    { id: 'emp-16', name: 'Попов П.П.', role: 'assistant_3', activeProjects: 1, loadPercent: 30, location: 'office' },
    { id: 'emp-17', name: 'Васильева В.В.', role: 'assistant_2', activeProjects: 1, loadPercent: 45, location: 'office' },
    { id: 'emp-18', name: 'Николаев Н.Н.', role: 'assistant_2', activeProjects: 0, loadPercent: 0, location: 'office' },
    { id: 'emp-19', name: 'Павлова П.П.', role: 'assistant_1', activeProjects: 1, loadPercent: 55, location: 'project' },
    { id: 'emp-20', name: 'Федоров Ф.Ф.', role: 'assistant_1', activeProjects: 0, loadPercent: 0, location: 'office' },
  ];

  // Загрузка проектов
  const loadProjects = () => {
    const savedProjects = JSON.parse(localStorage.getItem('rb_projects_v3') || '[]');
    const pendingProjects = savedProjects.filter((p: ProjectV3) => p.status === 'new' || p.status === 'pending_approval');
    console.log('📋 Загрузка проектов на утверждение:', pendingProjects.length, 'проектов');
    setProjects(pendingProjects);
  };

  useEffect(() => {
    loadProjects();
    
    // Автоматически обновляем каждые 5 секунд
    const interval = setInterval(loadProjects, 5000);
    
    return () => clearInterval(interval);
  }, []);

  // Расчёт финансов в реальном времени
  const calculateFinances = () => {
    if (!selectedProject) return null;

    const amountWithoutVAT = selectedProject.contract.amountWithoutVAT;
    const preExpensePercent = 30;
    const preExpenseAmount = amountWithoutVAT * (preExpensePercent / 100);
    
    const totalContractorsAmount = contractors.reduce((sum, c) => sum + c.amount, 0);
    const bonusBase = amountWithoutVAT - totalContractorsAmount - preExpenseAmount;
    const bonusPercent = 50;
    const totalBonusAmount = bonusBase * (bonusPercent / 100);

    // Рассчитываем бонусы по ролям
    const teamBonuses: {[key: string]: number} = {};
    let totalAssignedPercent = 0;

    PROJECT_ROLES.forEach(projectRole => {
      const memberId = teamMembers[projectRole.role];
      if (memberId) {
        teamBonuses[projectRole.role] = totalBonusAmount * (projectRole.bonusPercent / 100);
        totalAssignedPercent += projectRole.bonusPercent;
      }
    });

    const totalPaidBonuses = Object.values(teamBonuses).reduce((sum, b) => sum + b, 0);
    const unassignedPercent = 100 - totalAssignedPercent;
    const unassignedAmount = totalBonusAmount * (unassignedPercent / 100);
    
    const totalCosts = totalPaidBonuses + totalContractorsAmount + preExpenseAmount;
    const grossProfit = amountWithoutVAT - totalCosts;
    const profitMargin = amountWithoutVAT > 0 ? (grossProfit / amountWithoutVAT) * 100 : 0;

    return {
      amountWithoutVAT,
      preExpenseAmount,
      totalContractorsAmount,
      bonusBase,
      totalBonusAmount,
      teamBonuses,
      totalPaidBonuses,
      unassignedPercent,
      unassignedAmount,
      totalCosts,
      grossProfit,
      profitMargin,
    };
  };

  const finances = calculateFinances();

  const addContractor = () => {
    if (!newContractorName.trim() || !newContractorAmount || parseFloat(newContractorAmount) <= 0) {
      toast({
        title: "Ошибка",
        description: "Укажите имя ГПХ и сумму",
        variant: "destructive"
      });
      return;
    }

    const contractor: Contractor = {
      id: `contractor_${Date.now()}`,
      name: newContractorName,
      amount: parseFloat(newContractorAmount),
      addedBy: user?.id || "",
      addedAt: new Date().toISOString(),
    };

    setContractors([...contractors, contractor]);
    setNewContractorName("");
    setNewContractorAmount("");
  };

  const removeContractor = (id: string) => {
    setContractors(contractors.filter(c => c.id !== id));
  };

  const handleApprove = () => {
    if (!selectedProject) return;

    // Проверяем что назначен хотя бы партнер
    if (!teamMembers['partner']) {
      toast({
        title: "Ошибка",
        description: "Необходимо назначить партнера",
        variant: "destructive"
      });
      return;
    }

    setIsApproving(true);

    // Обновляем проект
    const updatedProject: ProjectV3 = {
      ...selectedProject,
      status: 'approved',
      team: PROJECT_ROLES
        .filter(role => teamMembers[role.role])
        .map(role => ({
          userId: teamMembers[role.role],
          userName: `Сотрудник ${teamMembers[role.role]}`, // TODO: получить из списка сотрудников
          role: role.role,
          bonusPercent: role.bonusPercent,
          assignedAt: new Date().toISOString(),
          assignedBy: user?.id || "",
        })),
      finances: {
        ...selectedProject.finances,
        contractors: contractors,
        totalContractorsAmount: finances?.totalContractorsAmount || 0,
        bonusBase: finances?.bonusBase || 0,
        totalBonusAmount: finances?.totalBonusAmount || 0,
        teamBonuses: {},
        totalPaidBonuses: 0,
        totalCosts: finances?.totalCosts || 0,
        grossProfit: finances?.grossProfit || 0,
        profitMargin: finances?.profitMargin || 0,
      },
      approvedBy: user?.id,
      approvedByName: user?.name,
      approvedAt: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Сохраняем
    const allProjects = JSON.parse(localStorage.getItem('rb_projects_v3') || '[]');
    const index = allProjects.findIndex((p: ProjectV3) => p.id === selectedProject.id);
    if (index !== -1) {
      allProjects[index] = updatedProject;
      localStorage.setItem('rb_projects_v3', JSON.stringify(allProjects));
    }

    // Отправляем уведомления всем членам команды
    updatedProject.team.forEach(member => {
      const employee = demoEmployees.find(e => e.id === member.userId);
      if (!employee) return;

      // Если это партнёр - отправляем уведомление о назначении партнёром
      if (member.role === 'partner') {
        notifyProjectApproved({
          projectName: selectedProject.name,
          partnerId: member.userId,
          partnerName: employee.name,
          approverName: user?.name || 'Зам. директора'
        });
      } 
      // Если это PM - отправляем уведомление о назначении PM
      else if (member.role === 'project_manager') {
        notifyPMAssigned({
          projectName: selectedProject.name,
          pmId: member.userId,
          pmName: employee.name,
          partnerName: user?.name || 'Партнёр',
          projectId: selectedProject.id
        });
      }
      // Остальным членам команды - общее уведомление
      else {
        notifyTeamMemberAdded({
          projectName: selectedProject.name,
          memberId: member.userId,
          memberName: employee.name,
          role: ROLE_LABELS[member.role as UserRole] || member.role,
          assignerName: user?.name || 'Руководитель',
          projectId: selectedProject.id
        });
      }
    });

    toast({
      title: "Проект утверждён!",
      description: `Проект "${selectedProject.name}" утверждён и назначена команда. Уведомления отправлены всем ${updatedProject.team.length} участникам.`,
    });

    // Обновляем список
    setProjects(projects.filter(p => p.id !== selectedProject.id));
    setSelectedProject(null);
    setTeamMembers({});
    setContractors([]);
    setIsApproving(false);
  };

  const handleReject = () => {
    if (!selectedProject) return;

    const reason = "Требуется дополнительная информация"; // TODO: добавить ввод причины
    
    const allProjects = JSON.parse(localStorage.getItem('rb_projects_v3') || '[]');
    const index = allProjects.findIndex((p: ProjectV3) => p.id === selectedProject.id);
    if (index !== -1) {
      allProjects[index].status = 'cancelled';
      localStorage.setItem('rb_projects_v3', JSON.stringify(allProjects));
    }

    // Отправляем уведомление в отдел закупок
    notifyProjectRejected({
      projectName: selectedProject.name,
      reason: reason,
      procurementUserId: 'procurement_1', // ID отдела закупок
      rejectorName: user?.name || 'Зам. директора'
    });

    toast({
      title: "Проект отклонён",
      description: "Проект возвращён отделу закупок. Уведомление отправлено.",
      variant: "destructive"
    });

    setProjects(projects.filter(p => p.id !== selectedProject.id));
    setSelectedProject(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU').format(amount) + ' ₸';
  };

  return (
    <div className="space-y-6 animate-fade-in p-4 md:p-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-warning bg-clip-text text-transparent">
            Утверждение проектов
          </h1>
          <p className="text-muted-foreground mt-1">Заместитель генерального директора</p>
        </div>
        <Badge className="text-lg px-4 py-2">
          {projects.length} проектов на утверждении
        </Badge>
      </div>

      <Tabs defaultValue="list" className="w-full">
        <TabsList className="grid w-full md:w-auto md:inline-grid grid-cols-2">
          <TabsTrigger value="list">
            <FileText className="w-4 h-4 mr-2" />
            Список проектов
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <Calendar className="w-4 h-4 mr-2" />
            Календарь занятости
          </TabsTrigger>
        </TabsList>

        {/* Список проектов */}
        <TabsContent value="list" className="space-y-4">
          {projects.length === 0 ? (
            <Card className="p-12 text-center">
              <CheckCircle2 className="w-16 h-16 mx-auto text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Нет проектов на утверждении</h3>
              <p className="text-muted-foreground">Все проекты обработаны</p>
            </Card>
          ) : (
            projects.map(project => (
              <Card key={project.id} className="p-6 hover:shadow-lg transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{project.name}</h3>
                        <p className="text-sm text-muted-foreground">{project.client.name}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Компания</Label>
                        <p className="font-medium">{project.companyName}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Вид проекта</Label>
                        <Badge variant="outline">{project.type}</Badge>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Сумма без НДС</Label>
                        <p className="font-semibold text-green-600">{formatCurrency(project.contract.amountWithoutVAT)}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Срок</Label>
                        <p className="text-sm">{new Date(project.contract.serviceStartDate).toLocaleDateString('ru-RU')} - {new Date(project.contract.serviceEndDate).toLocaleDateString('ru-RU')}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button onClick={() => setSelectedProject(project)} className="whitespace-nowrap">
                      <Users className="w-4 h-4 mr-2" />
                      Назначить команду
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Календарь занятости */}
        <TabsContent value="calendar">
          <Card className="p-6">
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">Календарь занятости</h3>
              <p className="text-muted-foreground mb-4">Здесь будет отображаться загрузка сотрудников</p>
              <Badge variant="outline">В разработке</Badge>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Модальное окно назначения команды */}
      {selectedProject && (
        <Dialog open={!!selectedProject} onOpenChange={() => setSelectedProject(null)}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">Назначение команды и утверждение проекта</DialogTitle>
              <p className="text-muted-foreground">{selectedProject.name}</p>
            </DialogHeader>

            <div className="space-y-6">
              {/* Информация о проекте */}
              <Card className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 border-l-4 border-blue-500">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <Label className="text-xs">Клиент</Label>
                    <p className="font-medium">{selectedProject.client.name}</p>
                  </div>
                  <div>
                    <Label className="text-xs">Компания</Label>
                    <p className="font-medium">{selectedProject.companyName}</p>
                  </div>
                  <div>
                    <Label className="text-xs">Сумма без НДС</Label>
                    <p className="font-semibold text-green-600">{formatCurrency(selectedProject.contract.amountWithoutVAT)}</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <span className="inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
                    Вы назначаете команду и видите только занятость сотрудников. Финансовые расчёты выполняются автоматически.
                  </p>
                </div>
              </Card>

              {/* Назначение команды */}
              <div>
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Назначение команды
                </h3>

                <div className="space-y-3">
                  {PROJECT_ROLES.map(projectRole => {
                    const availableEmployees = demoEmployees.filter(emp => emp.role === projectRole.role);
                    const isRoleSelected = selectedRoles[projectRole.role];
                    
                    return (
                      <div key={projectRole.role} className="border rounded-lg p-3">
                        {/* Чекбокс для роли */}
                        <div className="flex items-center justify-between mb-2">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isRoleSelected || false}
                              disabled={projectRole.role === 'partner'}
                              onChange={(e) => {
                                // Партнер всегда должен быть выбран
                                if (projectRole.role === 'partner') return;
                                
                                setSelectedRoles({...selectedRoles, [projectRole.role]: e.target.checked});
                                if (!e.target.checked) {
                                  const newTeam = {...teamMembers};
                                  delete newTeam[projectRole.role];
                                  setTeamMembers(newTeam);
                                }
                              }}
                              className="w-4 h-4 rounded border-gray-300"
                            />
                            <span className="font-medium">{projectRole.label}</span>
                            {projectRole.role === 'partner' && (
                              <Badge variant="destructive" className="text-xs">Обязательно</Badge>
                            )}
                          </label>
                        </div>

                        {/* Выпадающий список сотрудников */}
                        {isRoleSelected && (
                          <div className="ml-7 space-y-2">
                            <Select 
                              value={teamMembers[projectRole.role] || ""} 
                              onValueChange={(value) => setTeamMembers({...teamMembers, [projectRole.role]: value})}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Выберите сотрудника" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableEmployees.map(emp => (
                                  <SelectItem key={emp.id} value={emp.id}>
                                    <div className="flex items-center justify-between w-full gap-4">
                                      <span>{emp.name}</span>
                                      <div className="flex items-center gap-2 text-xs">
                                        <Badge 
                                          variant="outline" 
                                          className={
                                            emp.loadPercent >= 80 ? 'bg-red-100 text-red-700' :
                                            emp.loadPercent >= 50 ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-green-100 text-green-700'
                                          }
                                        >
                                          Загрузка: {emp.loadPercent}%
                                        </Badge>
                                        <Badge variant="outline">
                                          Проектов: {emp.activeProjects}
                                        </Badge>
                                        <Badge 
                                          variant="outline"
                                          className={emp.location === 'office' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}
                                        >
                                          {emp.location === 'office' ? '🏢 В офисе' : '📍 На проекте'}
                                        </Badge>
                                      </div>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ГПХ убран - зам. директор не управляет финансами */}

              {/* Финансовый расчёт убран - зам. директор его не видит */}

              {/* Действия */}
              <div className="flex gap-4">
                <Button onClick={handleReject} variant="outline" className="flex-1">
                  <XCircle className="w-4 h-4 mr-2" />
                  Отклонить
                </Button>
                <Button onClick={handleApprove} className="flex-1" size="lg" disabled={isApproving}>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Утвердить проект
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
