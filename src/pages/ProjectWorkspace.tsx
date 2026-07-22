import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  CheckCircle2,
  Users,
  Edit,
  Plus
} from "lucide-react";
import { useEmployees, useProjects } from "@/hooks/useSupabaseData";
import { useTasks } from "@/hooks/useTasks";
import { allProjectsHoursTotals, type ProjectHoursTotals } from "@/lib/timesheets";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useProjectDataSync } from "@/hooks/useProjectDataSync";
import { TEAM_ROLE_SLOTS } from "@/types/roles";

import { supabaseDataStore } from "@/lib/supabaseDataStore";
import { useAppSettings } from "@/lib/appSettings";
import { legacyProjectCompanyLabel } from "@/lib/userCompanyAccess";

import { supabase } from "@/integrations/supabase/client";
import { notifyReadyForPartnerApproval, notifyProjectReadyForCeoBonuses, notifyTeamAssembled, notifyTeamMemberAdded } from "@/lib/projectNotifications";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { calculateProjectFinances } from "@/types/project-v3";
// TaskManager removed (using Tasks page component instead)
// TaskDistribution removed
import { ProjectFileManager } from "@/components/projects/ProjectFileManager";
// TemplateManager, WorkPaperTree, WorkPaperViewer removed
import { ContractEditor } from "@/components/projects/ContractEditor";
import { ProjectEditProcurement } from "@/components/projects/ProjectEditProcurement";
import { AuditPeriodsEditor } from "@/components/projects/AuditPeriodsEditor";
import Tasks from "@/pages/Tasks";
// WorkPaper types removed
import { ProjectAmendment } from "@/types/project-v3";
import type { AuditPeriod } from "@/lib/auditPeriods";
import { TeamAssignment } from "@/components/projects/TeamAssignment";
import { useMemo } from "react";
import { getProjectStatusLabel, isTaskDoneStatus } from "@/lib/projectWorkflow";
import {
  buildContractUpdate,
  projectContract as readProjectContract,
  projectDeadline as readProjectDeadline,
  projectFiles as readProjectFiles,
  projectFinances as readProjectFinances,
  projectStartDate as readProjectStartDate,
} from "@/lib/contractData";

const mapProjectAmendmentRecord = (record: any): ProjectAmendment => ({
  id: String(record.id || `amend_${Date.now()}`),
  projectId: String(record.project_id || record.projectId || ''),
  number: String(record.number || ''),
  date: String(record.date || ''),
  description: String(record.description || ''),
  fileUrl: record.file_url || record.fileUrl || undefined,
  createdBy: String(record.created_by || record.createdBy || 'system'),
  createdAt: String(record.created_at || record.createdAt || new Date().toISOString()),
});

const projectFileKey = (file: any): string => (
  file?.id || file?.storagePath || file?.publicUrl || file?.url || file?.fileName || file?.name || ''
);

const moneyCell = (value: any): string => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) && amount > 0 ? `${amount.toLocaleString('ru-RU')} ₸` : 'Не указано';
};

const dateCell = (value: any): string => {
  if (!value) return 'Не указано';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('ru-RU') : String(value);
};

const textCell = (value: any, fallback = 'Не указано'): string => {
  const text = String(value || '').trim();
  return text || fallback;
};

const teamRoleLabel = (role: string): string => {
  const match = TEAM_ROLE_SLOTS.find((slot: any) => slot.key === role);
  if (match?.label) return match.label;
  const labels: Record<string, string> = {
    partner: 'Партнёр',
    project_leader: 'Руководитель проекта',
    manager_1: 'Менеджер 1',
    manager_2: 'Менеджер 2',
    manager_3: 'Менеджер 3',
    supervisor_3: 'Супервайзер 3',
    supervisor_2: 'Супервайзер 2',
    supervisor_1: 'Супервайзер 1',
    tax_specialist_1: 'Налоговик 1',
    tax_specialist_2: 'Налоговик 2',
    assistant_3: 'Ассистент 3',
    assistant_2: 'Ассистент 2',
    assistant_1: 'Ассистент 1',
    assistant: 'Ассистент',
  };
  return labels[role] || role || 'Роль';
};

type ProjectFlatSummaryProps = {
  project: any;
  projectTasks: any[];
  projectHours?: ProjectHoursTotals;
  employees: any[];
  normalizedContract: any;
  normalizedFinances: any;
  normalizedFiles: any[];
  normalizedStartDate: string;
  normalizedDeadline: string;
  amendments: ProjectAmendment[];
  projectStatus: string;
  currentProjectCompany: { id: string; name: string };
  canManageProjectCompany: boolean;
  activeCompanies: any[];
  companyDraftId: string;
  setCompanyDraftId: (value: string) => void;
  saveProjectCompany: () => void;
  isSavingCompany: boolean;
  canEditTeam: boolean;
  onEditTeam: () => void;
  canSeeFinance: boolean;
};

function ProjectFlatSummary({
  project,
  projectTasks,
  projectHours,
  employees,
  normalizedContract,
  normalizedFinances,
  normalizedFiles,
  normalizedStartDate,
  normalizedDeadline,
  amendments,
  projectStatus,
  currentProjectCompany,
  canManageProjectCompany,
  activeCompanies,
  companyDraftId,
  setCompanyDraftId,
  saveProjectCompany,
  isSavingCompany,
  canEditTeam,
  onEditTeam,
  canSeeFinance,
}: ProjectFlatSummaryProps) {
  const team = project.team || project.notes?.team || [];
  const periods = project.notes?.auditPeriods || project.auditPeriods || [];
  const completedTasks = projectTasks.filter((task: any) => isTaskDoneStatus(task.status)).length;
  const pendingTasks = projectTasks.length - completedTasks;
  const approvedHours = Number(projectHours?.approved || 0);
  const pendingHours = Number(projectHours?.pending || 0);
  const teamByRole = team.map((member: any) => {
    const employee = employees.find((item: any) => item.id === (member.userId || member.id || member.employeeId));
    const name = employee?.name || member.name || member.userName || member.employeeName || 'Не назначен';
    return `${teamRoleLabel(member.role)}: ${name}`;
  }).join('\n');
  const periodText = periods.length
    ? periods.map((period: any) => `${textCell(period.name || period.title, 'Период')} · ${dateCell(period.startDate)} — ${dateCell(period.endDate || period.deadline)} · ${textCell(period.status, 'статус не указан')}`).join('\n')
    : 'Периоды не заведены';
  const fileText = normalizedFiles.length
    ? normalizedFiles.map((file: any) => file.name || file.fileName || file.path || 'Файл').join('\n')
    : 'Файлы не прикреплены';
  const rowClass = 'border-b align-top last:border-b-0';
  const labelClass = 'w-[210px] bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground';
  const valueClass = 'px-3 py-2 text-sm whitespace-pre-line';

  return (
    <section aria-label="Свод проекта" className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex flex-col gap-1 border-b bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold">Свод проекта</h2>
          <p className="text-sm text-muted-foreground">Вся ключевая информация одной таблицей — без карточек.</p>
        </div>
        <Badge variant="outline">{getProjectStatusLabel(projectStatus)}</Badge>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <tbody>
            <tr className={rowClass}><th className={labelClass}>Клиент / проект</th><td className={valueClass}>{textCell(project.name || project.client?.name)}</td></tr>
            <tr className={rowClass}><th className={labelClass}>Предмет / услуга</th><td className={valueClass}>{textCell(normalizedContract?.subject || project.notes?.description || project.description)}\n{textCell(project.type || project.project_type || project.notes?.type, 'Вид услуги не указан')}</td></tr>
            <tr className={rowClass}>
              <th className={labelClass}>Наша компания</th>
              <td className={valueClass}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <span>{textCell(currentProjectCompany.name)}</span>
                  {canManageProjectCompany && (
                    <div className="flex flex-col gap-2 sm:ml-auto sm:flex-row">
                      <Select value={companyDraftId} onValueChange={setCompanyDraftId} disabled={isSavingCompany || activeCompanies.length === 0}>
                        <SelectTrigger className="h-9 w-full sm:w-[240px]" aria-label="Выбрать компанию проекта"><SelectValue placeholder="Выберите компанию" /></SelectTrigger>
                        <SelectContent>{activeCompanies.map((company) => <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button type="button" size="sm" onClick={saveProjectCompany} disabled={isSavingCompany || !companyDraftId || activeCompanies.length === 0}>{isSavingCompany ? 'Сохраняю…' : 'Назначить компанию'}</Button>
                    </div>
                  )}
                </div>
              </td>
            </tr>
            <tr className={rowClass}><th className={labelClass}>Договор</th><td className={valueClass}>№{textCell(normalizedContract?.number, 'не указан')} · {dateCell(normalizedContract?.date)}\n{textCell(normalizedContract?.subject)}</td></tr>
            <tr className={rowClass}><th className={labelClass}>Сроки</th><td className={valueClass}>{dateCell(normalizedStartDate || normalizedContract?.serviceStartDate)} — {dateCell(normalizedDeadline || normalizedContract?.serviceEndDate)}</td></tr>
            <tr className={rowClass}><th className={labelClass}>Этапы / периоды</th><td className={valueClass}>{periodText}</td></tr>
            <tr className={rowClass}><th className={labelClass}>Задачи</th><td className={valueClass}>{completedTasks} из {projectTasks.length} выполнено · в работе: {pendingTasks}</td></tr>
            <tr className={rowClass}><th className={labelClass}>Часы</th><td className={valueClass}>{approvedHours}ч утверждено{pendingHours > 0 ? ` · +${pendingHours}ч ждут партнёра` : ''}</td></tr>
            <tr className={rowClass}>
              <th className={labelClass}>Команда</th>
              <td className={valueClass}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <span>{teamByRole || 'Команда пока не назначена'}</span>
                  {canEditTeam && <Button type="button" size="sm" variant="outline" onClick={onEditTeam}><Edit className="mr-2 h-4 w-4" />Изменить состав</Button>}
                </div>
              </td>
            </tr>
            {canSeeFinance && (
              <>
                <tr className={rowClass}><th className={labelClass}>Финансы</th><td className={valueClass}>Сумма без НДС: {moneyCell(normalizedFinances?.amountWithoutVAT)}\nБаза бонусов: {moneyCell(normalizedFinances?.bonusBase)}\nБонусный пул: {moneyCell(normalizedFinances?.totalBonusAmount)}\nГрязный доход: {moneyCell(normalizedFinances?.grossProfit)}</td></tr>
                <tr className={rowClass}><th className={labelClass}>Расходы</th><td className={valueClass}>ГПХ / субподряд: {moneyCell(normalizedFinances?.totalContractorsAmount)}\nПредрасход: {moneyCell(normalizedFinances?.preExpenseAmount)}\nИтого расходы: {moneyCell(normalizedFinances?.totalCosts)}</td></tr>
              </>
            )}
            <tr className={rowClass}><th className={labelClass}>Файлы</th><td className={valueClass}>{fileText}</td></tr>
            <tr className={rowClass}><th className={labelClass}>Доп. соглашения</th><td className={valueClass}>{amendments.length ? amendments.map((item) => `№${item.number || '—'} от ${dateCell(item.date)} · ${textCell(item.description, '')}`).join('\n') : 'Нет доп. соглашений'}</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function ProjectWorkspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { projects, updateProject } = useProjects();
  const { tasks: allTasks } = useTasks();
  const { employees } = useEmployees();
  const { toast } = useToast();
  const { user } = useAuth();
  const [appSettings] = useAppSettings();

  // Получаем проект из state (если передан при навигации)
  const projectFromState = (location.state as any)?.project;
  const openTeamAssignment = (location.state as any)?.openTeamAssignment;

  const [projectData, setProjectData] = useState<any | null>(null);
  const [project, setProject] = useState<any>(null);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showTeamDialog, setShowTeamDialog] = useState(false);
  // Слоты команды: роль → ID сотрудника (или null)
  const [teamSlots, setTeamSlots] = useState<Record<string, string | null>>({});
  const [, setOpenSlotDropdown] = useState<string | null>(null);
  const [, setSlotSearch] = useState('');
  const [addingNewInSlot, setAddingNewInSlot] = useState<string | null>(null);
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [newEmployeeType, setNewEmployeeType] = useState<'staff' | 'gph' | 'subcontract'>('staff');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [companyDraftId, setCompanyDraftId] = useState('');
  const [isSavingCompany, setIsSavingCompany] = useState(false);

  // Дополнительные соглашения
  const [amendments, setAmendments] = useState<ProjectAmendment[]>([]);

  // Проверка роли партнёра
  const isPartner = user?.role === 'partner';
  const isPM = user?.role === 'manager_1' || user?.role === 'manager_2' || user?.role === 'manager_3';
  const isDirector = user?.role === 'ceo' || user?.role === 'deputy_director';
  const isDeputy = user?.role === 'deputy_director';
  const isCEO = user?.role === 'ceo';
  const isProcurement = user?.role === 'procurement';
  const isAdmin = user?.role === 'admin';
  const isProcurementOrAdmin = isProcurement || isAdmin;
  const canManageProjectCompany = isCEO || isAdmin || isDeputy;
  const canEditAuditPeriods = isPartner || isAdmin || isCEO || isDeputy;
  const projectStatus = project?.notes?.status || project?.status;
  // Управление командой: admin/ceo — всегда, deputy_director — пока проект не
  // ушёл в активную работу (этап распределения/сборки команды). Партнёр, PM,
  // ассистенты и т.д. команду менять не могут.
  const hasTeamYet = !!(project?.team?.length || project?.notes?.team?.length);
  const isAssemblyPhase = !hasTeamYet
    || projectStatus === 'approved'
    || projectStatus === 'team_assembled'
    || projectStatus === 'new'
    || projectStatus === 'pending_approval';
  const canEditTeam = isAdmin || isCEO || (isDeputy && isAssemblyPhase);

  const isCompleted = projectStatus === 'completed' || projectStatus === 'closed' || projectStatus === 'Завершён';
  const isInProgress = projectStatus === 'in_progress' || projectStatus === 'active' || projectStatus === 'В работе';
  const isPendingPaymentApproval = projectStatus === 'pending_payment_approval';
  const isReadyToComplete = projectStatus === 'ready_to_complete';

  // Двухэтапное закрытие проекта (поправлено по требованию CEO 2026-05-22):
  //   1) PM (manager_*) переводит проект в ready_to_complete.
  //   2) Партнёр проекта подтверждает завершение → pending_payment_approval.
  //   3) CEO в /bonuses одобряет выплату бонусов → completed.
  // Раньше PM и партнёр имели одну кнопку «Завершить» — это не соответствовало
  // ролевой модели фирмы, где партнёр в начале только видит, а в конце утверждает.
  const canMarkReady = (isPM || isAdmin || isDeputy) && (isInProgress || projectStatus === 'approved' || projectStatus === 'planning');
  const canApproveCompletion = (isPartner || isAdmin || isDeputy) && isReadyToComplete;
  // Директор/зам видят только общую информацию, без деталей методологии
  const normalizedContract = useMemo(() => readProjectContract(project), [project]);
  const normalizedFiles = useMemo(() => readProjectFiles(project), [project]);
  const normalizedFinances = useMemo(() => readProjectFinances(project), [project]);
  const activeCompanies = useMemo(
    () => (appSettings.companies || []).filter((company) => company?.id && company?.name && company.isActive !== false),
    [appSettings.companies],
  );
  const currentProjectCompany = useMemo(() => {
    const notes = typeof project?.notes === 'string'
      ? (() => { try { return JSON.parse(project.notes); } catch { return {}; } })()
      : project?.notes || {};
    return {
      id: String(project?.companyId || notes?.companyId || ''),
      name: String(
        project?.companyName
        || project?.ourCompany
        || project?.company
        || notes?.companyName
        || notes?.ourCompany
        || notes?.company
        || legacyProjectCompanyLabel(project)
        || '',
      ),
    };
  }, [project]);

  useEffect(() => {
    const matched = activeCompanies.find((company) => (
      company.id === currentProjectCompany.id
      || company.name === currentProjectCompany.name
      || company.fullName === currentProjectCompany.name
    ));
    setCompanyDraftId(matched?.id || '');
  }, [activeCompanies, currentProjectCompany]);

  const saveProjectCompany = async () => {
    if (!project || !updateProject || isSavingCompany) return;
    const company = activeCompanies.find((candidate) => candidate.id === companyDraftId);
    if (!company) {
      toast({
        title: 'Выберите компанию',
        description: 'Сначала выберите компанию-исполнителя из списка.',
        variant: 'destructive',
      });
      return;
    }

    setIsSavingCompany(true);
    const patch = {
      companyId: company.id,
      companyName: company.name,
      company: company.name,
      ourCompany: company.name,
    };
    try {
      const saved = await updateProject(project.id || id || '', patch);
      if (saved) setProject(saved as any);
      toast({
        title: currentProjectCompany.name ? 'Компания изменена' : 'Компания назначена',
        description: `${project.name || 'Проект'}: ${company.name}`,
      });
    } catch (error: any) {
      toast({
        title: 'Не удалось сохранить компанию',
        description: error?.message || 'Попробуйте ещё раз.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingCompany(false);
    }
  };
  const normalizedStartDate = useMemo(() => readProjectStartDate(project), [project]);
  const normalizedDeadline = useMemo(() => readProjectDeadline(project), [project]);

  // Хук для синхронизации с Supabase (работает ТОЛЬКО если id существует)
  const { loadProjectData, syncStatus } = useProjectDataSync(id || '');

  // Часы этого проекта (approved + pending) — для шапки.
  const [projectHours, setProjectHours] = useState<ProjectHoursTotals | undefined>();
  useEffect(() => {
    if (!id) return;
    let active = true;
    allProjectsHoursTotals()
      .then((m) => { if (active) setProjectHours(m.get(id)); })
      .catch((error) => {
        console.error('[ProjectWorkspace] failed to load project hours totals', error);
      });
    return () => { active = false; };
  }, [id]);

  // Фильтруем задачи для текущего проекта (всегда вызывается, до условных вычислений)
  const projectTasks = useMemo(() => {
    if (!id || !allTasks) return [];
    return allTasks.filter((task: any) =>
      task.project_id === id ||
      task.project_id === project?.id ||
      task.project_id === project?.notes?.id
    );
  }, [id, allTasks, project]);

  // Загрузить существующую команду в слоты
  const loadTeamIntoSlots = useCallback((proj: any) => {
    const existingTeam = proj?.team || proj?.notes?.team || [];
    const slots: Record<string, string | null> = {};
    existingTeam.forEach((m: any) => {
      const slotKey = m.slotKey || m.role || '';
      if (slotKey) {
        slots[slotKey] = m.userId || m.id || null;
      }
    });
    setTeamSlots(slots);
  }, []);

  // Открыть диалог назначения команды если пришли с флагом — но только если
  // у пользователя есть право редактировать команду.
  useEffect(() => {
    if (openTeamAssignment && project && canEditTeam) {
      setShowTeamDialog(true);
      loadTeamIntoSlots(project);
    }
  }, [openTeamAssignment, project, loadTeamIntoSlots, canEditTeam]);

  // Загрузка дополнительных соглашений из JSON проекта
  useEffect(() => {
    if (!project) return;

    let cancelled = false;
    const fallbackAmendments = project?.contract?.amendments || project?.notes?.contract?.amendments || [];
    const projectId = project.id || id;

    setAmendments(fallbackAmendments);

    if (!projectId) return;
    supabaseDataStore.getProjectAmendments(projectId)
      .then((rows) => {
        if (cancelled) return;
        if (rows.length > 0) {
          setAmendments(rows.map(mapProjectAmendmentRecord));
        }
      })
      .catch((error) => {
        console.warn('Could not load project amendments table:', error);
      });

    return () => { cancelled = true; };
  }, [project?.id, id, project?.contract?.amendments, project?.notes?.contract?.amendments]);

  // Прямая подгрузка проекта по id из Supabase — параллельно с useProjects.
  // Раньше: useProjects (из старого useDataStore) мог возвращать пустой
  // массив бесконечно, и страница висла на «Загрузка проекта...» если
  // зашли по прямой ссылке (например, из уведомления через Redirect,
  // который не передаёт location.state). Этот fallback гарантирует, что
  // проект загрузится даже когда основной store молчит.
  useEffect(() => {
    if (!id || project) return;
    let cancelled = false;
    supabaseDataStore.getProject(id).then((p) => {
      if (cancelled || !p) return;
      console.log('✅ [ProjectWorkspace] direct getProject:', p.name || p.id);
      setProject(p);
    }).catch((err) => {
      console.error('[ProjectWorkspace] direct getProject failed', err);
    });
    return () => { cancelled = true; };
  }, [id, project]);

  // Загрузка данных проекта (с синхронизацией)
  useEffect(() => {
    if (!id) return;

    // Если проект уже установлен и это тот же проект, не перезагружаем
    if (project) {
      const currentProjectId = project.id || project.notes?.id || '';
      if (currentProjectId === id || (typeof currentProjectId === 'string' && currentProjectId.includes(id))) {
        return;
      }
    }

    // ПРИОРИТЕТ 1: Используем проект из state (если передан при навигации)
    if (projectFromState) {
      const stateProjectId = projectFromState.id || projectFromState.notes?.id || '';
      if (stateProjectId === id || (typeof stateProjectId === 'string' && stateProjectId.includes(id))) {
        console.log('✅ [ProjectWorkspace] Используем проект из state:', projectFromState.name || projectFromState.id);
        setProject(projectFromState);

        // Загружаем данные проекта
        loadProjectData().then(data => {
          if (data) {
            setProjectData(data);
          }
        });
        return;
      }
    }

    // ПРИОРИТЕТ 2: Ищем проект в списке проектов
    const foundProject = projects.find(p => {
      const projectId = p.id || p.notes?.id || '';
      const notesId = p.notes?.id || '';
      return (
        projectId === id ||
        notesId === id ||
        (typeof projectId === 'string' && projectId.includes(id)) ||
        (typeof notesId === 'string' && notesId.includes(id))
      );
    });

    // Если проект найден и еще не установлен, устанавливаем его
    if (foundProject) {
      // Если проект уже установлен и это тот же проект, не обновляем
      if (project?.id === foundProject.id || project?.notes?.id === foundProject.notes?.id) {
        return;
      }

      console.log('✅ [ProjectWorkspace] Проект найден в списке:', foundProject.name || foundProject.id);
      setProject(foundProject);

      // Загружаем данные с автоматической синхронизацией
      loadProjectData().then(data => {
        if (data) {
          setProjectData(data);
        }
      });
    } else if (projects.length > 0) {
      // Проекты загружены, но нужный проект не найден - пробуем загрузить напрямую из Supabase
      console.warn('⚠️ [ProjectWorkspace] Проект не найден в списке, пробуем загрузить напрямую:', id);
      supabaseDataStore.getProjects().then(allProjects => {
        const directProject = allProjects.find(p => {
          const projectId = p.id || p.notes?.id || '';
          return projectId === id || (typeof projectId === 'string' && projectId.includes(id));
        });
        if (directProject) {
          console.log('✅ [ProjectWorkspace] Проект найден напрямую из Supabase:', directProject.name || directProject.id);
          setProject(directProject);
          loadProjectData().then(data => {
            if (data) setProjectData(data);
          });
        } else {
          console.error('❌ [ProjectWorkspace] Проект не найден, перенаправление...');
          setTimeout(() => navigate('/projects'), 1000);
        }
      });
    }
    // Если projects.length === 0, просто ждем следующего рендера (проекты еще загружаются)
  }, [id, projects, loadProjectData, projectFromState, project]);

  const saveAuditPeriods = async (periods: AuditPeriod[]) => {
    const projectId = project?.id || project?.notes?.id || id;
    if (!projectId) return;

    await supabaseDataStore.updateProject(projectId, {
      ...(project?.notes || {}),
      auditPeriods: periods,
    });
    setProject((prev: any) => ({
      ...prev,
      auditPeriods: periods,
      notes: { ...(prev?.notes || {}), auditPeriods: periods },
    }));
    toast({
      title: 'Периоды обновлены',
      description: 'Изменения сохранены внутри проекта.',
    });
  };

  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-lg">Загрузка проекта...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in p-2 sm:p-4 md:p-0 w-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
          <Button
            variant="ghost"
            size="icon"
            className="flex-shrink-0"
            aria-label="Вернуться к списку проектов"
            title="Вернуться к списку проектов"
            onClick={() => {
              // Возвращаемся в SPA-историю, чтобы сохранить фильтры/сортировку
              // /projects в URL. Если истории нет (прямой переход по ссылке) —
              // фолбэк на чистый /projects.
              const hasHistory = (window.history.state as any)?.idx > 0;
              if (hasHistory) navigate(-1);
              else navigate('/projects');
            }}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-base sm:text-xl font-bold truncate max-w-full" title={project.name || project.client?.name || 'Проект'}>{project.name || project.client?.name || 'Проект'}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              {normalizedContract?.subject || project.contract?.subject || project.notes?.contract?.subject || 'Проект'}
              {projectTasks.length > 0 && ` • ${projectTasks.length} задач`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap pl-11 sm:pl-0 flex-shrink-0">
          {/* Кнопка редактирования для закупщика и админа */}
          {isProcurementOrAdmin && project && (
            <Button variant="outline" size="sm" onClick={() => setIsEditDialogOpen(true)}>
              <Edit className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Редактировать</span>
            </Button>
          )}
          {/* Индикатор синхронизации */}
          {syncStatus.isSyncing && (
            <Badge variant="outline" className="animate-pulse text-xs">
              🔄 Синхр...
            </Badge>
          )}
          {!syncStatus.isSyncing && syncStatus.isOnline && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs hidden sm:flex">
              ✅ Синхронизировано
            </Badge>
          )}
          {!syncStatus.isSyncing && !syncStatus.isOnline && (
            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">
              💾 Локально
            </Badge>
          )}
          {projectData && projectData.completionStatus && (
            <Badge className="bg-gradient-to-r from-blue-500 to-blue-700 text-sm sm:text-lg px-2 sm:px-4 py-1 sm:py-2">
              {projectData.completionStatus.percentage || 0}%
            </Badge>
          )}
        </div>
      </div>

      <ProjectFlatSummary
        project={project}
        projectTasks={projectTasks}
        projectHours={projectHours}
        employees={employees || []}
        normalizedContract={normalizedContract}
        normalizedFinances={normalizedFinances}
        normalizedFiles={normalizedFiles}
        normalizedStartDate={normalizedStartDate}
        normalizedDeadline={normalizedDeadline}
        amendments={amendments}
        projectStatus={projectStatus}
        currentProjectCompany={currentProjectCompany}
        canManageProjectCompany={canManageProjectCompany}
        activeCompanies={activeCompanies}
        companyDraftId={companyDraftId}
        setCompanyDraftId={setCompanyDraftId}
        saveProjectCompany={() => void saveProjectCompany()}
        isSavingCompany={isSavingCompany}
        canEditTeam={canEditTeam}
        onEditTeam={() => {
          loadTeamIntoSlots(project);
          setShowTeamDialog(true);
        }}
        canSeeFinance={Boolean(
          (project.financialVisibility?.enabled && project.financialVisibility?.visibleTo?.includes(user?.id || ''))
          || !project.financialVisibility
          || ((normalizedFinances?.amountWithoutVAT > 0 || project.finances) && (isPartner || isDirector || isAdmin || isPM))
        )}
      />

      {/* Вкладки оставлены только для редактирования/детальных рабочих операций. Основная информация выше в своде. */}
      <Tabs defaultValue={isProcurement ? "files" : "periods"} className="w-full">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1">
          {!(isDirector || isAdmin || isProcurement) && <TabsTrigger value="tasks" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5">✅ Задачи</TabsTrigger>}
          <TabsTrigger value="periods" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5">📆 Периоды</TabsTrigger>
          <TabsTrigger value="files" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5">📁 Файлы</TabsTrigger>
          <TabsTrigger value="contract" className="text-xs sm:text-sm px-2 sm:px-3 py-1.5">📜 Договор</TabsTrigger>
        </TabsList>

        {/* Вкладка задач */}
        {!(isDirector || isAdmin) && (
          <TabsContent value="tasks" className="mt-4">
            <Tasks projectId={project?.id || id} embedded />
          </TabsContent>
        )}

        <TabsContent value="periods" className="space-y-4 mt-4">
          <AuditPeriodsEditor
            project={project}
            employees={employees || []}
            currentUserId={user?.id}
            canEdit={canEditAuditPeriods}
            onSave={saveAuditPeriods}
          />
        </TabsContent>

        {/* Вкладка файлов */}
        <TabsContent value="files" className="space-y-4 mt-4">
          <ProjectFileManager
            projectId={project?.id || id || ''}
            uploadedBy={user?.id || ''}
            initialFiles={normalizedFiles}
            canUpload={isProcurementOrAdmin}
            canDelete={() => isProcurementOrAdmin}
            onFilesChange={(files) => {
              setProject((current: any) => {
                if (!current) return current;
                const currentKeys = (current.notes?.files || []).map(projectFileKey).join('|');
                const nextKeys = (files || []).map(projectFileKey).join('|');
                if (currentKeys === nextKeys) return current;
                return {
                  ...current,
                  notes: {
                    ...(current.notes || {}),
                    files,
                  },
                };
              });
            }}
          />
        </TabsContent>

        {/* Вкладка договора и доп соглашений */}
        <TabsContent value="contract" className="space-y-4 mt-4">
          <ContractEditor
            projectId={project?.id || id || ''}
            contract={normalizedContract}
            amendments={amendments}
            projectType={project?.type || project?.notes?.type || ''}
            companyId={project?.companyId || project?.notes?.companyId || ''}
            companyName={project?.companyName || project?.notes?.companyName || ''}
            projectFiles={normalizedFiles}
            canEdit={isProcurementOrAdmin}
            onContractUpdate={async (updatedContract, uploadedFiles = []) => {
              if (project) {
                const contractUpdate = buildContractUpdate(project, updatedContract, uploadedFiles);

                // Обновляем ВСЕ поля локального состояния сразу
                setProject({
                  ...project,
                  ...contractUpdate,
                });

                // Сохраняем в Supabase
                try {
                  const savedProject = await supabaseDataStore.updateProject(project.id || id, {
                    contract: contractUpdate.contract,
                    finances: contractUpdate.finances,
                    amountWithoutVAT: contractUpdate.amountWithoutVAT,
                    files: contractUpdate.files,
                  });
                  if (savedProject) setProject(savedProject as any);
                  toast({
                    title: '✅ Договор обновлён',
                    description: 'Изменения сохранены',
                  });
                } catch (error) {
                  console.error('Error updating project:', error);
                  toast({
                    title: '❌ Ошибка',
                    description: 'Не удалось сохранить договор',
                    variant: 'destructive',
                  });
                }
              }
            }}
            onProjectSettingsUpdate={async (settings) => {
              if (project) {
                setProject((current: any) => {
                  const source = current || project;
                  return {
                    ...source,
                    ...(settings.type && { type: settings.type }),
                    ...(settings.companyId && { companyId: settings.companyId }),
                    ...(settings.companyName && { companyName: settings.companyName }),
                    notes: {
                      ...(source?.notes || {}),
                      ...(settings.type && { type: settings.type }),
                      ...(settings.companyId && { companyId: settings.companyId }),
                      ...(settings.companyName && { companyName: settings.companyName }),
                    },
                  };
                });

                try {
                  await supabaseDataStore.updateProject(project.id || id, {
                    ...(settings.type && { type: settings.type }),
                    ...(settings.companyId && { companyId: settings.companyId }),
                    ...(settings.companyName && { companyName: settings.companyName }),
                  });
                } catch (error) {
                  console.error('Error updating project settings:', error);
                }
              }
            }}
            onAmendmentAdd={async (amendment) => {
              if (!project) return;
              const saved = await supabaseDataStore.createProjectAmendment(
                project.id || id,
                {
                  number: amendment.number,
                  date: amendment.date,
                  description: amendment.description,
                  fileUrl: amendment.fileUrl,
                },
                String((user as any)?.id || user?.email || 'system')
              );
              const savedAmendment = mapProjectAmendmentRecord(saved);
              const nextAmendments = [
                savedAmendment,
                ...amendments.filter((item) => item.id !== savedAmendment.id),
              ];
              const nextContract = {
                ...(project.contract || project.notes?.contract || {}),
                amendments: nextAmendments,
              };
              setAmendments(nextAmendments);
              setProject((current: any) => current ? ({
                ...current,
                contract: nextContract,
                notes: {
                  ...(current.notes || {}),
                  amendments: nextAmendments,
                  contract: nextContract,
                },
              }) : current);
              toast({
                title: 'Доп. соглашение сохранено',
              });
            }}
            onAmendmentDelete={async (amendmentId) => {
              await supabaseDataStore.deleteProjectAmendment(amendmentId);
              const nextAmendments = amendments.filter(a => a.id !== amendmentId);
              setAmendments(nextAmendments);
              if (project) {
                const nextContract = {
                  ...(project.contract || project.notes?.contract || {}),
                  amendments: nextAmendments,
                };
                await supabaseDataStore.updateProject(project.id || id, {
                  ...(project.notes || {}),
                  amendments: nextAmendments,
                  contract: nextContract,
                });
                setProject((current: any) => current ? ({
                  ...current,
                  contract: nextContract,
                  notes: {
                    ...(current.notes || {}),
                    amendments: nextAmendments,
                    contract: nextContract,
                  },
                }) : current);
              }
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Этапы аудита и паспорт проекта — УБРАНЫ */}

      {/* Кнопка перевода в «готов к закрытию» — для PM */}
      {canMarkReady && !isCompleted && !isPendingPaymentApproval && !isReadyToComplete && (
        <Card className="p-6 border-blue-200 bg-blue-50">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold mb-2">Готов к закрытию?</h3>
              <p className="text-sm text-muted-foreground">
                {isDeputy
                  ? 'Как заместитель директора, отметьте проект готовым. После проверки его можно сразу передать CEO для утверждения бонусов.'
                  : 'Как PM, отметь проект готовым. Партнёр проекта получит уведомление и утвердит завершение, после чего CEO одобрит бонусы.'}
              </p>
            </div>
            <Button
              onClick={() => setShowCompleteDialog(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Готов к закрытию
            </Button>
          </div>
        </Card>
      )}

      {/* Кнопка финального утверждения партнёром */}
      {canApproveCompletion && (
        <Card className="p-6 border-amber-200 bg-amber-50">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold mb-2">Проект готов — твоё утверждение</h3>
              <p className="text-sm text-muted-foreground">
                {isDeputy
                  ? 'Как заместитель директора, подтвердите готовность. Проект уйдёт CEO в раздел «Бонусы» с финальным расчётом по утверждённым таймшитам.'
                  : 'Как партнёр, утверди завершение. Проект уйдёт CEO в раздел «Бонусы» с финальным расчётом по таймщитам.'}
              </p>
            </div>
            <Button
              onClick={() => setShowCompleteDialog(true)}
              className="bg-amber-600 hover:bg-amber-700"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Утвердить завершение
            </Button>
          </div>
        </Card>
      )}

      {/* Статус завершенного проекта */}
      {isPendingPaymentApproval && (
        <Card className="p-6 border-blue-200 bg-blue-50">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-blue-600" />
            <div>
              <h3 className="font-semibold text-blue-900">Ожидает утверждения CEO</h3>
              <p className="text-sm text-blue-700">
                Проект уже передан на финальную проверку. CEO может скорректировать бонусы и закрыть его в разделе "Бонусы".
              </p>
            </div>
          </div>
        </Card>
      )}

      {isCompleted && (
        <Card className="p-6 border-green-200 bg-green-50">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
            <div>
              <h3 className="font-semibold text-green-900">Проект завершен</h3>
              <p className="text-sm text-green-700">
                Бонусы автоматически рассчитаны и начислены команде. Проверьте раздел "Бонусы".
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Диалог подтверждения — текст зависит от текущего этапа */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isReadyToComplete ? 'Утвердить завершение проекта?' : 'Отметить проект готовым к закрытию?'}
            </DialogTitle>
            <DialogDescription>
              {isReadyToComplete ? (
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Статус: «Готов к закрытию» → «Ожидает утверждения бонусов»</li>
                  <li>Рассчитаются финальные бонусы команды с учётом часов из таймщитов</li>
                  <li>CEO увидит проект в разделе «Бонусы» и утвердит выплаты</li>
                  <li>После одобрения CEO проект закроется окончательно</li>
                </ul>
              ) : (
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Статус: «В работе» → «Готов к закрытию»</li>
                  <li>Партнёр проекта получит уведомление и сможет утвердить завершение</li>
                  <li>До утверждения партнёра проект можно отозвать</li>
                </ul>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>
              Отмена
            </Button>
            <Button
              onClick={async () => {
                if (!project || !user) return;

                try {
                  // Переход статуса зависит от текущего:
                  //   approved/in_progress/planning → ready_to_complete (PM «Готов к закрытию»)
                  //   ready_to_complete → pending_payment_approval (партнёр «Утверждаю»)
                  const nextStatus = isReadyToComplete ? 'pending_payment_approval' : 'ready_to_complete';
                  const updatedProject = {
                    ...project,
                    status: nextStatus,
                    notes: {
                      ...project.notes,
                      status: nextStatus,
                      ...(nextStatus === 'ready_to_complete'
                        ? {
                            markedReadyAt: new Date().toISOString(),
                            markedReadyBy: user.id,
                          }
                        : {
                            submittedForPaymentApprovalAt: new Date().toISOString(),
                            submittedForPaymentApprovalBy: user.id,
                          }),
                    }
                  };

                  // Сохраняем в Supabase
                  await supabaseDataStore.updateProject(project.id, updatedProject);

                  // Рассчитываем финансы и бонусы
                  const finances = calculateProjectFinances(updatedProject);

                  // Обновляем финансы проекта
                  const projectWithFinances = {
                    ...updatedProject,
                    finances: {
                      ...updatedProject.finances,
                      ...finances
                    }
                  };

                  await supabaseDataStore.updateProject(project.id, projectWithFinances);

                  // Уведомления по этапу:
                  //  - nextStatus = ready_to_complete (PM «Готов») → уведомить ПАРТНЁРА проекта
                  //  - nextStatus = pending_payment_approval (партнёр «Утверждаю») → уведомить CEO/admin
                  const team = updatedProject.team || [];
                  const partner = team.find((m: any) => m.role === 'partner');
                  const projectName = updatedProject.name || updatedProject.title || 'Проект';

                  if (nextStatus === 'ready_to_complete' && partner?.userId) {
                    notifyReadyForPartnerApproval({
                      projectName,
                      partnerId: partner.userId,
                      pmName: user.name,
                      projectId: project.id,
                    });
                  } else if (nextStatus === 'pending_payment_approval') {
                    const ceoIds = (employees || []).filter((e: any) => e.role === 'ceo' || e.role === 'admin').map((e: any) => e.id);
                    if (ceoIds.length > 0) {
                      notifyProjectReadyForCeoBonuses({
                        projectName,
                        ceoIds,
                        partnerName: user.name,
                        projectId: project.id,
                      });
                    }
                  }

                  toast({
                    title: 'Отправлено на утверждение CEO',
                    description: 'Бонусы рассчитаны. После одобрения CEO в разделе «Бонусы» проект закроется окончательно.',
                  });

                  setShowCompleteDialog(false);

                  // Обновляем проект в локальном состоянии
                  setProject(projectWithFinances);

                  // Перезагружаем страницу через 2 секунды
                  setTimeout(() => {
                    window.location.reload();
                  }, 2000);
                } catch (error: any) {
                  console.error('Ошибка при завершении проекта:', error);
                  toast({
                    title: 'Ошибка',
                    description: error.message || 'Не удалось завершить проект',
                    variant: 'destructive'
                  });
                }
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              Да, завершить проект
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог назначения команды — слоты по ролям. Только для admin/ceo и
          для зам.директора пока проект на стадии сборки команды. */}
      <Dialog open={showTeamDialog && canEditTeam} onOpenChange={(open) => {
        setShowTeamDialog(open);
        if (!open) {
          setOpenSlotDropdown(null);
          setAddingNewInSlot(null);
          setNewEmployeeName('');
          setSlotSearch('');
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Назначение команды проекта
            </DialogTitle>
            <DialogDescription>
              Выберите сотрудника для каждой роли или добавьте нового прямо здесь
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4 flex-1 overflow-y-auto">
            <TeamAssignment
              employees={employees || []}
              teamSlots={teamSlots}
              slots={TEAM_ROLE_SLOTS as any}
              onChange={setTeamSlots}
              onAddNewEmployee={(slotKey) => {
                setAddingNewInSlot(slotKey);
                setNewEmployeeName('');
                setNewEmployeeType(slotKey.startsWith('gph') ? 'gph' : 'staff');
              }}
            />

            {addingNewInSlot && (
              <div className="mt-4 p-4 border rounded-xl bg-muted/30 space-y-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase">
                  Новый сотрудник для роли «{TEAM_ROLE_SLOTS.find(s => s.key === addingNewInSlot)?.label}»
                </div>
                <Input
                  placeholder="ФИО сотрудника"
                  value={newEmployeeName}
                  onChange={(e) => setNewEmployeeName(e.target.value)}
                  className="h-10 text-sm"
                  autoFocus
                />
                {addingNewInSlot.startsWith('gph') && (
                  <div className="flex gap-2">
                    <Button
                      variant={newEmployeeType === 'gph' ? 'default' : 'outline'}
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => setNewEmployeeType('gph')}
                    >
                      ГПХ
                    </Button>
                    <Button
                      variant={newEmployeeType === 'subcontract' ? 'default' : 'outline'}
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => setNewEmployeeType('subcontract')}
                    >
                      Субподряд
                    </Button>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs h-9"
                    onClick={() => setAddingNewInSlot(null)}
                  >
                    Отмена
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 text-xs h-9"
                    disabled={!newEmployeeName.trim()}
                    onClick={async () => {
                      try {
                        const slot = TEAM_ROLE_SLOTS.find(s => s.key === addingNewInSlot)!;
                        const empRole = addingNewInSlot.startsWith('gph')
                          ? (newEmployeeType === 'gph' ? 'employee' : 'employee')
                          : (slot.roles[0] || 'employee');

                        const { data: newEmp, error } = await supabase
                          .from('employees')
                          .insert({
                            name: newEmployeeName.trim(),
                            role: empRole as any,
                            level: '1' as any,
                            email: `placeholder_${Date.now()}@temp.local`,
                          })
                          .select('id')
                          .single();

                        if (error) throw error;

                        setTeamSlots(prev => ({ ...prev, [addingNewInSlot]: newEmp.id }));
                        setAddingNewInSlot(null);
                        setNewEmployeeName('');

                        toast({
                          title: 'Сотрудник создан',
                          description: `${newEmployeeName.trim()} добавлен и назначен на роль`,
                        });
                      } catch (err: any) {
                        toast({
                          title: 'Ошибка',
                          description: err.message || 'Не удалось создать сотрудника',
                          variant: 'destructive',
                        });
                      }
                    }}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Создать и назначить
                  </Button>
                </div>
              </div>
            )}
          </div>


          <div className="flex justify-between items-center pt-2 border-t">
            <div className="text-xs text-muted-foreground">
              Назначено: {Object.values(teamSlots).filter(Boolean).length} из {TEAM_ROLE_SLOTS.length}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowTeamDialog(false)}>
                Отмена
              </Button>
              <Button
                onClick={async () => {
                  try {
                    // Формируем команду из слотов
                    const existingTeam = project?.team || project?.notes?.team || [];
                    const existingMemberIds = new Set(
                      existingTeam.map((m: any) => m?.userId || m?.id || m?.employeeId).filter(Boolean),
                    );
                    const fullTeam = TEAM_ROLE_SLOTS
                      .filter(slot => teamSlots[slot.key])
                      .map(slot => {
                        const empId = teamSlots[slot.key]!;
                        const emp = (employees || []).find((e: any) => e.id === empId);
                        const isGph = slot.key.startsWith('gph');
                        return {
                          userId: empId,
                          name: emp?.name || '',
                          userName: emp?.name || '',
                          role: emp?.role || slot.label,
                          slotKey: slot.key,
                          type: isGph ? (newEmployeeType || 'gph') : 'staff',
                          assignedAt: new Date().toISOString(),
                          assignedBy: user?.id || '',
                        };
                      });

                    const projectId = project?.id || project?.notes?.id || id;
                    const nextStatus = fullTeam.length > 0 ? 'in_progress' : (project?.notes?.status || project?.status || 'approved');
                    const updatedNotes = {
                      ...(project?.notes || {}),
                      team: fullTeam,
                      status: nextStatus,
                      teamAssembledAt: fullTeam.length > 0 ? new Date().toISOString() : project?.notes?.teamAssembledAt,
                      teamAssembledBy: fullTeam.length > 0 ? (user?.id || '') : project?.notes?.teamAssembledBy,
                    };

                    await supabaseDataStore.updateProject(projectId, {
                      team: fullTeam,
                      status: nextStatus,
                      notes: updatedNotes
                    });

                    const projectName = project?.name || project?.title || project?.notes?.name || 'Проект';
                    const notifyIds = fullTeam
                      .map((m: any) => m.userId)
                      .filter(Boolean);
                    const isInitialTeamAssignment = existingMemberIds.size === 0 && notifyIds.length > 0;

                    try {
                      if (isInitialTeamAssignment) {
                        await notifyTeamAssembled({
                          projectName,
                          teamIds: notifyIds,
                          projectId,
                          pmName: user?.name || 'Зам. директора',
                        });
                      } else {
                        const newlyAdded = fullTeam.filter((m: any) => m.userId && !existingMemberIds.has(m.userId));
                        await Promise.all(newlyAdded.map((member: any) =>
                          notifyTeamMemberAdded({
                            projectName,
                            memberId: member.userId,
                            memberName: member.userName || member.name || 'Участник',
                            role: member.slotKey || member.role || 'участник команды',
                            assignerName: user?.name || 'Зам. директора',
                            projectId,
                          })
                        ));
                      }
                    } catch (notifyError) {
                      console.error('[ProjectWorkspace] team notifications failed', notifyError);
                    }

                    setProject((prev: any) => ({
                      ...prev,
                      status: nextStatus,
                      team: fullTeam,
                      notes: updatedNotes
                    }));

                    setShowTeamDialog(false);

                    toast({
                      title: 'Команда назначена',
                      description: `${fullTeam.length} участников добавлены в проект. Статус переведён в работу, уведомления отправлены.`
                    });
                  } catch (error: any) {
                    console.error('Ошибка назначения команды:', error);
                    toast({
                      title: 'Ошибка',
                      description: error.message || 'Не удалось назначить команду',
                      variant: 'destructive'
                    });
                  }
                }}
                disabled={Object.values(teamSlots).filter(Boolean).length === 0}
              >
                <Users className="w-4 h-4 mr-2" />
                Назначить команду ({Object.values(teamSlots).filter(Boolean).length})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог редактирования для закупщика */}
      {project && (
        <ProjectEditProcurement
          project={project}
          isOpen={isEditDialogOpen}
          onClose={() => setIsEditDialogOpen(false)}
          onSave={(updatedProject) => {
            setProject(updatedProject);
            setIsEditDialogOpen(false);
          }}
        />
      )}
    </div>
  );
}
