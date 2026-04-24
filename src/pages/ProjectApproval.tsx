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
  Building2,
  AlertTriangle,
  Eye,
  ChevronRight
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { ProjectV3 } from "@/types/project-v3";
import { supabaseDataStore } from "@/lib/supabaseDataStore";
import { supabase } from "@/integrations/supabase/client";
import { PROJECT_ROLES, ROLE_LABELS, UserRole } from "@/types/roles";
import { TeamAssignment } from "@/components/projects/TeamAssignment";
import { Contractor } from "@/types/project-v3";
import { notifyProjectApproved, notifyProjectRejected, notifyPMAssigned, notifyTeamMemberAdded } from "@/lib/projectNotifications";
import { getNotifications } from "@/lib/notifications";
import { useEmployees } from "@/hooks/useSupabaseData";
import { useAppSettings } from "@/lib/appSettings";
import { projectMatchesAllowedCompanies } from "@/lib/userCompanyAccess";

export default function ProjectApproval() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { employees: realEmployees = [] } = useEmployees();
  const [appSettings] = useAppSettings();

  const [projects, setProjects] = useState<ProjectV3[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectV3 | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<ProjectV3 | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Массовое удаление
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  // Проверка прав админа (БЕЗ зам. директора!)
  const isAdmin = user?.role === 'admin' || user?.role === 'ceo';

  // Зам. директор имеет право управлять проектами на утверждении
  const canManageProjects = isAdmin || user?.role === 'deputy_director';

  // Команда проекта
  const [teamMembers, setTeamMembers] = useState<{[key: string]: string}>({});
  const [contractors, setContractors] = useState<Contractor[]>([]);
  
  // Отображение для зам директора
  const [selectedRoles, setSelectedRoles] = useState<{[key: string]: boolean}>({
    partner: true // Партнер обязателен
  });
  
  // Настройки видимости финансовой информации
  const [showFinancialInfo, setShowFinancialInfo] = useState(false);
  const [financialVisibleTo, setFinancialVisibleTo] = useState<string[]>([]);
  
  // Новый ГПХ/Субподряд
  const [newContractorName, setNewContractorName] = useState("");
  const [newContractorAmount, setNewContractorAmount] = useState("");
  const [newContractorType, setNewContractorType] = useState<'gph' | 'subcontract'>('gph');

  // Добавление нового сотрудника inline
  const [addingNewForRole, setAddingNewForRole] = useState<string | null>(null);
  const [newEmpName, setNewEmpName] = useState("");

  // Поиск в dropdown и открытый dropdown
  const [openRoleDropdown, setOpenRoleDropdown] = useState<string | null>(null);
  const [roleSearchQuery, setRoleSearchQuery] = useState("");

  // Маппинг ролей сотрудников из Supabase на роли проектов
  const mapEmployeeRoleToProjectRole = (employeeRole: string): string | null => {
    const roleMap: Record<string, string> = {
      'partner': 'partner',
      'manager_1': 'manager_1',
      'manager_2': 'manager_2',
      'manager_3': 'manager_3',
      'supervisor_3': 'supervisor_3',
      'supervisor_2': 'supervisor_2',
      'supervisor_1': 'supervisor_1',
      'tax_specialist': 'tax_specialist_1', // Маппим tax_specialist на tax_specialist_1
      'tax_specialist_1': 'tax_specialist_1',
      'tax_specialist_2': 'tax_specialist_2',
      'assistant_3': 'assistant_3',
      'assistant_2': 'assistant_2',
      'assistant_1': 'assistant_1',
      'academy': 'academy',
    };
    // Если роль уже в списке PROJECT_ROLES, возвращаем её как есть
    const projectRoleNames = PROJECT_ROLES.map(r => r.role);
    if (projectRoleNames.includes(employeeRole as any)) {
      return employeeRole;
    }
    return roleMap[employeeRole] || null;
  };

  // Преобразуем реальных сотрудников в универсальный формат для выбора (БЕЗ ФИЛЬТРАЦИИ)
  const availableEmployees = realEmployees.map(emp => {
    return {
      id: emp.id,
      name: emp.name || emp.email || 'Без имени',
      role: emp.role, // Используем исходную роль напрямую
      activeProjects: 0,
      loadPercent: 0,
      location: 'office' as const,
      originalRole: emp.role // Сохраняем исходную роль для отображения
    };
  });

  // Логирование для отладки
  useEffect(() => {
    console.log('🔍 [ProjectApproval] Отладка сотрудников:');
    console.log('  - realEmployees:', realEmployees.length, 'сотрудников');
    console.log('  - realEmployees список:', realEmployees.map(e => ({ id: e.id, name: e.name, role: e.role })));
    console.log('  - availableEmployees:', availableEmployees.length, 'сотрудников');
    console.log('  - availableEmployees список:', availableEmployees.map(e => ({ id: e.id, name: e.name, role: e.role, originalRole: (e as any).originalRole })));
    console.log('  - PROJECT_ROLES:', PROJECT_ROLES.map(r => r.role));
    
    // Проверяем каждую роль из PROJECT_ROLES
    PROJECT_ROLES.forEach(projectRole => {
      const employeesForRole = availableEmployees.filter(emp => emp.role === projectRole.role);
      console.log(`  - ${projectRole.label} (${projectRole.role}):`, employeesForRole.length, 'сотрудников');
      if (employeesForRole.length === 0) {
        console.warn(`    ⚠️ Нет сотрудников с ролью ${projectRole.role}`);
        const withOriginalRole = realEmployees.filter(e => e.role === projectRole.role);
        console.log(`    - С исходной ролью ${projectRole.role}:`, withOriginalRole.length);
      }
    });
  }, [realEmployees, availableEmployees]);

  // Загрузка проектов
  const loadProjects = async () => {
    const supaProjects = await supabaseDataStore.getProjects();

    // Фильтр по allowedCompanyIds (для зам. директора и других с ограниченным доступом)
    let filtered = supaProjects as any[];
    if (user?.allowedCompanyIds && user.allowedCompanyIds.length > 0) {
      const companies = appSettings.companies || [];
      const allowedNames = user.allowedCompanyIds
        .map((id: string) => (companies as any[]).find((c: any) => c.id === id)?.name)
        .filter(Boolean) as string[];
      if (allowedNames.length > 0) {
        filtered = filtered.filter(p => projectMatchesAllowedCompanies(p, allowedNames));
      }
    }

    // Фильтруем проекты на утверждении (new или pending_approval в notes.status)
    const pending = filtered
      .filter(p => {
        const notesStatus = p?.notes?.status;
        return notesStatus === 'new' || notesStatus === 'pending_approval';
      })
      .map(p => {
        if (p.notes && typeof p.notes === 'object') {
          return { ...p, ...p.notes, id: p.id };
        }
        return p;
      }) as ProjectV3[];
    console.log('📋 Загрузка проектов на утверждение из Supabase:', pending.length);
    setProjects(pending);
  };

  useEffect(() => {
    loadProjects();
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
    const bonusPercent = 10; // База бонусов = 10%
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
        description: "Укажите имя и сумму",
        variant: "destructive"
      });
      return;
    }

    const contractor: Contractor = {
      id: `contractor_${Date.now()}`,
      name: newContractorName,
      amount: parseFloat(newContractorAmount),
      type: newContractorType,
      addedBy: user?.id || "",
      addedAt: new Date().toISOString(),
    };

    setContractors([...contractors, contractor]);
    setNewContractorName("");
    setNewContractorAmount("");
    setNewContractorType('gph');
  };

  const removeContractor = (id: string) => {
    setContractors(contractors.filter(c => c.id !== id));
  };

  const handleApprove = async () => {
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

    try {
      // Получаем имена сотрудников из списка
      const getEmployeeName = (employeeId: string): string => {
        const employee = availableEmployees.find(e => e.id === employeeId);
        return employee?.name || `Сотрудник ${employeeId}`;
      };

      // Формируем команду проекта
      const projectTeam = PROJECT_ROLES
        .filter(role => teamMembers[role.role])
        .map(role => ({
          userId: teamMembers[role.role],
          userName: getEmployeeName(teamMembers[role.role]),
          role: role.role,
          bonusPercent: role.bonusPercent,
          assignedAt: new Date().toISOString(),
          assignedBy: user?.id || "",
        }));

      // Обновляем проект
      const updatedProject: ProjectV3 = {
        ...selectedProject,
        status: 'approved',
        team: projectTeam,
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
        // Сохраняем настройки видимости финансовой информации
        financialVisibility: showFinancialInfo ? {
          enabled: true,
          visibleTo: financialVisibleTo,
        } : undefined,
        approvedBy: user?.id,
        approvedByName: user?.name || 'Зам. директора',
        approvedAt: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Сохраняем в Supabase
      const supabaseId = selectedProject.id || (selectedProject as any).supabaseId;
      if (supabaseId) {
        const saved = await supabaseDataStore.updateProject(supabaseId, updatedProject);
        if (!saved) {
          throw new Error('Не удалось сохранить проект в Supabase');
        }
        console.log('✅ Project approved and saved to Supabase:', supabaseId);
      } else {
        console.warn('⚠️ Project ID not found, cannot save to Supabase');
      }

      // Отправляем уведомления всем членам команды параллельно
      const approverName = user?.name || 'Зам. директора';
      console.log(`📬 [ProjectApproval] Начинаем отправку уведомлений для команды из ${updatedProject.team.length} участников:`, updatedProject.team);
      
      const notificationPromises = updatedProject.team.map((member, index) => {
        console.log(`📬 [ProjectApproval] Обработка участника ${index + 1}/${updatedProject.team.length}:`, {
          userId: member.userId,
          role: member.role,
          userName: member.userName
        });
        
        const employee = availableEmployees.find(e => e.id === member.userId);
        if (!employee) {
          console.warn(`⚠️ [ProjectApproval] Сотрудник ${member.userId} не найден для уведомления`);
          return null;
        }

        // Определяем тип уведомления по роли
        if (member.role === 'partner') {
          console.log(`📬 [ProjectApproval] Отправка уведомления партнеру:`, {
            partnerId: member.userId,
            partnerName: employee.name,
            projectName: selectedProject.name
          });
          const notification = notifyProjectApproved({
            projectName: selectedProject.name,
            partnerId: member.userId,
            partnerName: employee.name,
            approverName: approverName
          });
          console.log(`✅ [ProjectApproval] Уведомление партнеру создано:`, notification);
          return notification;
        } else if (member.role === 'manager_1' || member.role === 'manager_2' || member.role === 'manager_3') {
          console.log(`📬 [ProjectApproval] Отправка уведомления PM:`, {
            pmId: member.userId,
            pmName: employee.name,
            projectName: selectedProject.name
          });
          const notification = notifyPMAssigned({
            projectName: selectedProject.name,
            pmId: member.userId,
            pmName: employee.name,
            partnerName: approverName,
            projectId: selectedProject.id
          });
          console.log(`✅ [ProjectApproval] Уведомление PM создано:`, notification);
          
          // Дополнительное уведомление менеджеру о необходимости распределить задачи
          const partnerMember = updatedProject.team.find(m => m.role === 'partner');
          if (partnerMember) {
            const partnerEmployee = availableEmployees.find(e => e.id === partnerMember.userId);
            const distributeNotification = notifyTeamMemberAdded({
              projectName: selectedProject.name,
              memberId: member.userId,
              memberName: employee.name,
              role: 'Менеджер проекта',
              assignerName: partnerEmployee?.name || 'Партнер',
              projectId: selectedProject.id
            });
            console.log(`✅ [ProjectApproval] Дополнительное уведомление менеджеру о распределении задач:`, distributeNotification);
          }
          
          return notification;
        } else {
          console.log(`📬 [ProjectApproval] Отправка уведомления члену команды:`, {
            memberId: member.userId,
            memberName: employee.name,
            role: member.role,
            projectName: selectedProject.name
          });
          const notification = notifyTeamMemberAdded({
            projectName: selectedProject.name,
            memberId: member.userId,
            memberName: employee.name,
            role: ROLE_LABELS[member.role as UserRole] || member.role,
            assignerName: approverName,
            projectId: selectedProject.id
          });
          console.log(`✅ [ProjectApproval] Уведомление члену команды создано:`, notification);
          return notification;
        }
      });

      // Отправляем все уведомления параллельно
      try {
        const results = await Promise.all(notificationPromises.filter(Boolean));
        console.log(`✅ [ProjectApproval] Уведомления отправлены всем ${updatedProject.team.length} участникам проекта. Результаты:`, results);
        
        // Проверяем, что уведомления действительно сохранились
        for (const member of updatedProject.team) {
          const savedNotifications = await getNotifications(member.userId);
          console.log(`📋 [ProjectApproval] Уведомления для ${member.userName} (${member.userId}):`, savedNotifications.length, 'шт.');
        }
      } catch (error) {
        console.error('❌ [ProjectApproval] Ошибка при отправке уведомлений:', error);
        // Не блокируем процесс утверждения, если уведомления не отправились
      }

      toast({
        title: "Проект утверждён!",
        description: `Проект "${selectedProject.name}" утверждён и назначена команда. Уведомления отправлены всем ${updatedProject.team.length} участникам.`,
      });

      // Обновляем список
      setProjects(projects.filter(p => p.id !== selectedProject.id));
      setSelectedProject(null);
      setTeamMembers({});
      setContractors([]);
      setShowFinancialInfo(false);
      setFinancialVisibleTo([]);
      
      // Перезагружаем проекты
      await loadProjects();
    } catch (error: any) {
      console.error('❌ Error approving project:', error);
      toast({
        title: "Ошибка",
        description: error?.message || "Не удалось утвердить проект",
        variant: "destructive"
      });
    } finally {
      setIsApproving(false);
    }
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

  // Удаление проекта (для админа и зам. директора)
  const handleDeleteProject = async (project: ProjectV3) => {
    if (!canManageProjects) {
      toast({
        title: "Ошибка",
        description: "У вас нет прав для удаления проектов",
        variant: "destructive"
      });
      return;
    }

    setIsDeleting(true);
    try {
      const projectId = project.id;
      if (!projectId) {
        throw new Error('ID проекта не найден');
      }

      const deleted = await supabaseDataStore.deleteProject(projectId);
      if (!deleted) {
        throw new Error('Не удалось удалить проект');
      }

      toast({
        title: "Проект удалён",
        description: `Проект "${project.name}" успешно удалён из системы.`,
      });

      setProjects(projects.filter(p => p.id !== projectId));
      setProjectToDelete(null);
      await loadProjects();
    } catch (error: any) {
      console.error('❌ Ошибка удаления проекта:', error);
      toast({
        title: "Ошибка",
        description: error?.message || "Не удалось удалить проект",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Переключение выбора проекта
  const toggleProjectSelection = (projectId: string) => {
    const newSelected = new Set(selectedProjects);
    if (newSelected.has(projectId)) {
      newSelected.delete(projectId);
    } else {
      newSelected.add(projectId);
    }
    setSelectedProjects(newSelected);
  };

  // Выбрать все проекты
  const selectAllProjects = () => {
    setSelectedProjects(new Set(projects.map(p => p.id)));
  };

  // Снять выделение со всех
  const deselectAllProjects = () => {
    setSelectedProjects(new Set());
  };

  // Массовое удаление выбранных проектов
  const handleBulkDelete = async () => {
    if (!canManageProjects) {
      toast({
        title: "Ошибка",
        description: "У вас нет прав для удаления проектов",
        variant: "destructive"
      });
      return;
    }

    if (selectedProjects.size === 0) {
      toast({
        title: "Ошибка",
        description: "Не выбрано ни одного проекта для удаления",
        variant: "destructive"
      });
      return;
    }

    if (!confirm(`Удалить ${selectedProjects.size} проектов? Это действие необратимо!`)) {
      return;
    }

    setIsDeletingBulk(true);
    try {
      let successCount = 0;
      let failCount = 0;

      for (const projectId of selectedProjects) {
        try {
          const deleted = await supabaseDataStore.deleteProject(projectId);
          if (deleted) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          console.error(`Ошибка удаления проекта ${projectId}:`, error);
          failCount++;
        }
      }

      toast({
        title: "Массовое удаление завершено",
        description: `Удалено: ${successCount}. Ошибок: ${failCount}`,
        variant: successCount > 0 ? "default" : "destructive"
      });

      setProjects(projects.filter(p => !selectedProjects.has(p.id)));
      setSelectedProjects(new Set());
      await loadProjects();
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error?.message || "Не удалось выполнить массовое удаление",
        variant: "destructive"
      });
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU').format(amount) + ' ₸';
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in p-2 sm:p-4 md:p-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-warning bg-clip-text text-transparent">
            Утверждение проектов
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">Заместитель генерального директора</p>
        </div>
        <Badge className="text-sm sm:text-lg px-3 sm:px-4 py-1 sm:py-2 self-start sm:self-auto">
          {projects.length} на утверждении
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
          {/* Панель массовых действий */}
          {canManageProjects && projects.length > 0 && (
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectedProjects.size === projects.length ? deselectAllProjects : selectAllProjects}
                  >
                    {selectedProjects.size === projects.length ? 'Снять выделение' : 'Выбрать все'}
                  </Button>
                  {selectedProjects.size > 0 && (
                    <Badge variant="secondary">
                      Выбрано: {selectedProjects.size}
                    </Badge>
                  )}
                </div>
                {selectedProjects.size > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={isDeletingBulk}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {isDeletingBulk ? 'Удаление...' : `Удалить ${selectedProjects.size}`}
                  </Button>
                )}
              </div>
            </Card>
          )}

          {projects.length === 0 ? (
            <Card className="p-12 text-center">
              <CheckCircle2 className="w-16 h-16 mx-auto text-green-500 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Нет проектов на утверждении</h3>
              <p className="text-muted-foreground">Все проекты обработаны</p>
            </Card>
          ) : (
            projects.map(project => (
              <Card key={project.id} className="p-6 hover:shadow-lg transition-all">
                <div className="flex items-start gap-4">
                  {/* Чекбокс для массового удаления */}
                  {isAdmin && (
                    <div className="pt-1">
                      <input
                        type="checkbox"
                        checked={selectedProjects.has(project.id)}
                        onChange={() => toggleProjectSelection(project.id)}
                        className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                      />
                    </div>
                  )}

                  <div className="flex-1">
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
                        <p className="font-semibold text-green-600">
                          {project.contract?.amountWithoutVAT ? formatCurrency(project.contract.amountWithoutVAT) : 'Не указано'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Срок</Label>
                        <p className="text-sm">
                          {project.contract.serviceStartDate && `${new Date(project.contract.serviceStartDate).toLocaleDateString('ru-RU')} - `}
                          {new Date(project.contract.serviceEndDate).toLocaleDateString('ru-RU')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button onClick={() => navigate(`/project/${project.id}`)} variant="outline" className="whitespace-nowrap">
                      <Eye className="w-4 h-4 mr-2" />
                      Открыть
                    </Button>
                    <Button onClick={() => setSelectedProject(project)} className="whitespace-nowrap">
                      <Users className="w-4 h-4 mr-2" />
                      Назначить команду
                    </Button>
                    {isAdmin && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" className="whitespace-nowrap">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Удалить
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                              <AlertTriangle className="w-5 h-5 text-red-500" />
                              Удаление проекта
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Вы уверены, что хотите удалить проект "{project.name}"?
                              <br /><br />
                              Это действие нельзя отменить. Все данные проекта будут безвозвратно удалены.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Отмена</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteProject(project)}
                              className="bg-red-600 hover:bg-red-700"
                              disabled={isDeleting}
                            >
                              {isDeleting ? 'Удаление...' : 'Удалить проект'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                    </div>
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
              <Card className="p-4 bg-secondary/20 dark:bg-secondary/30 border-l-4 border-primary">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
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
                  <TeamAssignment
                    employees={realEmployees}
                    teamSlots={teamMembers}
                    slots={PROJECT_ROLES
                      .filter(pr => !['ceo', 'deputy_director', 'hr', 'procurement', 'admin', 'company_director', 'contractor', 'accountant', 'admin_staff'].includes(pr.role))
                      .map(pr => ({
                        key: pr.role,
                        label: pr.label,
                        roles: [pr.role]
                      }))
                    }
                    onChange={(newTeam) => {
                      setTeamMembers(newTeam as any);
                    }}
                    selectedSlots={selectedRoles}
                    onToggleSlot={(role, checked) => {
                      if (role === 'partner') return;
                      setSelectedRoles({...selectedRoles, [role]: checked});
                      if (!checked) {
                        const newTeam = {...teamMembers};
                        delete newTeam[role];
                        setTeamMembers(newTeam);
                      }
                    }}
                    disabledSlots={['partner']}
                    onAddNewEmployee={(role) => {
                      setAddingNewForRole(role);
                      setNewEmpName('');
                    }}
                  />
                </div>
              </div>
{/* Настройки видимости финансовой информации */}
              <Card className="p-4 border-l-4 border-blue-500">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="showFinancialInfo"
                      checked={showFinancialInfo}
                      onChange={(e) => {
                        setShowFinancialInfo(e.target.checked);
                        if (!e.target.checked) {
                          setFinancialVisibleTo([]);
                        }
                      }}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <Label htmlFor="showFinancialInfo" className="font-semibold cursor-pointer text-base">
                      Показывать финансовую информацию команде
                    </Label>
                  </div>

                  {showFinancialInfo && (
                    <div className="ml-7 space-y-3">
                      <Label className="text-sm text-muted-foreground">
                        Выберите кому показывать сумму проекта:
                      </Label>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {PROJECT_ROLES
                          .filter(role => teamMembers[role.role])
                          .map(role => {
                            const memberId = teamMembers[role.role];
                            const employee = availableEmployees.find(e => e.id === memberId);
                            const memberName = employee?.name || `Сотрудник ${memberId}`;
                            
                            return (
                              <div key={role.role} className="flex items-center gap-3 p-2 rounded hover:bg-secondary/50">
                                <input
                                  type="checkbox"
                                  id={`financial-visible-${role.role}`}
                                  checked={financialVisibleTo.includes(memberId)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setFinancialVisibleTo([...financialVisibleTo, memberId]);
                                    } else {
                                      setFinancialVisibleTo(financialVisibleTo.filter(id => id !== memberId));
                                    }
                                  }}
                                  className="w-4 h-4 rounded border-gray-300"
                                />
                                <Label htmlFor={`financial-visible-${role.role}`} className="text-sm cursor-pointer flex-1">
                                  <span className="font-medium">{memberName}</span>
                                  <span className="text-muted-foreground ml-2">({ROLE_LABELS[role.role as UserRole] || role.label})</span>
                                </Label>
                              </div>
                            );
                          })}
                        {PROJECT_ROLES.filter(role => teamMembers[role.role]).length === 0 && (
                          <div className="text-sm text-muted-foreground p-2">
                            Сначала назначьте команду проекта
                          </div>
                        )}
                      </div>
                      {PROJECT_ROLES.filter(role => teamMembers[role.role]).length > 0 && (
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const allMemberIds = PROJECT_ROLES
                                .filter(role => teamMembers[role.role])
                                .map(role => teamMembers[role.role]);
                              setFinancialVisibleTo(allMemberIds);
                            }}
                          >
                            Выбрать всех
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setFinancialVisibleTo([])}
                          >
                            Снять все
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>

              {/* ГПХ и Субподряд */}
              <Card className="p-4">
                <h3 className="font-semibold flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-primary" />
                  ГПХ и Субподряд
                </h3>

                {/* Список добавленных ГПХ/Субподрядчиков */}
                {contractors.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {contractors.map((contractor) => (
                      <div key={contractor.id} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                        <div>
                          <span className="font-medium">{contractor.name}</span>
                          {contractor.type && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              {contractor.type === 'subcontract' ? 'Субподряд' : 'ГПХ'}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {contractor.amount.toLocaleString()} ₸
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeContractor(contractor.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Форма добавления */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Select value={newContractorType} onValueChange={(v: 'gph' | 'subcontract') => setNewContractorType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gph">ГПХ</SelectItem>
                      <SelectItem value="subcontract">Субподряд</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="ФИО / Название"
                    value={newContractorName}
                    onChange={(e) => setNewContractorName(e.target.value)}
                  />
                  <Input
                    type="number"
                    placeholder="Сумма"
                    value={newContractorAmount}
                    onChange={(e) => setNewContractorAmount(e.target.value)}
                  />
                  <Button onClick={addContractor} variant="outline">
                    <Plus className="w-4 h-4 mr-1" />
                    Добавить
                  </Button>
                </div>
              </Card>

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
