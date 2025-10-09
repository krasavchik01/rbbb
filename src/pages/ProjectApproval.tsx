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
  
  // Новый ГПХ
  const [newContractorName, setNewContractorName] = useState("");
  const [newContractorAmount, setNewContractorAmount] = useState("");

  // Загрузка проектов
  useEffect(() => {
    const savedProjects = JSON.parse(localStorage.getItem('rb_projects_v3') || '[]');
    const pendingProjects = savedProjects.filter((p: ProjectV3) => p.status === 'new' || p.status === 'pending_approval');
    setProjects(pendingProjects);
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

    toast({
      title: "Проект утверждён!",
      description: `Проект "${selectedProject.name}" утверждён и назначена команда. Уведомления отправлены.`,
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

    // TODO: добавить причину отклонения
    const allProjects = JSON.parse(localStorage.getItem('rb_projects_v3') || '[]');
    const index = allProjects.findIndex((p: ProjectV3) => p.id === selectedProject.id);
    if (index !== -1) {
      allProjects[index].status = 'cancelled';
      localStorage.setItem('rb_projects_v3', JSON.stringify(allProjects));
    }

    toast({
      title: "Проект отклонён",
      description: "Проект возвращён отделу закупок",
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
              <Card className="p-4 bg-muted/50">
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
              </Card>

              {/* Назначение команды */}
              <div>
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Назначение команды
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {PROJECT_ROLES.map(projectRole => (
                    <div key={projectRole.role} className="space-y-2">
                      <Label>
                        {projectRole.label}
                        {projectRole.role === 'partner' && (
                          <Badge variant="destructive" className="ml-2 text-xs">Обязательно</Badge>
                        )}
                      </Label>
                      <div className="flex gap-2">
                        <Select 
                          value={teamMembers[projectRole.role] || ""} 
                          onValueChange={(value) => setTeamMembers({...teamMembers, [projectRole.role]: value})}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Выберите сотрудника" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user1">Иванов И.И.</SelectItem>
                            <SelectItem value="user2">Петров П.П.</SelectItem>
                            <SelectItem value="user3">Сидоров С.С.</SelectItem>
                          </SelectContent>
                        </Select>
                        <Badge variant="outline" className="px-3 flex items-center">
                          {projectRole.bonusPercent}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ГПХ */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-primary" />
                    ГПХ (Подрядчики)
                  </h3>
                </div>

                {contractors.map(contractor => (
                  <Card key={contractor.id} className="p-3 mb-2 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{contractor.name}</p>
                      <p className="text-sm text-muted-foreground">{formatCurrency(contractor.amount)}</p>
                    </div>
                    <Button onClick={() => removeContractor(contractor.id)} variant="ghost" size="icon">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </Card>
                ))}

                <Card className="p-4 bg-muted/30">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        placeholder="Имя ГПХ"
                        value={newContractorName}
                        onChange={(e) => setNewContractorName(e.target.value)}
                      />
                    </div>
                    <div className="w-40">
                      <Input
                        type="number"
                        placeholder="Сумма"
                        value={newContractorAmount}
                        onChange={(e) => setNewContractorAmount(e.target.value)}
                      />
                    </div>
                    <Button onClick={addContractor} variant="outline">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              </div>

              {/* Финансовый расчёт */}
              {finances && (
                <Card className="p-6 bg-gradient-to-br from-blue-50 to-purple-50">
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-primary" />
                    Финансовый расчёт
                  </h3>

                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span>Сумма без НДС:</span>
                      <span className="font-semibold">{formatCurrency(finances.amountWithoutVAT)}</span>
                    </div>
                    <div className="flex justify-between text-red-600">
                      <span>Минус ГПХ:</span>
                      <span>-{formatCurrency(finances.totalContractorsAmount)}</span>
                    </div>
                    <div className="flex justify-between text-red-600">
                      <span>Минус Предрасход (30%):</span>
                      <span>-{formatCurrency(finances.preExpenseAmount)}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-semibold">
                      <span>База для бонусов:</span>
                      <span>{formatCurrency(finances.bonusBase)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Процент бонуса (50%):</span>
                      <span className="font-semibold text-green-600">{formatCurrency(finances.totalBonusAmount)}</span>
                    </div>
                    <div className="border-t pt-2"></div>
                    <div className="flex justify-between text-blue-600">
                      <span>Выплаты команде:</span>
                      <span>-{formatCurrency(finances.totalPaidBonuses)}</span>
                    </div>
                    {finances.unassignedPercent > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Неназначено ({finances.unassignedPercent}%):</span>
                        <span>+{formatCurrency(finances.unassignedAmount)}</span>
                      </div>
                    )}
                    <div className="border-t pt-2"></div>
                    <div className="flex justify-between font-bold text-lg">
                      <span>Грязный доход:</span>
                      <span className={finances.grossProfit > 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(finances.grossProfit)} ({finances.profitMargin.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </Card>
              )}

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


