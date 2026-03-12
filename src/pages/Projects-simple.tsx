import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { TaskManager } from "@/components/tasks/TaskManager";
import { Task, Project as ProjectType, ChecklistItem, PriorityLevel, TaskStatus } from "@/types/project";
import { Plus, Search, Calendar, Users, ArrowRight, CheckSquare, Clock, Circle, AlertCircle, XCircle, BarChart3, Trash2, Download, Upload, FileDown } from "lucide-react";
import { useProjects, useEmployees, useCompanies } from "@/hooks/useSupabaseData";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabaseDataStore } from "@/lib/supabaseDataStore";
import { exportProjectsToExcel, importProjectsFromExcel, downloadImportTemplate, saveImportedProjects } from "@/lib/excelExport";
import { supabase } from "@/integrations/supabase/client";
import { notifyTeamAssembled, notifyTeamMemberAdded } from "@/lib/projectNotifications";
import { useAppSettings } from "@/lib/appSettings";
import { ALL_AUDIT_TEMPLATES } from "@/lib/auditTemplates";
import { QuickPriceEditor } from "@/components/projects/QuickPriceEditor";
import { ContractStagesEditor } from "@/components/projects/ContractStagesEditor";
import { ProjectCurrency, ProjectStage, CURRENCY_SYMBOLS } from "@/types/project-v3";

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
  const { projects: realProjects, loading, deleteProject: deleteProjectFromStore, refresh: refreshProjects } = useProjects();
  const { employees = [] } = useEmployees();
  const { companies: allAppCompanies = [] } = useCompanies();
  const [appSettings] = useAppSettings();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredProjects, setFilteredProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<any | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const navigate = useNavigate();

  // State для распределения команды (только для зам. директора)
  const [projectForTeamDistribution, setProjectForTeamDistribution] = useState<any | null>(null);
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<string[]>([]);
  const [teamDistributionRoleFilter, setTeamDistributionRoleFilter] = useState<string>('all');
  const [newProject, setNewProject] = useState({
    name: "",
    company: "",
    deadline: "",
    status: "Черновик",
    budget: ""
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Базовые фильтры
  const [filterYear, setFilterYear] = useState<string>('all'); // 'all' | '2022' | '2023' | '2024' | '2025' и т.д.
  const [filterCompany, setFilterCompany] = useState<string>('all'); // 'all' | конкретная компания
  const [filterLongTerm, setFilterLongTerm] = useState<boolean | 'all'>('all'); // 'all' | true | false
  const [showAmounts, setShowAmounts] = useState<boolean>(true); // Показывать ли суммы

  // Фильтры по колонкам
  const [filterStatus, setFilterStatus] = useState<string>('all'); // 'all' | 'new' | 'pending_approval' | 'in_progress' | 'completed'
  const [filterProgressMin, setFilterProgressMin] = useState<number | ''>('');
  const [filterProgressMax, setFilterProgressMax] = useState<number | ''>('');
  const [filterAmountMin, setFilterAmountMin] = useState<number | ''>('');
  const [filterAmountMax, setFilterAmountMax] = useState<number | ''>('');
  const [filterHasTeam, setFilterHasTeam] = useState<boolean | 'all'>('all'); // 'all' | true | false
  const [filterHasTasks, setFilterHasTasks] = useState<boolean | 'all'>('all'); // 'all' | true | false
  const [filterDeadlineFrom, setFilterDeadlineFrom] = useState<string>('');
  const [filterDeadlineTo, setFilterDeadlineTo] = useState<string>('');

  // Сортировка
  type SortOption = 'deadline_asc' | 'deadline_desc' | 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc' | 'name_asc' | 'name_desc';
  const [sortBy, setSortBy] = useState<SortOption>('deadline_asc'); // По умолчанию: ближайшие дедлайны сверху

  // Массовые действия (только для CEO)
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const [isDeletingMultiple, setIsDeletingMultiple] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [bulkStatusDialogOpen, setBulkStatusDialogOpen] = useState(false);

  // Проверка прав администратора
  const isAdmin = user?.role === 'ceo';

  // Функции экспорта/импорта
  const handleExportProjects = () => {
    try {
      exportProjectsToExcel(filteredProjects, `projects_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast({
        title: "✅ Экспорт завершен",
        description: `Экспортировано ${filteredProjects.length} проектов`,
      });
    } catch (error) {
      console.error('Ошибка экспорта:', error);
      toast({
        title: "❌ Ошибка экспорта",
        description: "Не удалось экспортировать проекты",
        variant: "destructive",
      });
    }
  };

  const handleDownloadTemplate = () => {
    try {
      downloadImportTemplate();
      toast({
        title: "✅ Шаблон скачан",
        description: "Файл template_import_projects.xlsx сохранен",
      });
    } catch (error) {
      console.error('Ошибка скачивания шаблона:', error);
      toast({
        title: "❌ Ошибка",
        description: "Не удалось скачать шаблон",
        variant: "destructive",
      });
    }
  };

  const handleImportFile = async (file: File) => {
    setIsImporting(true);
    try {
      const { projects, errors } = await importProjectsFromExcel(file);

      // Если есть ошибки валидации, показываем предупреждение, но продолжаем импорт
      if (errors.length > 0 && projects.length === 0) {
        // Если нет проектов для импорта из-за ошибок - критическая ошибка
        toast({
          title: "❌ Ошибка импорта",
          description: `Не удалось импортировать проекты. Найдено ${errors.length} ошибок валидации. Проверьте данные в Excel файле.`,
          variant: "destructive",
        });
        console.error('Ошибки валидации:', errors);
        setIsImportDialogOpen(false);
        return;
      }

      if (errors.length > 0 && projects.length > 0) {
        // Есть ошибки в некоторых строках, но часть проектов валидна
        toast({
          title: "⚠️ Частичный импорт",
          description: `Импортировано ${projects.length} проектов. ${errors.length} строк пропущено из-за ошибок.`,
          variant: "default",
        });
        console.warn('Предупреждения валидации:', errors);
      }

      if (projects.length > 0) {
        const result = await saveImportedProjects(projects);

        if (result.success > 0) {
          // Перезагружаем список проектов
          if (refreshProjects) {
            await refreshProjects();
          } else {
            // Fallback: перезагружаем страницу через 1 секунду
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          }

          toast({
            title: "✅ Импорт завершен",
            description: `Успешно импортировано: ${result.success} проектов${result.failed > 0 ? `. Не удалось: ${result.failed}` : ''}`,
          });
          setIsImportDialogOpen(false);
        } else {
          toast({
            title: "❌ Ошибка импорта",
            description: `Не удалось импортировать проекты. Ошибок: ${result.failed}`,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "❌ Нет данных для импорта",
          description: "Не удалось импортировать проекты. Проверьте формат файла.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Ошибка импорта:', error);
      toast({
        title: "❌ Ошибка импорта",
        description: error?.message || "Не удалось импортировать проекты",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  // Функции для массового удаления
  const toggleProjectSelection = useCallback((projectId: string) => {
    setSelectedProjectIds(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  }, []);

  const selectAllProjects = useCallback(() => {
    const validProjects = filteredProjects
      .map(p => p.id || p.notes?.id)
      .filter((id): id is string => Boolean(id));

    if (selectedProjectIds.size === validProjects.length && validProjects.length > 0) {
      setSelectedProjectIds(new Set());
    } else {
      setSelectedProjectIds(new Set(validProjects));
    }
  }, [filteredProjects, selectedProjectIds.size]);

  const handleBulkDelete = async () => {
    if (selectedProjectIds.size === 0) return;

    if (!window.confirm(`Удалить ${selectedProjectIds.size} проектов? Это действие нельзя отменить.`)) {
      return;
    }

    setIsDeletingMultiple(true);
    let success = 0;
    let failed = 0;

    try {
      for (const projectId of selectedProjectIds) {
        try {
          await deleteProjectFromStore(projectId);
          success++;
        } catch (error) {
          console.error(`Ошибка удаления проекта ${projectId}:`, error);
          failed++;
        }
      }

      toast({
        title: success > 0 ? "✅ Проекты удалены" : "❌ Ошибка",
        description: `Успешно: ${success}, Ошибок: ${failed}`,
        variant: failed > 0 ? "destructive" : "default",
      });

      setSelectedProjectIds(new Set());
      if (refreshProjects) {
        await refreshProjects();
      }
    } catch (error) {
      toast({
        title: "❌ Ошибка",
        description: "Не удалось удалить проекты",
        variant: "destructive",
      });
    } finally {
      setIsDeletingMultiple(false);
    }
  };

  // Массовое изменение статуса
  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedProjectIds.size === 0) return;

    setIsChangingStatus(true);
    let success = 0;
    let failed = 0;

    try {
      for (const projectId of selectedProjectIds) {
        try {
          // Находим проект
          const project = realProjects.find(p => (p.id || p.notes?.id) === projectId);
          if (!project) {
            failed++;
            continue;
          }

          // Обновляем статус в notes
          const notes = project.notes || {};
          const updatedNotes = {
            ...notes,
            status: newStatus
          };

          // Обновляем проект в Supabase
          const supabaseId = project.id;
          if (supabaseId) {
            // Определяем статус для Supabase
            let supabaseStatus = 'active';
            if (newStatus === 'archived' || newStatus === 'completed') {
              supabaseStatus = 'completed';
            } else if (newStatus === 'in_progress') {
              supabaseStatus = 'in_progress';
            }

            const { error } = await supabase
              .from('projects')
              .update({
                notes: updatedNotes,
                status: supabaseStatus
              })
              .eq('id', supabaseId);

            if (error) throw error;
            success++;
          } else {
            failed++;
          }
        } catch (error) {
          console.error(`Ошибка изменения статуса проекта ${projectId}:`, error);
          failed++;
        }
      }

      toast({
        title: success > 0 ? "✅ Статус изменен" : "❌ Ошибка",
        description: `Успешно изменено: ${success}${failed > 0 ? `. Не удалось: ${failed}` : ''}`,
        variant: failed > 0 ? "destructive" : "default",
      });

      if (success > 0) {
        setSelectedProjectIds(new Set());
        setBulkStatusDialogOpen(false);
        if (refreshProjects) {
          await refreshProjects();
        }
      }
    } catch (error) {
      console.error('Ошибка массового изменения статуса:', error);
      toast({
        title: "❌ Ошибка",
        description: "Не удалось изменить статус проектов",
        variant: "destructive",
      });
    } finally {
      setIsChangingStatus(false);
    }
  };

  // Функция удаления проекта
  const handleDeleteProject = async (projectId: string) => {
    try {
      await deleteProjectFromStore(projectId);
      toast({
        title: "✅ Проект удален",
        description: "Проект успешно удален из системы.",
      });
      setIsDeleteDialogOpen(false);
      setProjectToDelete(null);
    } catch (error) {
      console.error('❌ Ошибка при удалении проекта:', error);
      toast({
        title: "❌ Ошибка",
        description: "Не удалось удалить проект. Попробуйте ещё раз.",
        variant: "destructive",
      });
    }
  };

  // Мемоизированные списки годов и компаний
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    realProjects.forEach(project => {
      const deadline = project.contract?.serviceEndDate || project.deadline || project.notes?.contract?.serviceEndDate || project.contract?.date;
      if (deadline) {
        try {
          const date = new Date(deadline);
          if (!isNaN(date.getTime())) {
            const year = date.getFullYear().toString();
            if (!isNaN(Number(year))) years.add(year);
          }
        } catch { }
      }
    });
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [realProjects]);

  // Маппинг компаний для красивого отображения
  const companyDisplayMap: Record<string, string> = {
    'MAK': 'ТОО МАК',
    'МАК': 'ТОО МАК',
    'ТОО МАК': 'ТОО МАК',
    'МКФ': 'ТОО МКФ',
    'ТОО МКФ': 'ТОО МКФ',
    'ЧК': 'Частная компания',
    'Parker Consulting & Appraisal': 'Parker Consulting & Appraisal',
    'Parker Russell': 'Parker Russell',
    'RB Partners': 'RB Partners',
    'RB Partners IT Audit': 'RB Partners IT Audit',
    'Russell Bedford': 'Russell Bedford',
    'Anderson KZ': 'Anderson KZ',
    'Андерсон КЗ': 'Anderson KZ',
  };

  const availableCompanies = useMemo(() => {
    const companies = new Set<string>();
    realProjects.forEach(project => {
      const company = project.companyName || project.ourCompany || project.company || project.notes?.companyName || project.notes?.ourCompany;
      if (company && company.trim()) {
        const cleanCompany = company.trim();
        // Сохраняем оригинальное название для фильтрации, но используем красивое отображение
        companies.add(cleanCompany);
      }
    });
    return Array.from(companies).sort((a, b) => {
      const displayA = companyDisplayMap[a] || a;
      const displayB = companyDisplayMap[b] || b;
      return displayA.localeCompare(displayB, 'ru');
    });
  }, [realProjects]);

  // Функция для получения красивого названия компании
  const getCompanyDisplayName = useCallback((company: string): string => {
    return companyDisplayMap[company] || company;
  }, []);

  // Агрессивная функция получения суммы БЕЗ НДС - проверяет ВСЕ возможные места
  const getProjectAmount = useCallback((project: any): { amount: number | null; currency: string } => {
    // Функция для извлечения валюты из проекта
    const getCurrency = (): string => {
      // Проверяем все возможные места где может быть валюта
      const possibleCurrencies = [
        project.notes?.contract?.currency,
        project.notes?.currency,
        project.contract?.currency,
        project.currency,
        // Также проверяем если notes это строка
        (() => {
          try {
            if (typeof project.notes === 'string') {
              const parsed = JSON.parse(project.notes);
              return parsed?.contract?.currency || parsed?.currency;
            }
          } catch { }
          return null;
        })()
      ];

      for (const curr of possibleCurrencies) {
        if (curr && typeof curr === 'string' && ['KZT', 'USD', 'EUR', 'RUB'].includes(curr)) {
          return curr;
        }
      }
      return 'KZT';
    };

    // Полный список всех возможных путей к сумме
    const possibleAmounts = [
      project.notes?.finances?.amountWithoutVAT,
      project.notes?.contract?.amountWithoutVAT,
      project.notes?.amountWithoutVAT,
      project.notes?.amount,
      project.finances?.amountWithoutVAT,
      project.contract?.amountWithoutVAT,
      project.amountWithoutVAT,
      project.amount,
      // Также проверяем если notes это строка
      (() => {
        try {
          if (typeof project.notes === 'string') {
            const parsed = JSON.parse(project.notes);
            return parsed?.finances?.amountWithoutVAT || parsed?.contract?.amountWithoutVAT || parsed?.amountWithoutVAT || parsed?.amount;
          }
        } catch { }
        return null;
      })()
    ];

    // Ищем первое валидное число
    for (const amount of possibleAmounts) {
      if (amount != null) {
        let numAmount: number;
        if (typeof amount === 'number') {
          numAmount = amount;
        } else if (typeof amount === 'string') {
          numAmount = parseFloat(amount.replace(/[\s,]/g, ''));
        } else {
          numAmount = Number(amount);
        }

        if (!isNaN(numAmount) && isFinite(numAmount) && numAmount > 0) {
          return {
            amount: numAmount,
            currency: getCurrency()
          };
        }
      }
    }

    return { amount: null, currency: 'KZT' };
  }, []);

  // Агрессивная функция получения суммы С НДС
  const getProjectAmountWithVAT = useCallback((project: any): { amount: number | null; currency: string } => {
    // Сначала получаем валюту из getProjectAmount (единый источник)
    const baseResult = getProjectAmount(project);
    const currency = baseResult.currency;

    // Полный список всех возможных путей к сумме с НДС
    const possibleAmounts = [
      project.notes?.amountWithVAT,
      project.notes?.finances?.amountWithVAT,
      project.finances?.amountWithVAT,
      project.amountWithVAT,
      // Также проверяем если notes это строка
      (() => {
        try {
          if (typeof project.notes === 'string') {
            const parsed = JSON.parse(project.notes);
            return parsed?.amountWithVAT || parsed?.finances?.amountWithVAT;
          }
        } catch { }
        return null;
      })()
    ];

    // Ищем первое валидное число
    for (const amountWithVAT of possibleAmounts) {
      if (amountWithVAT != null) {
        let numAmount: number;
        if (typeof amountWithVAT === 'number') {
          numAmount = amountWithVAT;
        } else if (typeof amountWithVAT === 'string') {
          numAmount = parseFloat(amountWithVAT.replace(/[\s,]/g, ''));
        } else {
          numAmount = Number(amountWithVAT);
        }

        if (!isNaN(numAmount) && isFinite(numAmount) && numAmount > 0) {
          return { amount: numAmount, currency };
        }
      }
    }

    // Если суммы с НДС нет, рассчитываем: БЕЗ НДС * 1.12 (12% НДС в KZ)
    if (baseResult.amount) {
      return {
        amount: baseResult.amount * 1.12,
        currency
      };
    }

    return { amount: null, currency: 'KZT' };
  }, [getProjectAmount]);

  // Функция для определения срочности дедлайна
  type DeadlineUrgency = 'overdue' | 'critical' | 'warning' | 'normal' | 'none';

  const getDeadlineUrgency = useCallback((project: any): { urgency: DeadlineUrgency; daysLeft: number | null; deadline: Date | null } => {
    const deadlineStr = project.contract?.serviceEndDate || project.deadline || project.notes?.contract?.serviceEndDate || project.notes?.deadline;

    if (!deadlineStr) {
      return { urgency: 'none', daysLeft: null, deadline: null };
    }

    try {
      const deadline = new Date(deadlineStr);
      if (isNaN(deadline.getTime())) {
        return { urgency: 'none', daysLeft: null, deadline: null };
      }

      const now = new Date();
      now.setHours(0, 0, 0, 0);
      deadline.setHours(0, 0, 0, 0);

      const diffTime = deadline.getTime() - now.getTime();
      const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (daysLeft < 0) {
        return { urgency: 'overdue', daysLeft, deadline };
      } else if (daysLeft <= 3) {
        return { urgency: 'critical', daysLeft, deadline };
      } else if (daysLeft <= 7) {
        return { urgency: 'warning', daysLeft, deadline };
      } else {
        return { urgency: 'normal', daysLeft, deadline };
      }
    } catch {
      return { urgency: 'none', daysLeft: null, deadline: null };
    }
  }, []);

  // Счётчик срочных проектов
  const urgentProjectsStats = useMemo(() => {
    let overdue = 0;
    let critical = 0; // 0-3 дня
    let warning = 0;  // 4-7 дней
    const urgentProjects: Array<{ project: any; urgency: DeadlineUrgency; daysLeft: number }> = [];

    realProjects.forEach(project => {
      // Пропускаем завершённые проекты
      const status = project.notes?.status || project.status;
      if (status === 'completed') return;

      const { urgency, daysLeft } = getDeadlineUrgency(project);

      if (urgency === 'overdue') {
        overdue++;
        urgentProjects.push({ project, urgency, daysLeft: daysLeft! });
      } else if (urgency === 'critical') {
        critical++;
        urgentProjects.push({ project, urgency, daysLeft: daysLeft! });
      } else if (urgency === 'warning') {
        warning++;
        urgentProjects.push({ project, urgency, daysLeft: daysLeft! });
      }
    });

    // Сортируем по срочности (просроченные первыми)
    urgentProjects.sort((a, b) => a.daysLeft - b.daysLeft);

    return { overdue, critical, warning, total: overdue + critical + warning, urgentProjects };
  }, [realProjects, getDeadlineUrgency]);

  // Получаем все уникальные статусы для фильтра
  const availableStatuses = useMemo(() => {
    const statuses = new Set<string>();
    realProjects.forEach(project => {
      const notesStatus = project.notes?.status;
      let status = '';
      if (notesStatus === 'new' || notesStatus === 'pending_approval') {
        status = 'Партнер не утвержден';
      } else if (notesStatus === 'approved' && (!project.team || project.team.length === 0)) {
        status = 'Ожидает распределения команды';
      } else {
        const statusMap: Record<string, string> = {
          'active': 'Активный',
          'in_progress': 'В работе',
          'completed': 'Завершён',
        };
        status = statusMap[project.status || notesStatus || 'active'] || 'Активный';
      }
      if (status) statuses.add(status);
    });
    return Array.from(statuses).sort();
  }, [realProjects]);

  // Функции для статусов проектов
  const getProjectStatusLabel = useCallback((project: any): string => {
    // Проверяем notes для точного статуса
    const notesStatus = project.notes?.status;

    // Если статус 'new' или 'pending_approval' - партнер не утвердил
    if (notesStatus === 'new' || notesStatus === 'pending_approval') {
      return 'Партнер не утвержден';
    }

    // Если статус 'approved' но нет команды - ожидает распределения команды
    if (notesStatus === 'approved' && (!project.team || project.team.length === 0)) {
      return 'Ожидает распределения команды';
    }

    // Стандартные статусы
    const statusMap: Record<string, string> = {
      'active': 'Активный',
      'in_progress': 'В работе',
      'completed': 'Завершён',
      'pre_approval': 'На утверждении',
      'partner_assigned': 'Партнер назначен',
      'pm_assigned': 'РП назначен',
      'team_assembled': 'Команда собрана',
      'qa_review': 'На проверке',
      'client_signoff': 'Ожидает подписи клиента',
      'closed': 'Закрыт',
      'archived': 'Архивирован'
    };

    const status = project.status || notesStatus || 'active';
    return statusMap[status] || status;
  }, []);

  const getProjectStatusColor = useCallback((project: any): string => {
    const notesStatus = project.notes?.status;

    if (notesStatus === 'new' || notesStatus === 'pending_approval') {
      return 'bg-yellow-500'; // Жёлтый для ожидания утверждения
    }

    if (notesStatus === 'approved' && (!project.team || project.team.length === 0)) {
      return 'bg-orange-500'; // Оранжевый для ожидания команды
    }

    const status = project.status || notesStatus || 'active';
    switch (status) {
      case 'in_progress': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
      case 'active': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  }, []);

  // Получить проекты, ожидающие распределения команды
  const getProjectsAwaitingTeam = useMemo(() => {
    return filteredProjects.filter(project => {
      const notesStatus = project.notes?.status;
      return (notesStatus === 'approved' || notesStatus === 'pending_approval') &&
        (!project.team || project.team.length === 0);
    });
  }, [filteredProjects]);

  // Функция открытия диалога распределения команды
  const openTeamDistribution = (project: any) => {
    setProjectForTeamDistribution(project);
    setSelectedTeamMembers(project.team || []);
  };

  // Функция сохранения команды
  const handleSaveTeamDistribution = async () => {
    if (!projectForTeamDistribution || selectedTeamMembers.length === 0) {
      toast({
        title: "❌ Ошибка",
        description: "Выберите хотя бы одного участника команды",
        variant: "destructive",
      });
      return;
    }

    try {
      const projectId = projectForTeamDistribution.id || projectForTeamDistribution.notes?.id;
      const projectName = projectForTeamDistribution.name || projectForTeamDistribution.client?.name || 'Проект';

      // Формируем команду с ролями для уведомлений
      const teamWithRoles = selectedTeamMembers.map((memberId: string) => {
        const employee = employees.find((e: any) => e.id === memberId);
        return {
          userId: memberId,
          role: employee?.role || 'employee',
          name: employee?.name || 'Сотрудник'
        };
      });

      // Обновляем проект с командой через Supabase
      const updatedNotes = {
        ...projectForTeamDistribution.notes,
        team: teamWithRoles,
        status: 'team_assembled', // Меняем статус на "команда собрана"
      };

      await supabaseDataStore.updateProject(projectId, {
        ...projectForTeamDistribution,
        notes: updatedNotes,
        team: teamWithRoles,
      });

      // Отправляем уведомления всем участникам команды
      const deputyDirectorName = user?.name || 'Заместитель директора';
      const teamIds = teamWithRoles.map((m: any) => m.userId);

      // Уведомляем всех участников команды
      notifyTeamAssembled({
        projectName,
        teamIds,
        projectId,
        pmName: deputyDirectorName
      });

      // Дополнительно уведомляем каждого участника индивидуально
      teamWithRoles.forEach((member: any) => {
        const employee = employees.find((e: any) => e.id === member.userId);
        if (employee) {
          notifyTeamMemberAdded({
            projectName,
            memberId: member.userId,
            memberName: employee.name,
            role: employee.role || 'Сотрудник',
            assignerName: deputyDirectorName,
            projectId
          });
        }
      });

      toast({
        title: "✅ Команда распределена",
        description: `Команда из ${selectedTeamMembers.length} участников назначена на проект. Уведомления отправлены.`,
      });

      setProjectForTeamDistribution(null);
      setSelectedTeamMembers([]);

      if (refreshProjects) {
        await refreshProjects();
      }
    } catch (error) {
      console.error('Ошибка распределения команды:', error);
      toast({
        title: "❌ Ошибка",
        description: "Не удалось распределить команду",
        variant: "destructive",
      });
    }
  };

  // Функция проверки долгосрочности проекта
  const isLongTermProject = (project: any): boolean => {
    const startDate = project.contract?.serviceStartDate || project.start_date || project.contract?.date;
    const endDate = project.contract?.serviceEndDate || project.deadline;
    if (!startDate || !endDate) return false;

    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;

      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = diffTime / (1000 * 60 * 60 * 24);

      return diffDays > 365; // Больше года = долгосрочный
    } catch {
      return false;
    }
  };

  // Основная функция фильтрации
  useEffect(() => {
    console.log('📦 Загружены проекты:', realProjects.length);

    // Дедупликация по уникальному ключу (UUID из Supabase или комбинация name+contractNumber)
    const uniqueProjects = realProjects.filter((project, index, self) => {
      // Если есть UUID из Supabase - используем его
      if (project.id && typeof project.id === 'string' && project.id.length > 10) {
        return index === self.findIndex(p => p.id === project.id);
      }
      // Иначе по комбинации name + contractNumber
      const key = `${project.name || project.client?.name || ''}_${project.contractNumber || project.contract?.number || ''}`;
      return index === self.findIndex(p => {
        const pKey = `${p.name || p.client?.name || ''}_${p.contractNumber || p.contract?.number || ''}`;
        return pKey === key && pKey !== '_';
      });
    });

    console.log('📦 Уникальных проектов после дедупликации:', uniqueProjects.length);

    // ИСКЛЮЧАЕМ проекты на утверждении (new/pending_approval) из общего списка
    // ФИЛЬТРАЦИЯ ПРОЕКТОВ ПО РОЛИ ПОЛЬЗОВАТЕЛЯ
    // Каждая роль видит только свои проекты
    let filtered = uniqueProjects.filter(project => {
      if (!user) return false;

      const notesStatus = project.notes?.status;
      const team = project.team || project.notes?.team || [];
      const createdBy = project.createdBy || project.notes?.createdBy;

      // Проверка: пользователь в команде проекта
      const isInTeam = team.some((member: any) => {
        const memberId = member.userId || member.id || member.employeeId;
        return memberId === user.id;
      });

      // Админ и CEO видят ВСЕ проекты
      if (user.role === 'admin' || user.role === 'ceo') {
        return true;
      }

      // Заместитель директора видит все кроме черновиков
      if (user.role === 'deputy_director') {
        return notesStatus !== 'draft';
      }

      // Отдел закупок видит ВСЕ проекты (они создают проекты для всех)
      if (user.role === 'procurement') {
        return true;
      }

      // Партнёр видит только проекты где он назначен партнёром
      if (user.role === 'partner') {
        // Не показываем проекты на утверждении
        if (notesStatus === 'new' || notesStatus === 'pending_approval') {
          return false;
        }
        const isPartnerInTeam = team.some((member: any) => {
          const memberId = member.userId || member.id || member.employeeId;
          const memberRole = member.role || member.role_on_project;
          return memberId === user.id && memberRole === 'partner';
        });
        return isPartnerInTeam;
      }

      // Менеджеры видят только проекты где они в команде
      if (user.role === 'manager_1' || user.role === 'manager_2' || user.role === 'manager_3') {
        // Не показываем проекты на утверждении
        if (notesStatus === 'new' || notesStatus === 'pending_approval') {
          return false;
        }
        return isInTeam;
      }

      // HR видит все проекты для управления персоналом
      if (user.role === 'hr') {
        return notesStatus !== 'new' && notesStatus !== 'pending_approval';
      }

      // Аудиторы и ассистенты видят ТОЛЬКО проекты где они назначены
      if (['senior_auditor', 'auditor', 'junior_auditor', 'assistant'].includes(user.role)) {
        // Не показываем проекты на утверждении
        if (notesStatus === 'new' || notesStatus === 'pending_approval') {
          return false;
        }
        return isInTeam;
      }

      // По умолчанию: проект в команде и не на утверждении
      if (notesStatus === 'new' || notesStatus === 'pending_approval') {
        return false;
      }
      return isInTeam;
    });

    console.log(`🔍 [Projects] Фильтрация для ${user?.role} (${user?.id}): показано ${filtered.length} из ${uniqueProjects.length} проектов`);

    // 1. Поиск по тексту (существующий)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(project => {
        const name = (project.name || project.client?.name || '').toLowerCase();
        const clientName = (project.clientName || '').toLowerCase();
        const contractNumber = (project.contract?.number || project.contractNumber || '').toLowerCase();
        return name.includes(query) || clientName.includes(query) || contractNumber.includes(query);
      });
    }

    // 2. Фильтр по году
    if (filterYear !== 'all') {
      filtered = filtered.filter(project => {
        const deadline = project.contract?.serviceEndDate || project.deadline || project.contract?.date;
        if (!deadline) return false;
        try {
          const year = new Date(deadline).getFullYear().toString();
          return year === filterYear;
        } catch {
          return false;
        }
      });
    }

    // 3. Фильтр по компании (нечёткий поиск — убираем юр. префиксы и ищем по ядру)
    if (filterCompany !== 'all') {
      // Удаляем юридические префиксы и нормализуем строку
      const stripLegal = (s: string) => s
        .toLowerCase()
        .replace(/\b(тоо|чк|ао|оао|зао|оо|ип|пао|нко|филиал|branch|llp|ltd|inc|llc)\b/gi, '')
        .replace(/[.,\-"«»]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      const filterCore = stripLegal(filterCompany);

      filtered = filtered.filter(project => {
        const rawCompany = project.companyName || project.ourCompany || project.company
          || project.notes?.companyName || project.notes?.ourCompany || '';
        if (!rawCompany) return false;
        const projectCore = stripLegal(rawCompany);
        // Совпадение если одно содержит другое (оба направления)
        return projectCore.includes(filterCore) || filterCore.includes(projectCore) || rawCompany === filterCompany;
      });
    }

    // 4. Фильтр по долгосрочным проектам
    if (filterLongTerm !== 'all') {
      filtered = filtered.filter(project => {
        const isLongTerm = isLongTermProject(project);
        return filterLongTerm === true ? isLongTerm : !isLongTerm;
      });
    }

    // 5. Фильтр по статусу
    if (filterStatus !== 'all') {
      filtered = filtered.filter(project => {
        const projectStatusLabel = getProjectStatusLabel(project);
        return projectStatusLabel === filterStatus;
      });
    }

    // 6. Фильтр по прогрессу
    if (filterProgressMin !== '' || filterProgressMax !== '') {
      filtered = filtered.filter(project => {
        const progress = project.completionPercent || project.completion || 0;
        if (filterProgressMin !== '' && progress < filterProgressMin) return false;
        if (filterProgressMax !== '' && progress > filterProgressMax) return false;
        return true;
      });
    }

    // 7. Фильтр по сумме
    if (filterAmountMin !== '' || filterAmountMax !== '') {
      filtered = filtered.filter(project => {
        const { amount } = getProjectAmount(project);
        if (amount === null) return false;
        if (filterAmountMin !== '' && amount < filterAmountMin) return false;
        if (filterAmountMax !== '' && amount > filterAmountMax) return false;
        return true;
      });
    }

    // 8. Фильтр по наличию команды
    if (filterHasTeam !== 'all') {
      filtered = filtered.filter(project => {
        const team = project.team || project.notes?.team || [];
        const hasTeam = team.length > 0;
        return filterHasTeam === hasTeam;
      });
    }

    // 9. Фильтр по наличию задач
    if (filterHasTasks !== 'all') {
      filtered = filtered.filter(project => {
        const tasks = project.tasks || [];
        const hasTasks = tasks.length > 0;
        return filterHasTasks === hasTasks;
      });
    }

    // 10. Фильтр по дедлайну (диапазон дат)
    if (filterDeadlineFrom || filterDeadlineTo) {
      filtered = filtered.filter(project => {
        const deadline = project.contract?.serviceEndDate || project.deadline || project.notes?.contract?.serviceEndDate;
        if (!deadline) return false;

        try {
          const deadlineDate = new Date(deadline);
          if (isNaN(deadlineDate.getTime())) return false;

          if (filterDeadlineFrom) {
            const fromDate = new Date(filterDeadlineFrom);
            if (deadlineDate < fromDate) return false;
          }

          if (filterDeadlineTo) {
            const toDate = new Date(filterDeadlineTo);
            // Добавляем день чтобы включить конечную дату
            toDate.setDate(toDate.getDate() + 1);
            if (deadlineDate >= toDate) return false;
          }

          return true;
        } catch {
          return false;
        }
      });
    }

    // 11. Сортировка
    filtered.sort((a, b) => {
      const getDeadline = (p: any) => {
        const deadline = p.contract?.serviceEndDate || p.deadline || p.notes?.contract?.serviceEndDate || p.notes?.deadline;
        if (!deadline) return Infinity;
        try {
          const date = new Date(deadline);
          return isNaN(date.getTime()) ? Infinity : date.getTime();
        } catch {
          return Infinity;
        }
      };

      const getContractDate = (p: any) => {
        const date = p.contract?.date || p.notes?.contract?.date || p.created_at || p.notes?.created_at;
        if (!date) return 0;
        try {
          const d = new Date(date);
          return isNaN(d.getTime()) ? 0 : d.getTime();
        } catch {
          return 0;
        }
      };

      const getName = (p: any) => (p.name || p.client?.name || '').toLowerCase();

      switch (sortBy) {
        case 'deadline_asc': {
          // Ближайшие дедлайны сверху
          const deadlineA = getDeadline(a);
          const deadlineB = getDeadline(b);
          return deadlineA - deadlineB;
        }
        case 'deadline_desc': {
          // Дальние дедлайны сверху
          const deadlineA = getDeadline(a);
          const deadlineB = getDeadline(b);
          return deadlineB - deadlineA;
        }
        case 'date_desc': {
          // Новые проекты сверху (по дате договора)
          return getContractDate(b) - getContractDate(a);
        }
        case 'date_asc': {
          // Старые проекты сверху
          return getContractDate(a) - getContractDate(b);
        }
        case 'amount_desc': {
          // По сумме (большие сверху)
          const amountA = getProjectAmount(a).amount || 0;
          const amountB = getProjectAmount(b).amount || 0;
          return amountB - amountA;
        }
        case 'amount_asc': {
          // По сумме (маленькие сверху)
          const amountA = getProjectAmount(a).amount || 0;
          const amountB = getProjectAmount(b).amount || 0;
          return amountA - amountB;
        }
        case 'name_asc': {
          return getName(a).localeCompare(getName(b), 'ru');
        }
        case 'name_desc': {
          return getName(b).localeCompare(getName(a), 'ru');
        }
        default:
          return 0;
      }
    });

    setFilteredProjects(filtered);
  }, [realProjects, searchQuery, filterYear, filterCompany, filterLongTerm, filterStatus, filterProgressMin, filterProgressMax, filterAmountMin, filterAmountMax, filterHasTeam, filterHasTasks, filterDeadlineFrom, filterDeadlineTo, sortBy, getProjectStatusLabel, getProjectAmount]);


  // Получаем уникальные роли сотрудников для фильтра распределения команды
  const employeeRoles = useMemo(() => {
    const roles = new Set<string>();
    employees.forEach((emp: any) => {
      const role = emp.role || emp.position;
      if (role) roles.add(role);
    });
    return Array.from(roles).sort();
  }, [employees]);

  // Фильтруем сотрудников для диалога распределения
  const filteredEmployeesForDistribution = useMemo(() => {
    if (teamDistributionRoleFilter === 'all') return employees;
    return employees.filter((emp: any) => (emp.role || emp.position) === teamDistributionRoleFilter);
  }, [employees, teamDistributionRoleFilter]);

  // Функции для управления задачами
  const handleUpdateTask = (projectId: string, taskId: string, updates: Partial<Task>) => {
    setFilteredProjects(prev => prev.map(project => {
      if (project.id === projectId) {
        return {
          ...project,
          tasks: project.tasks?.map((task: Task) =>
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
          tasks: project.tasks?.filter((task: Task) => task.id !== taskId) || []
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
      // Проверяем что checklist существует
      if (!task.checklist || !Array.isArray(task.checklist)) {
        return acc;
      }
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

  // Функция расчета заполнения документов
  const getDocumentCompletion = useCallback((project: any) => {
    // Всего шаблонов
    const totalTemplates = ALL_AUDIT_TEMPLATES.length;

    // Проверяем заполненные документы в projectData или notes
    const projectData = project.projectData || project.notes?.projectData;
    const completedDocuments = projectData?.completedDocuments || project.notes?.completedDocuments || [];

    // Если есть данные о заполнении
    if (Array.isArray(completedDocuments) && completedDocuments.length > 0) {
      return {
        completed: completedDocuments.length,
        total: totalTemplates,
        percentage: Math.round((completedDocuments.length / totalTemplates) * 100)
      };
    }

    // Если нет данных - возвращаем 0
    return {
      completed: 0,
      total: totalTemplates,
      percentage: 0
    };
  }, []);

  const ProjectCard = ({ project }: { project: any }) => {
    const projectId = project.id || project.notes?.id;
    const projectName = project.name || project.client?.name || 'Без названия';
    const projectStatus = project.status || 'new';
    const projectCompany = project.companyName || project.company || project.ourCompany || 'Не указана';
    const projectCompletion = project.completionPercent || project.completion || 0;
    const projectDeadline = project.contract?.serviceEndDate || project.deadline || new Date().toISOString();
    const projectTeam = project.team?.length || 1;

    const stats = getProjectStats(project);
    const { amount, currency } = getProjectAmount(project);

    const handleCardClick = () => {
      if (!projectId) {
        navigate('/project-approval', { state: { project } });
        return;
      }
      navigate(`/project/${projectId}`, { state: { project } });
    };

    return (
      <Card
        className="p-6 hover:shadow-lg transition-all duration-200 border glass-card cursor-pointer relative"
        onClick={handleCardClick}
        data-testid="project-card"
      >
        {/* Чекбокс выбора - только для CEO */}
        {isAdmin && projectId && (
          <div className="absolute top-2 right-2 z-10" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={selectedProjectIds.has(projectId)}
              onChange={() => toggleProjectSelection(projectId)}
              className="w-5 h-5 cursor-pointer"
            />
          </div>
        )}
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-2 line-clamp-2">{projectName}</h3>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Badge variant="secondary" className={`text-white ${getProjectStatusColor(project)}`}>
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
          {/* Блок с суммой */}
          {showAmounts && amount && amount > 0 ? (
            <div className="mb-2 space-y-2">
              <div className="p-2 bg-primary/10 rounded text-sm">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <span className="text-muted-foreground">Без НДС: </span>
                    <span className="font-semibold text-primary">
                      {new Intl.NumberFormat('ru-RU', {
                        style: 'currency',
                        currency: currency,
                        maximumFractionDigits: 0
                      }).format(amount)}
                    </span>
                    {currency && currency !== 'KZT' && (
                      <span className="text-xs text-muted-foreground ml-1">({currency})</span>
                    )}
                  </div>
                  {/* Кнопка быстрого редактирования для procurement */}
                  {user?.role === 'procurement' && projectId && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <QuickPriceEditor
                        projectId={projectId}
                        projectName={projectName}
                        currentAmount={amount}
                        currentCurrency={currency as ProjectCurrency}
                        onSave={async (newAmount, newCurrency) => {
                          try {
                            await supabaseDataStore.updateProject(projectId, {
                              contract: {
                                ...(project.contract || {}),
                                amountWithoutVAT: newAmount,
                                currency: newCurrency,
                              },
                              finances: {
                                ...(project.finances || {}),
                                amountWithoutVAT: newAmount,
                              },
                              currency: newCurrency,
                              amountWithoutVAT: newAmount,
                            });
                            await refreshProjects();
                            toast({
                              title: "✅ Цена обновлена",
                              description: `${newAmount.toLocaleString()} ${newCurrency}`,
                            });
                          } catch (error) {
                            console.error('Error updating price:', error);
                            throw error;
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
                {/* Показываем НДС и сумму с НДС */}
                <div className="text-xs space-y-0.5 text-muted-foreground">
                  <div>
                    НДС 16%: {new Intl.NumberFormat('ru-RU', {
                      style: 'currency',
                      currency: currency,
                      maximumFractionDigits: 0
                    }).format(amount * 0.16)}
                  </div>
                  <div className="font-semibold">
                    С НДС: {new Intl.NumberFormat('ru-RU', {
                      style: 'currency',
                      currency: currency,
                      maximumFractionDigits: 0
                    }).format(amount * 1.16)}
                  </div>
                </div>
              </div>
              {/* Кнопка этапов договора для procurement */}
              {user?.role === 'procurement' && projectId && project.contract && (
                <div onClick={(e) => e.stopPropagation()}>
                  <ContractStagesEditor
                    projectId={projectId}
                    projectName={projectName}
                    totalAmount={amount || 0}
                    currency={currency as ProjectCurrency}
                    contractStartDate={project.contract.serviceStartDate || new Date().toISOString().split('T')[0]}
                    contractEndDate={project.contract.serviceEndDate || new Date().toISOString().split('T')[0]}
                    currentStages={project.stages || []}
                    onSave={async (stages: ProjectStage[]) => {
                      try {
                        await supabaseDataStore.updateProject(projectId, {
                          stages: stages,
                        });
                        await refreshProjects();
                        toast({
                          title: "✅ Этапы договора обновлены",
                          description: `Добавлено ${stages.length} этапов`,
                        });
                      } catch (error) {
                        console.error('Error saving stages:', error);
                        throw error;
                      }
                    }}
                  />
                </div>
              )}

              {/* Список этапов (если есть) */}
              {project.stages && project.stages.length > 0 && (
                <div className="mt-2 p-2 bg-secondary/10 rounded text-xs space-y-1">
                  <div className="font-semibold text-muted-foreground mb-1">Этапы договора:</div>
                  {project.stages.map((stage: ProjectStage, idx: number) => (
                    <div key={stage.id} className="flex justify-between items-center py-1 border-b border-border/50 last:border-0">
                      <span className="text-muted-foreground">{stage.name}</span>
                      <span className="font-mono font-semibold">
                        {stage.amountWithVAT.toLocaleString()} {CURRENCY_SYMBOLS[currency as ProjectCurrency]}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-1 font-semibold">
                    <span>Итого с НДС:</span>
                    <span className="font-mono">
                      {project.stages.reduce((sum: number, s: ProjectStage) => sum + s.amountWithVAT, 0).toLocaleString()} {CURRENCY_SYMBOLS[currency as ProjectCurrency]}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : showAmounts ? (
            <div className="mb-2 p-2 bg-muted/50 rounded flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Сумма не указана</span>
              {/* Кнопка добавления цены для procurement */}
              {user?.role === 'procurement' && projectId && (
                <div onClick={(e) => e.stopPropagation()}>
                  <QuickPriceEditor
                    projectId={projectId}
                    projectName={projectName}
                    currentAmount={undefined}
                    currentCurrency="KZT"
                    onSave={async (newAmount, newCurrency) => {
                      try {
                        await supabaseDataStore.updateProject(projectId, {
                          contract: {
                            ...(project.contract || {}),
                            amountWithoutVAT: newAmount,
                            currency: newCurrency,
                          },
                          finances: {
                            ...(project.finances || {}),
                            amountWithoutVAT: newAmount,
                          },
                          currency: newCurrency,
                          amountWithoutVAT: newAmount,
                        });
                        await refreshProjects();
                        toast({
                          title: "✅ Цена добавлена",
                          description: `${newAmount.toLocaleString()} ${newCurrency}`,
                        });
                      } catch (error) {
                        console.error('Error adding price:', error);
                        throw error;
                      }
                    }}
                  />
                </div>
              )}
            </div>
          ) : null}

          {/* Debug info (только в dev) */}
          {import.meta.env.DEV && (
            <div className="text-xs text-gray-400 mt-1">
              Debug: notes={!!project.notes}, amount={getProjectAmount(project).amount}
            </div>
          )}

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
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span className="text-xs">
                  {(() => {
                    try {
                      const date = new Date(projectDeadline);
                      if (isNaN(date.getTime())) return 'Не указано';
                      return date.toLocaleDateString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      });
                    } catch {
                      return 'Не указано';
                    }
                  })()}
                </span>
              </div>
              <span className="text-xs font-semibold text-primary ml-5">
                {(() => {
                  try {
                    const date = new Date(projectDeadline);
                    if (isNaN(date.getTime())) return '';
                    return date.getFullYear();
                  } catch {
                    return '';
                  }
                })()}
              </span>
            </div>
          </div>

          <div className="flex justify-between pt-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedProject(project);
              }}
            >
              <CheckSquare className="w-4 h-4 mr-1" />
              Задачи
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                if (projectId) {
                  navigate(`/project/${projectId}`, { state: { project } });
                } else {
                  navigate('/project-approval', { state: { project } });
                }
              }}
            >
              <ArrowRight className="w-4 h-4 mr-1" />
              Открыть
            </Button>
            {/* Кнопка распределения команды для зам. директора */}
            {user?.role === 'deputy_director' &&
              getProjectsAwaitingTeam.some(p => (p.id || p.notes?.id) === projectId) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    openTeamDistribution(project);
                  }}
                  className="mt-2"
                >
                  👥 Распределить команду
                </Button>
              )}
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setProjectToDelete(project);
                  setIsDeleteDialogOpen(true);
                }}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Уведомление о срочных дедлайнах */}
      {urgentProjectsStats.total > 0 && (
        <div className={`rounded-lg border p-4 ${urgentProjectsStats.overdue > 0
          ? 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
          : urgentProjectsStats.critical > 0
            ? 'bg-orange-50 border-orange-200 dark:bg-orange-950 dark:border-orange-800'
            : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800'
          }`}>
          <div className="flex items-start gap-3">
            <AlertCircle className={`w-5 h-5 mt-0.5 ${urgentProjectsStats.overdue > 0
              ? 'text-red-600 dark:text-red-400'
              : urgentProjectsStats.critical > 0
                ? 'text-orange-600 dark:text-orange-400'
                : 'text-yellow-600 dark:text-yellow-400'
              }`} />
            <div className="flex-1">
              <h3 className={`font-semibold ${urgentProjectsStats.overdue > 0
                ? 'text-red-800 dark:text-red-200'
                : urgentProjectsStats.critical > 0
                  ? 'text-orange-800 dark:text-orange-200'
                  : 'text-yellow-800 dark:text-yellow-200'
                }`}>
                Внимание! Срочные дедлайны
              </h3>
              <div className="flex flex-wrap gap-3 mt-2 text-sm">
                {urgentProjectsStats.overdue > 0 && (
                  <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-300 font-medium">
                    🔴 Просрочено: {urgentProjectsStats.overdue}
                  </span>
                )}
                {urgentProjectsStats.critical > 0 && (
                  <span className="inline-flex items-center gap-1 text-orange-700 dark:text-orange-300 font-medium">
                    🟠 До 3 дней: {urgentProjectsStats.critical}
                  </span>
                )}
                {urgentProjectsStats.warning > 0 && (
                  <span className="inline-flex items-center gap-1 text-yellow-700 dark:text-yellow-300 font-medium">
                    🟡 До 7 дней: {urgentProjectsStats.warning}
                  </span>
                )}
              </div>
              {/* Краткий список срочных проектов */}
              {urgentProjectsStats.urgentProjects.length > 0 && (
                <div className="mt-3 text-sm">
                  <details>
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      Показать проекты ({urgentProjectsStats.urgentProjects.length})
                    </summary>
                    <ul className="mt-2 space-y-1 ml-4">
                      {urgentProjectsStats.urgentProjects.slice(0, 10).map(({ project, urgency, daysLeft }) => (
                        <li key={project.id || project.notes?.id} className="flex items-center gap-2">
                          <span className={urgency === 'overdue' ? 'text-red-600' : urgency === 'critical' ? 'text-orange-600' : 'text-yellow-600'}>
                            {urgency === 'overdue' ? '🔴' : urgency === 'critical' ? '🟠' : '🟡'}
                          </span>
                          <span
                            className="hover:underline cursor-pointer truncate max-w-[300px]"
                            onClick={() => navigate(`/projects/${project.id || project.notes?.id}`, { state: { project } })}
                          >
                            {project.name || project.client?.name || 'Без названия'}
                          </span>
                          <span className="text-muted-foreground">
                            ({daysLeft < 0 ? `просрочен на ${Math.abs(daysLeft)} дн.` : `осталось ${daysLeft} дн.`})
                          </span>
                        </li>
                      ))}
                      {urgentProjectsStats.urgentProjects.length > 10 && (
                        <li className="text-muted-foreground">... и ещё {urgentProjectsStats.urgentProjects.length - 10}</li>
                      )}
                    </ul>
                  </details>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Заголовок */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Проекты</h1>
          <p className="text-muted-foreground">
            {user?.role === 'partner' ? 'Мои проекты' :
              user?.role === 'procurement' ? 'Управление проектами' :
                'Проекты'}
          </p>
        </div>
        {/* Кнопки управления - только для CEO, deputy_director и procurement */}
        {(user?.role === 'ceo' || user?.role === 'deputy_director' || user?.role === 'procurement') && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportProjects}>
              <Download className="w-4 h-4 mr-2" />
              Экспорт в Excel
            </Button>
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <FileDown className="w-4 h-4 mr-2" />
              Шаблон
            </Button>
            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="w-4 h-4 mr-2" />
                  Импорт из Excel
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Импорт проектов из Excel</DialogTitle>
                  <DialogDescription>
                    Выберите файл Excel для импорта проектов. Формат должен соответствовать шаблону.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="import-file">Файл Excel</Label>
                    <Input
                      id="import-file"
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleImportFile(file);
                        }
                      }}
                      disabled={isImporting}
                    />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p>• Поддерживаются форматы .xlsx и .xls</p>
                    <p>• Используйте шаблон для правильного формата</p>
                    <p>• Обязательные поля: Наименование (или Клиент), Номер договора (или Договор №)</p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsImportDialogOpen(false)} disabled={isImporting}>
                    Отмена
                  </Button>
                  {isImporting && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                      Импорт...
                    </div>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>
            {/* Кнопка создания проекта - только для procurement */}
            {user?.role === 'procurement' && (
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
                        onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                        className="col-span-3"
                        placeholder="Введите название проекта"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="company" className="text-right">
                        Компания
                      </Label>
                      <Select value={newProject.company} onValueChange={(value) => setNewProject({ ...newProject, company: value })}>
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
                        onChange={(e) => setNewProject({ ...newProject, deadline: e.target.value })}
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
                        onChange={(e) => setNewProject({ ...newProject, budget: e.target.value })}
                        className="col-span-3"
                        placeholder="Введите бюджет проекта"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="status" className="text-right">
                        Статус
                      </Label>
                      <Select value={newProject.status} onValueChange={(value) => setNewProject({ ...newProject, status: value })}>
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
            )}
          </div>
        )}
      </div>

      {/* Современная панель фильтров */}
      {/* СУПЕР-СОВРЕМЕННАЯ ПАНЕЛЬ ФИЛЬТРОВ */}
      <Card className="overflow-hidden border-0 shadow-2xl bg-gradient-to-br from-card/90 via-card to-card/50 backdrop-blur-xl relative mb-6">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/50 via-secondary/50 to-primary/50" />

        <div className="p-6 space-y-8">
          {/* Поиск */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-xl blur opacity-25 group-hover:opacity-100 transition duration-500" />
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-primary/70" />
              <Input
                placeholder="Поиск по названию, клиенту, договору..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-14 h-14 text-lg bg-background/80 border-primary/20 hover:border-primary/50 focus:border-primary focus:ring-2 ring-primary/20 transition-all rounded-xl shadow-inner placeholder:text-muted-foreground/70"
              />
            </div>
          </div>

          {/* Быстрые основные фильтры */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* Год окончания */}
            <div className="space-y-3 p-4 rounded-xl bg-background/40 border border-white/5 shadow-sm">
              <Label className="flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wider font-semibold">
                <Calendar className="w-4 h-4 text-primary" /> Год окончания
              </Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={filterYear === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterYear('all')}
                  className={`rounded-full px-4 transition-all ${filterYear === 'all' ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25 scale-105' : 'hover:border-primary/50 border-primary/20'}`}
                >
                  Все
                </Button>
                {availableYears.slice(0, 4).map(year => (
                  <Button
                    key={year}
                    variant={filterYear === year ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterYear(year)}
                    className={`rounded-full px-4 transition-all ${filterYear === year ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25 scale-105' : 'hover:border-primary/50 border-primary/20'}`}
                  >
                    {year}
                  </Button>
                ))}
              </div>
            </div>

            {/* Наша компания */}
            <div className="space-y-3 p-4 rounded-xl bg-background/40 border border-white/5 shadow-sm">
              <Label className="flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wider font-semibold">
                <BarChart3 className="w-4 h-4 text-secondary" /> Наша компания
              </Label>
              <Select value={filterCompany} onValueChange={setFilterCompany}>
                <SelectTrigger className="h-[36px] bg-background/50 border-secondary/20 hover:border-secondary/50 transition-colors rounded-xl shadow-sm text-secondary-foreground font-semibold">
                  <SelectValue placeholder="Все компании" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все компании</SelectItem>
                  {(appSettings.companies?.length > 0 ? appSettings.companies.filter(c => c.isActive) : availableCompanies.map(name => ({ id: name, name }))).map(c => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Тип проекта */}
            <div className="space-y-3 p-4 rounded-xl bg-background/40 border border-white/5 shadow-sm">
              <Label className="flex items-center gap-2 text-sm text-muted-foreground uppercase tracking-wider font-semibold">
                <Clock className="w-4 h-4 text-orange-500" /> Тип & Настройки
              </Label>
              <div className="flex gap-2 h-[32px]">
                <Button
                  variant={filterLongTerm === true ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterLongTerm(filterLongTerm === true ? 'all' : true)}
                  className={`flex-1 rounded-xl transition-all h-[36px] ${filterLongTerm === true ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/30' : 'hover:border-orange-500/50 border-orange-500/20 text-orange-600 dark:text-orange-400'}`}
                >
                  ⏳ Долгоср.
                </Button>
                <Button
                  variant={filterLongTerm === false ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterLongTerm(filterLongTerm === false ? 'all' : false)}
                  className={`flex-1 rounded-xl transition-all h-[36px] ${filterLongTerm === false ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'hover:border-blue-500/50 border-blue-500/20 text-blue-600 dark:text-blue-400'}`}
                >
                  ⚡ Краткоср.
                </Button>
              </div>
            </div>

          </div>

          {/* Расширенные фильтры - Слайдеры и селекты */}
          <div className="pt-6 border-t border-primary/10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">

              {/* Статус проекта */}
              <div className="space-y-3">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Статус</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-10 rounded-lg bg-background/50 border-primary/20 hover:border-primary/50 transition-colors">
                    <SelectValue placeholder="Все статусы" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все статусы</SelectItem>
                    {availableStatuses.map((status: string) => (
                      <SelectItem key={status} value={status}>
                        <div className="flex items-center gap-2">
                          <Circle className={`w-3 h-3 text-primary`} />
                          {status}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Прогресс со слайдером */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Прогресс (%)</Label>
                  <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {filterProgressMin === '' ? 0 : filterProgressMin} — {filterProgressMax === '' ? 100 : filterProgressMax}
                  </span>
                </div>
                <Slider
                  defaultValue={[0, 100]}
                  value={[Number(filterProgressMin === '' ? 0 : filterProgressMin), Number(filterProgressMax === '' ? 100 : filterProgressMax)]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={([min, max]) => {
                    setFilterProgressMin(min);
                    setFilterProgressMax(max);
                  }}
                  className="py-2"
                />
              </div>

              {/* Сумма договора со слайдером (упрощенным) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Сумма (без НДС)</Label>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={showAmounts}
                      onCheckedChange={setShowAmounts}
                      id="showAmounts"
                    />
                    <Label htmlFor="showAmounts" className="text-[10px] cursor-pointer opacity-70">
                      Показывать
                    </Label>
                  </div>
                </div>
                {showAmounts ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="От"
                      value={filterAmountMin}
                      onChange={(e) => setFilterAmountMin(e.target.value ? Number(e.target.value) : '')}
                      className="h-10 rounded-lg bg-background/50 border-primary/20 text-center font-mono text-sm"
                    />
                    <span className="text-muted-foreground font-bold">-</span>
                    <Input
                      type="number"
                      placeholder="До"
                      value={filterAmountMax}
                      onChange={(e) => setFilterAmountMax(e.target.value ? Number(e.target.value) : '')}
                      className="h-10 rounded-lg bg-background/50 border-primary/20 text-center font-mono text-sm"
                    />
                  </div>
                ) : (
                  <div className="h-10 rounded-lg bg-muted/30 border border-primary/10 flex items-center justify-center text-xs text-muted-foreground italic">
                    👁️ Скрыто
                  </div>
                )}
              </div>

              {/* Сортировка */}
              <div className="space-y-3">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Сортировка</Label>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                  <SelectTrigger className="h-10 rounded-lg bg-background/50 border-primary/20 hover:border-primary/50 transition-colors">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deadline_asc">По дедлайну (ближайшие)</SelectItem>
                    <SelectItem value="deadline_desc">По дедлайну (дальние)</SelectItem>
                    <SelectItem value="date_desc">По дате (новые)</SelectItem>
                    <SelectItem value="date_asc">По дате (старые)</SelectItem>
                    <SelectItem value="amount_desc">По сумме (большие)</SelectItem>
                    <SelectItem value="amount_asc">По сумме (маленькие)</SelectItem>
                    <SelectItem value="name_asc">По названию (А-Я)</SelectItem>
                    <SelectItem value="name_desc">По названию (Я-А)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

            </div>
          </div>

          {/* Возвращаем фильтр по команде и задачам как нижний ряд */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 pt-4">
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Наличие команды</Label>
              <Select value={filterHasTeam === 'all' ? 'all' : filterHasTeam ? 'yes' : 'no'}
                onValueChange={(v) => setFilterHasTeam(v === 'all' ? 'all' : v === 'yes')}>
                <SelectTrigger className="h-10 rounded-lg bg-background/50 border-primary/20 hover:border-primary/50 transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Команда: Все</SelectItem>
                  <SelectItem value="yes">✅ Есть команда</SelectItem>
                  <SelectItem value="no">❌ Нет команды</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Наличие задач</Label>
              <Select value={filterHasTasks === 'all' ? 'all' : filterHasTasks ? 'yes' : 'no'}
                onValueChange={(v) => setFilterHasTasks(v === 'all' ? 'all' : v === 'yes')}>
                <SelectTrigger className="h-10 rounded-lg bg-background/50 border-primary/20 hover:border-primary/50 transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Задачи: Все</SelectItem>
                  <SelectItem value="yes">✅ Есть задачи</SelectItem>
                  <SelectItem value="no">❌ Нет задач</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Диапазон дедлайна */}
            <div className="space-y-3 lg:col-span-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Срок проекта (От и До)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={filterDeadlineFrom}
                  onChange={(e) => setFilterDeadlineFrom(e.target.value)}
                  className="h-10 rounded-lg bg-background/50 border-primary/20"
                />
                <span className="text-muted-foreground font-bold">-</span>
                <Input
                  type="date"
                  value={filterDeadlineTo}
                  onChange={(e) => setFilterDeadlineTo(e.target.value)}
                  className="h-10 rounded-lg bg-background/50 border-primary/20"
                />
              </div>
            </div>
          </div>

          {/* Футер фильтров (Сброс и статистика) */}
          <div className="flex items-center justify-between pt-6 border-t border-primary/10 mt-6 !mb-0">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="px-5 py-2.5 bg-primary/10 text-primary hover:bg-primary/20 border-0 shadow-sm rounded-xl text-md">
                Найдено: <span className="font-bold mx-1 text-xl">{filteredProjects.length}</span> из <span className="opacity-70 ml-1">{realProjects.length}</span>
              </Badge>
            </div>

            {(filterYear !== 'all' || filterCompany !== 'all' || filterLongTerm !== 'all' ||
              filterStatus !== 'all' || filterProgressMin !== '' || filterProgressMax !== '' ||
              filterAmountMin !== '' || filterAmountMax !== '' || filterHasTeam !== 'all' ||
              filterHasTasks !== 'all' || filterDeadlineFrom || filterDeadlineTo) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full px-5 h-10 font-bold tracking-wide transition-all shadow-sm"
                  onClick={() => {
                    setFilterStatus('all');
                    setFilterProgressMin('');
                    setFilterProgressMax('');
                    setFilterAmountMin('');
                    setFilterAmountMax('');
                    setFilterHasTeam('all');
                    setFilterHasTasks('all');
                    setFilterDeadlineFrom('');
                    setFilterDeadlineTo('');
                    setFilterYear('all');
                    setFilterCompany('all');
                    setFilterLongTerm('all');
                  }}
                >
                  <XCircle className="w-5 h-5 mr-2" /> СБРОСИТЬ ФИЛЬТРЫ
                </Button>
              )}
          </div>
        </div>
      </Card>

      {/* Фиксированная панель массовых действий (только для CEO) */}
      {isAdmin && selectedProjectIds.size > 0 && (
        <div className="fixed bottom-4 right-4 z-50 bg-primary text-primary-foreground p-4 rounded-lg shadow-lg border-2 border-primary/20">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Выбрано: {selectedProjectIds.size}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setBulkStatusDialogOpen(true)}
                disabled={isChangingStatus || isDeletingMultiple}
                className="bg-white text-primary hover:bg-gray-100"
              >
                📝 Изменить статус
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={isDeletingMultiple || isChangingStatus}
                className="bg-white text-destructive hover:bg-gray-100"
              >
                {isDeletingMultiple ? 'Удаление...' : `🗑️ Удалить`}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedProjectIds(new Set())}
                disabled={isDeletingMultiple || isChangingStatus}
                className="text-white hover:bg-white/20"
              >
                Отмена
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Диалог массового изменения статуса */}
      <Dialog open={bulkStatusDialogOpen} onOpenChange={setBulkStatusDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Изменить статус для {selectedProjectIds.size} проектов</DialogTitle>
            <DialogDescription>
              Выберите новый статус для выбранных проектов
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleBulkStatusChange('new')}
              disabled={isChangingStatus}
            >
              📋 На утверждении (new)
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleBulkStatusChange('pending_approval')}
              disabled={isChangingStatus}
            >
              ⏳ Ожидает утверждения (pending_approval)
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleBulkStatusChange('active')}
              disabled={isChangingStatus}
            >
              ✅ Активный
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleBulkStatusChange('in_progress')}
              disabled={isChangingStatus}
            >
              🔄 В работе
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleBulkStatusChange('completed')}
              disabled={isChangingStatus}
            >
              ✔️ Завершен
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => handleBulkStatusChange('archived')}
              disabled={isChangingStatus}
            >
              📦 Архив
            </Button>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setBulkStatusDialogOpen(false)}
              disabled={isChangingStatus}
            >
              Отмена
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            {filteredProjects.map((project, index) => (
              <ProjectCard
                key={project.id || project.notes?.id || `project-${index}`}
                project={project}
              />
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
                <thead className="bg-secondary">
                  <tr>
                    {isAdmin && (
                      <th className="px-3 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedProjectIds.size === filteredProjects.length && filteredProjects.length > 0}
                          onChange={selectAllProjects}
                          className="w-4 h-4 cursor-pointer"
                        />
                      </th>
                    )}
                    <th className="px-3 py-3 text-left text-xs font-semibold text-foreground">📋 Проект</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-foreground">🏢 Компания</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-foreground">💼 Сумма без НДС</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-foreground">💎 Сумма с НДС</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-foreground">📊 Статус</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-foreground">📈 Прогресс</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-foreground">✅ Задачи</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-foreground">📝 Чек-лист</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-foreground">📄 Документы</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-foreground">👥 Команда</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-foreground">📅 Дедлайн</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-foreground">⚡ Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredProjects.map((project) => {
                    const stats = getProjectStats(project);
                    const tasks = getProjectTasks(project);
                    const projectId = project.id || project.notes?.id;

                    return (
                      <tr key={projectId || `project-${project.name}`} className="hover:bg-secondary/20 transition-colors">
                        {isAdmin && (
                          <td className="px-3 py-3">
                            <input
                              type="checkbox"
                              checked={selectedProjectIds.has(projectId)}
                              onChange={() => toggleProjectSelection(projectId)}
                              className="w-4 h-4 cursor-pointer"
                            />
                          </td>
                        )}
                        <td className="px-3 py-3">
                          <div
                            className="flex items-center space-x-2 cursor-pointer hover:text-primary transition-colors group"
                            onClick={() => {
                              const projectId = project.id || project.notes?.id;
                              if (projectId) {
                                navigate(`/project/${projectId}`, { state: { project } });
                              }
                            }}
                            title="Открыть карточку проекта"
                          >
                            <div className="w-6 h-6 bg-gradient-to-r from-primary to-secondary rounded flex items-center justify-center text-xs group-hover:scale-110 transition-transform">
                              📄
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-sm group-hover:underline">{project.name}</div>
                              <div className="text-xs text-muted-foreground">#{project.id}</div>
                            </div>
                          </div>
                        </td>

                        <td className="px-3 py-3">
                          <span className="text-xs">{project.companyName || project.company || project.ourCompany || '—'}</span>
                        </td>

                        <td className="px-3 py-3">
                          {showAmounts ? (() => {
                            const { amount, currency } = getProjectAmount(project);

                            // Отладочное логирование для первых проектов (всегда в проде для отладки)
                            if (filteredProjects.indexOf(project) < 3) {
                              console.log('🔍 DEBUG Сумма БЕЗ НДС для проекта:', {
                                название: project.name,
                                найденная_сумма: amount,
                                currency: currency,
                                notes_type: typeof project.notes,
                                notes_есть: !!project.notes,
                                notes_finances: project.notes?.finances,
                                notes_finances_amount: project.notes?.finances?.amountWithoutVAT,
                                notes_contract: project.notes?.contract,
                                notes_contract_amount: project.notes?.contract?.amountWithoutVAT,
                                notes_amountWithoutVAT: project.notes?.amountWithoutVAT,
                                notes_amount: project.notes?.amount,
                                project_amountWithoutVAT: project.amountWithoutVAT,
                                project_amount: project.amount,
                                project_contract: project.contract,
                                project_finances: project.finances,
                                // Первые 1000 символов notes для анализа
                                notes_raw: typeof project.notes === 'string' ? project.notes.substring(0, 1000) : JSON.stringify(project.notes || {}).substring(0, 1000)
                              });
                            }

                            return amount && amount > 0 ? (
                              <span className="text-xs font-medium text-primary">
                                {new Intl.NumberFormat('ru-RU', {
                                  style: 'currency',
                                  currency: currency,
                                  maximumFractionDigits: 0
                                }).format(amount)}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground" title="Сумма не найдена в данных проекта">—</span>
                            );
                          })() : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>

                        <td className="px-3 py-3">
                          {showAmounts ? (() => {
                            const { amount, currency } = getProjectAmountWithVAT(project);
                            return amount && amount > 0 ? (
                              <span className="text-xs font-bold text-green-600 dark:text-green-400">
                                {new Intl.NumberFormat('ru-RU', {
                                  style: 'currency',
                                  currency: currency,
                                  maximumFractionDigits: 0
                                }).format(amount)}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground" title="Сумма с НДС не найдена">—</span>
                            );
                          })() : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>

                        <td className="px-3 py-3">
                          <Badge
                            variant="secondary"
                            className={`text-xs text-white ${getProjectStatusColor(project)} ${getProjectStatusLabel(project) === 'Ожидает распределения команды'
                              ? 'cursor-pointer hover:opacity-80'
                              : ''
                              }`}
                            onClick={() => {
                              const status = getProjectStatusLabel(project);
                              if (status === 'Ожидает распределения команды') {
                                const projectId = project.id || project.projectId;
                                navigate(`/project/${projectId}`, {
                                  state: { project, openTeamAssignment: true }
                                });
                              }
                            }}
                            title={getProjectStatusLabel(project) === 'Ожидает распределения команды'
                              ? 'Нажмите для назначения команды'
                              : undefined}
                          >
                            {getProjectStatusLabel(project)}
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
                                  // Проверяем что checklist существует
                                  if (!task.checklist || !Array.isArray(task.checklist)) {
                                    return null;
                                  }
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
                          {(() => {
                            const docCompletion = getDocumentCompletion(project);
                            return (
                              <div className="space-y-1">
                                <div className="flex items-center space-x-1 text-xs">
                                  <span className="font-medium">{docCompletion.completed}/{docCompletion.total}</span>
                                  <span className="text-muted-foreground">({docCompletion.percentage}%)</span>
                                </div>
                                <Progress value={docCompletion.percentage} className="h-1.5 w-16" />
                                <div className="flex flex-wrap gap-0.5 mt-1">
                                  {Array.from({ length: Math.min(docCompletion.total, 10) }).map((_, i) => (
                                    <span key={i} className="text-[8px]">
                                      {i < docCompletion.completed ? '✅' : '⭕'}
                                    </span>
                                  ))}
                                  {docCompletion.total > 10 && (
                                    <span className="text-[8px] text-muted-foreground">+{docCompletion.total - 10}</span>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </td>

                        <td className="px-3 py-3">
                          <div className="flex items-center space-x-1 text-xs">
                            <span>👥</span>
                            <span>{project.team?.length || project.team || 0}</span>
                          </div>
                        </td>

                        <td className="px-3 py-3">
                          {(() => {
                            const { urgency, daysLeft, deadline } = getDeadlineUrgency(project);
                            const bgColor = urgency === 'overdue'
                              ? 'bg-red-100 dark:bg-red-900/30'
                              : urgency === 'critical'
                                ? 'bg-orange-100 dark:bg-orange-900/30'
                                : urgency === 'warning'
                                  ? 'bg-yellow-100 dark:bg-yellow-900/30'
                                  : '';
                            const textColor = urgency === 'overdue'
                              ? 'text-red-700 dark:text-red-300'
                              : urgency === 'critical'
                                ? 'text-orange-700 dark:text-orange-300'
                                : urgency === 'warning'
                                  ? 'text-yellow-700 dark:text-yellow-300'
                                  : '';
                            const icon = urgency === 'overdue' ? '🔴' : urgency === 'critical' ? '🟠' : urgency === 'warning' ? '🟡' : '📅';

                            return (
                              <div className={`flex flex-col gap-0.5 rounded px-1 py-0.5 ${bgColor}`}>
                                <div className={`flex items-center space-x-1 text-xs ${textColor}`}>
                                  <span>{icon}</span>
                                  <span className="font-medium">
                                    {deadline
                                      ? deadline.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
                                      : '—'
                                    }
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 ml-5">
                                  <span className="text-xs font-semibold text-primary">
                                    {deadline ? deadline.getFullYear() : ''}
                                  </span>
                                  {daysLeft !== null && (
                                    <span className={`text-[10px] ${textColor || 'text-muted-foreground'}`}>
                                      {daysLeft < 0
                                        ? `(${Math.abs(daysLeft)}д. назад)`
                                        : daysLeft === 0
                                          ? '(сегодня!)'
                                          : `(${daysLeft}д.)`
                                      }
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </td>

                        <td className="px-3 py-3">
                          <div className="flex space-x-1 flex-wrap gap-1">
                            {user?.role === 'deputy_director' &&
                              getProjectsAwaitingTeam.some(p => (p.id || p.notes?.id) === projectId) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => openTeamDistribution(project)}
                                >
                                  👥 Распределить
                                </Button>
                              )}
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
                            {isAdmin && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                                onClick={() => {
                                  setProjectToDelete(project);
                                  setIsDeleteDialogOpen(true);
                                }}
                              >
                                🗑️
                              </Button>
                            )}
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
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
                    <span>{filteredProjects.filter(p => {
                      const notesStatus = p.notes?.status;
                      // Не считаем активными проекты на утверждении
                      if (notesStatus === 'new' || notesStatus === 'pending_approval') return false;
                      const status = p.status || p.notes?.status;
                      return status === 'В работе' || status === 'active' || status === 'in_progress';
                    }).length}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">Активных</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-blue-500 flex items-center justify-center space-x-1">
                    <span>📈</span>
                    <span>{filteredProjects.length > 0 ? Math.round(filteredProjects.reduce((acc, p) => acc + (p.completionPercent || p.completion || 0), 0) / filteredProjects.length) : 0}%</span>
                  </div>
                  <div className="text-xs text-muted-foreground">Средний прогресс</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-orange-500 flex items-center justify-center space-x-1">
                    <span>👥</span>
                    <span>{filteredProjects.reduce((acc, p) => acc + (p.team?.length || p.team || 0), 0)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">Участников</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-green-500 flex items-center justify-center space-x-1">
                    <span>💰</span>
                    <span>
                      {showAmounts ? new Intl.NumberFormat('ru-RU', {
                        style: 'currency',
                        currency: 'KZT',
                        maximumFractionDigits: 0,
                        notation: 'compact'
                      }).format(
                        filteredProjects.reduce((acc, p) =>
                          acc + (p.contract?.amountWithoutVAT || p.amountWithoutVAT || p.amount || 0), 0
                        )
                      ) : '—'}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">Общая сумма</div>
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

      {/* Диалог распределения команды - только для зам. директора */}
      {user?.role === 'deputy_director' && projectForTeamDistribution && (
        <Dialog open={!!projectForTeamDistribution} onOpenChange={() => setProjectForTeamDistribution(null)}>
          <DialogContent className="sm:max-w-[700px]">
            <DialogHeader>
              <DialogTitle>Распределить команду</DialogTitle>
              <DialogDescription>
                Проект: {projectForTeamDistribution.name || projectForTeamDistribution.client?.name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Выберите участников команды:</Label>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-[400px]">
                    <Button
                      variant={teamDistributionRoleFilter === 'all' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTeamDistributionRoleFilter('all')}
                      className="rounded-full text-[10px] h-7 px-3"
                    >
                      Все
                    </Button>
                    {employeeRoles.map(role => (
                      <Button
                        key={role}
                        variant={teamDistributionRoleFilter === role ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTeamDistributionRoleFilter(role)}
                        className={`rounded-full text-[10px] h-7 px-3 ${teamDistributionRoleFilter === role ? 'bg-primary text-primary-foreground' : ''}`}
                      >
                        {role}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="mt-2 space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar border rounded-lg p-3 bg-muted/20">
                  {filteredEmployeesForDistribution.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground text-sm italic">
                      Нет сотрудников с такой должностью
                    </div>
                  ) : (
                    filteredEmployeesForDistribution.map((emp: any) => (
                      <div key={emp.id} className="flex items-center justify-between group hover:bg-background/50 p-2 rounded-md transition-colors">
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            id={`team-${emp.id}`}
                            checked={selectedTeamMembers.includes(emp.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedTeamMembers([...selectedTeamMembers, emp.id]);
                              } else {
                                setSelectedTeamMembers(selectedTeamMembers.filter(id => id !== emp.id));
                              }
                            }}
                            className="w-4 h-4 rounded border-primary/20 text-primary focus:ring-primary shadow-sm"
                          />
                          <Label htmlFor={`team-${emp.id}`} className="cursor-pointer flex flex-col">
                            <span className="font-medium">{emp.name}</span>
                            <span className="text-[10px] text-muted-foreground">{emp.role || emp.position || 'Сотрудник'}</span>
                          </Label>
                        </div>
                        {selectedTeamMembers.includes(emp.id) && (
                          <Badge variant="secondary" className="bg-primary/10 text-primary text-[10px] h-5">Выбран</Badge>
                        )}
                      </div>
                    ))
                  )}
                </div>
                
                {filteredEmployeesForDistribution.length > 0 && teamDistributionRoleFilter !== 'all' && (
                  <div className="mt-2 flex justify-end">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        const idsToAdd = filteredEmployeesForDistribution
                          .map(emp => emp.id)
                          .filter(id => !selectedTeamMembers.includes(id));
                        setSelectedTeamMembers([...selectedTeamMembers, ...idsToAdd]);
                      }}
                      className="text-[10px] text-primary hover:text-primary hover:bg-primary/10"
                    >
                      Выбрать всех {teamDistributionRoleFilter} ({filteredEmployeesForDistribution.length})
                    </Button>
                  </div>
                )}
              </div>

              <div className="text-sm text-muted-foreground">
                Выбрано: {selectedTeamMembers.length} участников
              </div>

              {/* Информация о следующих шагах */}
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <ArrowRight className="w-4 h-4" />
                  Следующие шаги после распределения команды:
                </h4>
                <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Партнёр получит уведомление о назначенной команде</li>
                  <li>Партнёр должен выбрать методологию и распределить задачи</li>
                  <li>Автоматически создадутся задачи на основе методологии</li>
                  <li>Команда начнёт заполнять документы по этапам проекта</li>
                  <li>Менеджер проекта будет отслеживать прогресс выполнения</li>
                </ol>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setProjectForTeamDistribution(null)}>
                Отмена
              </Button>
              <Button onClick={handleSaveTeamDistribution}>
                Сохранить команду и отправить уведомления
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

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

      {/* Диалог подтверждения удаления */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить проект?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить проект "{projectToDelete?.name}"? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsDeleteDialogOpen(false);
              setProjectToDelete(null);
            }}>
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => projectToDelete && handleDeleteProject(projectToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}