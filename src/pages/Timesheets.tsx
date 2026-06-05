import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useEmployees } from '@/hooks/useSupabaseData';
import { useProjects } from '@/hooks/useSupabaseData';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  listTimesheets,
  createEntry,
  updateEntry,
  deleteEntry,
  approveEntries,
  rejectEntries,
  type TimesheetEntry as DbTimesheetEntry,
} from '@/lib/timesheets';
import { 
  Clock,
  Calendar,
  User,
  Briefcase,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  Download,
  Plus,
  Edit,
  Trash2,
  Check,
  ChevronsUpDown
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface TimesheetEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  projectId?: string;
  projectName?: string;
  date: string;
  hours: number;
  description: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
}

/**
 * Аудиторские секции из xlsx-таймщитов. Соответствует колонке
 * «Категория Секция» которую заполняют ассистенты/менеджеры в Drive-файлах.
 * Сгруппированы по фазе аудита для удобства выбора в дропдауне.
 */
const AUDIT_SECTIONS_GROUPED: { group: string; items: string[] }[] = [
  {
    group: 'Планирование',
    items: [
      'Планирование — Подготовка процедур оценки риска',
      'Планирование — Существенность',
      'Планирование — Общая стратегия аудита',
      'Планирование — Понимание клиента и среды',
      'Планирование — Оценка рисков',
    ],
  },
  {
    group: 'Активы',
    items: [
      'Процедуры — Активы — Основные средства',
      'Процедуры — Активы — Запасы',
      'Процедуры — Активы — Дебиторская задолженность',
      'Процедуры — Активы — Денежные средства',
      'Процедуры — Активы — Прочие активы',
      'Процедуры — Активы — НМА',
      'Процедуры — Активы — Инвестиции',
    ],
  },
  {
    group: 'Обязательства и капитал',
    items: [
      'Процедуры — Обязательства — Кредиторская задолженность',
      'Процедуры — Обязательства — Займы',
      'Процедуры — Обязательства — Налоги',
      'Процедуры — Капитал',
    ],
  },
  {
    group: 'Доходы и расходы',
    items: [
      'Процедуры — Доходы',
      'Процедуры — Себестоимость',
      'Процедуры — Расходы по реализации',
      'Процедуры — Прочие доходы и расходы',
    ],
  },
  {
    group: 'Завершение',
    items: [
      'Завершение аудита — Завершение аудиторского задания',
      'Завершение аудита — Подготовка отчёта',
      'Завершение аудита — События после отчётной даты',
    ],
  },
  {
    group: 'Прочее',
    items: [
      'Налоговая работа',
      'Консультации',
      'Обучение',
      'Документирование',
      'Прочее',
    ],
  },
];

const getProjectName = (project: any) => project?.name || project?.title || 'Без проекта';
const getProjectClient = (project: any): string => {
  // project.client пришёл из mapSupabaseProject как объект
  // {name, website, activity, city, contacts}. Раньше функция возвращала
  // весь объект, и {client} в JSX падал с React #31.
  const raw = project?.client ?? project?.notes?.client;
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && typeof raw.name === 'string') return raw.name;
  return (
    project?.clientName ||
    project?.notes?.clientName ||
    project?.companyName ||
    project?.notes?.companyName ||
    project?.company ||
    ''
  );
};

// Combobox с поиском по аудиторским секциям. Группы (Планирование, Активы,…)
// рендерятся через CommandGroup. Подходит для длинных списков, который не
// влезают в shadcn-Select из-за <div>-обёрток.
function SectionCombobox({
  value,
  onChange,
  triggerClassName,
}: {
  value: string;
  onChange: (v: string) => void;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const displayed = value || '— Не указано —';
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full max-w-full min-w-0 justify-between bg-muted/40 border-0 font-normal',
            !value && 'text-muted-foreground',
            triggerClassName,
          )}
        >
          <span className="truncate flex-1 text-left">{displayed}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="p-0 w-[--radix-popover-trigger-width] min-w-[280px] max-h-[60vh] overflow-hidden"
      >
        <Command>
          <CommandInput placeholder="Найти секцию..." />
          <CommandList>
            <CommandEmpty>Не найдено</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="не указано none"
                onSelect={() => {
                  onChange('');
                  setOpen(false);
                }}
              >
                <Check className={cn('mr-2 h-4 w-4', !value ? 'opacity-100' : 'opacity-0')} />
                — Не указано —
              </CommandItem>
            </CommandGroup>
            {AUDIT_SECTIONS_GROUPED.map((g) => (
              <CommandGroup key={g.group} heading={g.group}>
                {g.items.map((s) => {
                  const short = s.replace(/^[^—]+—\s*/, '');
                  return (
                    <CommandItem
                      key={s}
                      value={s}
                      onSelect={() => {
                        onChange(s);
                        setOpen(false);
                      }}
                    >
                      <Check className={cn('mr-2 h-4 w-4', value === s ? 'opacity-100' : 'opacity-0')} />
                      <span className="truncate">{short}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Combobox с поиском по проектам.
// Группирует проекты на «Мои» (где пользователь в команде) и «Все остальные»,
// чтобы из любого количества проектов можно было найти нужный по названию/клиенту.
function ProjectCombobox({
  projects,
  myProjectIds,
  value,
  onChange,
  placeholder = 'Выберите проект',
  allowAll = false,
  triggerClassName,
}: {
  projects: any[];
  myProjectIds: Set<string>;
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  allowAll?: boolean; // показывать ли пункт «Все проекты» (для фильтра)
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);

  const selected = useMemo(() => {
    if (allowAll && value === 'all') return { name: 'Все проекты' };
    return projects.find((p: any) => p.id === value) || null;
  }, [projects, value, allowAll]);

  const myList = useMemo(
    () => projects.filter((p: any) => myProjectIds.has(p.id)),
    [projects, myProjectIds],
  );
  const otherList = useMemo(
    () => projects.filter((p: any) => !myProjectIds.has(p.id)),
    [projects, myProjectIds],
  );

  const renderItem = (p: any) => {
    const name = getProjectName(p);
    const client = getProjectClient(p);
    // CommandItem matches по value — кладём туда и название, и клиента,
    // чтобы поиск находил по обоим.
    return (
      <CommandItem
        key={p.id}
        value={`${name} ${client}`}
        onSelect={() => {
          onChange(p.id);
          setOpen(false);
        }}
      >
        <Check className={cn('mr-2 h-4 w-4', value === p.id ? 'opacity-100' : 'opacity-0')} />
        <div className="flex flex-col min-w-0">
          <span className="truncate">{name}</span>
          {client && <span className="text-xs text-muted-foreground truncate">{client}</span>}
        </div>
      </CommandItem>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full max-w-full min-w-0 justify-between bg-muted/40 border-0 font-normal',
            !selected && 'text-muted-foreground',
            triggerClassName,
          )}
        >
          <span className="truncate flex-1 text-left">{selected ? getProjectName(selected) : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="p-0 w-[--radix-popover-trigger-width] min-w-[260px]"
      >
        <Command>
          <CommandInput placeholder="Поиск проекта или клиента..." />
          <CommandList>
            <CommandEmpty>Проекты не найдены</CommandEmpty>
            {allowAll && (
              <CommandGroup>
                <CommandItem
                  value="__all__ все проекты"
                  onSelect={() => {
                    onChange('all');
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === 'all' ? 'opacity-100' : 'opacity-0')} />
                  Все проекты
                </CommandItem>
              </CommandGroup>
            )}
            {myList.length > 0 && (
              <CommandGroup heading="Мои проекты">
                {myList.map(renderItem)}
              </CommandGroup>
            )}
            {otherList.length > 0 && (
              <CommandGroup heading={myList.length > 0 ? 'Остальные проекты' : 'Все проекты'}>
                {otherList.map(renderItem)}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function Timesheets() {
  const { user } = useAuth();
  const { projects = [] } = useProjects();
  const { employees = [] } = useEmployees();
  const { toast } = useToast();
  const [timesheets, setTimesheets] = useState<TimesheetEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'submitted' | 'approved' | 'rejected'>('all');
  // Пустая строка = «все даты». По умолчанию показываем все, иначе при
  // открытии страницы пользователь видит только то, что заполнил сегодня —
  // выглядит как «фильтр не работает».
  const [filterDate, setFilterDate] = useState('');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingTimesheet, setEditingTimesheet] = useState<TimesheetEntry | null>(null);
  
  // Форма. isAdminWork=true → проект не нужен, в БД сохраняем
  // project_id=null + project_name='Административная работа' (тот же маркер
  // что и в xlsx-импорте для админ-строк, см. project_timesheet_format).
  const [formData, setFormData] = useState({
    projectId: '',
    isAdminWork: false,
    date: new Date().toISOString().split('T')[0],
    hours: '8',
    description: '',
    section: '',
  });

  // Режим: список (старый) или календарь (новый, быстрый ввод).
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar');
  // Месяц для календаря.
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  // Проверяем, может ли пользователь заполнять тайм-щиты
  const canFillTimesheets = user && user.role !== 'ceo' && user.role !== 'deputy_director';
  const canReviewTimesheets = !!user && ['ceo', 'admin', 'deputy_director', 'partner', 'manager_1', 'manager_2', 'manager_3'].includes(user.role);
  
  // Проекты, где пользователь в команде. Используется для группы «Мои проекты»
  // в комбобоксе — но в общем списке доступны ВСЕ проекты, чтобы можно было
  // найти любой по поиску.
  const myProjectIds = useMemo(() => {
    const ids = new Set<string>();
    if (!user) return ids;
    for (const p of projects as any[]) {
      const team = p.team || [];
      if (team.some((m: any) => m.userId === user.id || m.id === user.id)) {
        ids.add(p.id);
      }
    }
    return ids;
  }, [projects, user]);

  // Полный список проектов для комбобокса — все, не только «свои».
  const allProjects = useMemo(() => (projects as any[]).slice(), [projects]);

  // Маппинг записи из БД в UI-формат (старый локальный TimesheetEntry).
  const toUiEntry = useCallback(
    (e: DbTimesheetEntry): TimesheetEntry => {
      const employee = employees.find((emp: any) => emp.id === e.employeeId);
      const project = e.projectId ? projects.find((p: any) => p.id === e.projectId) : null;
      return {
        id: e.id,
        employeeId: e.employeeId,
        employeeName: employee?.name || e.employeeName || 'Неизвестный сотрудник',
        projectId: e.projectId || undefined,
        projectName: getProjectName(project) || e.projectName,
        date: e.workDate,
        hours: e.hours,
        description: e.notes || '',
        status: e.status as TimesheetEntry['status'],
        reviewedBy: e.reviewedByName,
        reviewedAt: e.reviewedAt,
      };
    },
    [employees, projects],
  );

  // Загружаем тайм-шиты из Supabase.
  const reload = useCallback(async () => {
    const entries = await listTimesheets();
    setTimesheets(entries.map(toUiEntry));
  }, [toUiEntry]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Фильтруем тайм-щиты по текущему пользователю (если не админ/CEO)
  const visibleTimesheets = useMemo(() => {
    if (!user) return [];
    if (canReviewTimesheets) {
      return timesheets;
    }
    return timesheets.filter(ts => ts.employeeId === user.id);
  }, [timesheets, user, canReviewTimesheets]);

  // Фильтрация
  const filteredTimesheets = useMemo(() => {
    return visibleTimesheets.filter(ts => {
      const matchesSearch = 
        ts.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ts.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ts.projectName?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = filterStatus === 'all' || ts.status === filterStatus;
      const matchesDate = !filterDate || ts.date === filterDate;
      const matchesProject = filterProject === 'all' || ts.projectId === filterProject;

      return matchesSearch && matchesStatus && matchesDate && matchesProject;
    });
  }, [visibleTimesheets, searchTerm, filterStatus, filterDate, filterProject]);

  // Сохранение тайм-щита
  const saveTimesheet = async () => {
    if (!user) return;

    // Для админ-работы проект не нужен — это часы офисной работы без
    // привязки к конкретному проекту (см. project_timesheet_format).
    if (!formData.isAdminWork && !formData.projectId) {
      toast({ title: 'Ошибка', description: 'Выберите проект или отметьте «Административная работа»', variant: 'destructive' });
      return;
    }

    if (!formData.hours || parseFloat(formData.hours) <= 0) {
      toast({ title: 'Ошибка', description: 'Укажите количество часов', variant: 'destructive' });
      return;
    }

    const projectName = formData.isAdminWork
      ? ADMIN_WORK_LABEL
      : getProjectName(projects.find((p: any) => p.id === formData.projectId));
    const projectId = formData.isAdminWork ? null : formData.projectId;
    const hours = parseFloat(formData.hours);
    const description = formData.description || (formData.isAdminWork ? 'Офисная работа без проекта' : 'Работа над проектом');

    if (editingTimesheet) {
      const updated = await updateEntry(editingTimesheet.id, {
        projectId,
        projectName,
        workDate: formData.date,
        hours,
        notes: description,
        section: formData.section || undefined,
      });
      if (!updated) {
        toast({ title: 'Ошибка', description: 'Не удалось обновить запись', variant: 'destructive' });
        return;
      }
    } else {
      const created = await createEntry({
        employeeId: user.id,
        employeeName: user.name,
        projectId,
        projectName,
        workDate: formData.date,
        hours,
        notes: description,
        source: 'manual',
        status: 'draft',
        createdBy: user.id,
        section: formData.section || undefined,
      });
      if (!created) {
        toast({ title: 'Ошибка', description: 'Не удалось создать запись', variant: 'destructive' });
        return;
      }
    }

    await reload();

    toast({ title: 'Успешно', description: editingTimesheet ? 'Тайм-щит обновлен' : 'Тайм-щит создан' });
    setShowAddDialog(false);
    setEditingTimesheet(null);
    setFormData({
      projectId: '',
      isAdminWork: false,
      date: new Date().toISOString().split('T')[0],
      hours: '8',
      description: '',
      section: '',
    });
  };

  // Открытие формы редактирования
  const handleEdit = (timesheet: TimesheetEntry) => {
    if (!user || timesheet.employeeId !== user.id) return;
    if (timesheet.status === 'approved') {
      toast({ title: 'Ошибка', description: 'Нельзя редактировать утвержденный тайм-щит', variant: 'destructive' });
      return;
    }
    setEditingTimesheet(timesheet);
    setFormData({
      projectId: timesheet.projectId || '',
      // Запись без projectId или с явным маркером — это админ-работа
      isAdminWork: !timesheet.projectId || timesheet.projectName === ADMIN_WORK_LABEL,
      date: timesheet.date,
      hours: timesheet.hours.toString(),
      description: timesheet.description,
      section: (timesheet as any).section || '',
    });
    setShowAddDialog(true);
  };

  // Удаление тайм-щита
  const handleDelete = async (timesheet: TimesheetEntry) => {
    if (!user || timesheet.employeeId !== user.id) return;
    if (timesheet.status === 'approved') {
      toast({ title: 'Ошибка', description: 'Нельзя удалить утвержденный тайм-щит', variant: 'destructive' });
      return;
    }
    const ok = await deleteEntry(timesheet.id);
    if (!ok) {
      toast({ title: 'Ошибка', description: 'Не удалось удалить', variant: 'destructive' });
      return;
    }
    await reload();
    toast({ title: 'Успешно', description: 'Тайм-щит удален' });
  };

  // Отправка на проверку
  const handleSubmit = async (timesheet: TimesheetEntry) => {
    if (!user || timesheet.employeeId !== user.id) return;
    const updated = await updateEntry(timesheet.id, { status: 'submitted' });
    if (!updated) {
      toast({ title: 'Ошибка', description: 'Не удалось отправить', variant: 'destructive' });
      return;
    }
    await reload();
    toast({ title: 'Успешно', description: 'Тайм-щит отправлен на проверку' });
  };

  const handleReview = async (timesheet: TimesheetEntry, status: 'approved' | 'rejected') => {
    if (!user || !canReviewTimesheets || timesheet.status !== 'submitted') return;
    const reviewer = { id: user.id, name: user.name };
    const n = status === 'approved'
      ? await approveEntries([timesheet.id], reviewer)
      : await rejectEntries([timesheet.id], reviewer, '');
    if (n === 0) {
      toast({ title: 'Ошибка', description: 'Не удалось изменить статус', variant: 'destructive' });
      return;
    }
    await reload();
    toast({
      title: status === 'approved' ? 'Тайм-щит утверждён' : 'Тайм-щит отклонён',
      description: `${timesheet.employeeName}: ${(timesheet.hours || 0).toFixed(1)} ч`,
    });
  };

  // Статистика
  const stats = useMemo(() => {
    const safeNumber = (val: number) => isNaN(val) || !isFinite(val) ? 0 : val;
    const total = safeNumber(filteredTimesheets.reduce((sum, ts) => sum + (ts.hours || 0), 0));
    const draft = filteredTimesheets.filter(ts => ts.status === 'draft').length;
    const submitted = filteredTimesheets.filter(ts => ts.status === 'submitted').length;
    const approved = filteredTimesheets.filter(ts => ts.status === 'approved').length;

    return { total, draft, submitted, approved, count: filteredTimesheets.length };
  }, [filteredTimesheets]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Утверждено</Badge>;
      case 'submitted':
        return <Badge className="bg-blue-500"><Clock className="w-3 h-3 mr-1" />На проверке</Badge>;
      case 'draft':
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Черновик</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Отклонено</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 page-enter">
      {/* Заголовок */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-cyan-500/15 flex items-center justify-center">
              <Clock className="w-5 h-5 text-cyan-500" />
            </span>
            Тайм-щиты
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Учет рабочего времени</p>
        </div>
        {canFillTimesheets && (
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2" onClick={() => {
                setEditingTimesheet(null);
                setFormData({
                  projectId: '',
                  isAdminWork: false,
                  date: new Date().toISOString().split('T')[0],
                  hours: '8',
                  description: '',
                  section: '',
                });
              }}>
                <Plus className="w-4 h-4" />
                Добавить
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg w-[calc(100vw-2rem)] sm:w-full max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingTimesheet ? 'Редактировать тайм-щит' : 'Новый тайм-щит'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                {/* Тип работы: проект ИЛИ административная (в офисе, без проекта) */}
                <label className="flex items-start gap-3 p-3 rounded-lg border bg-amber-50/40 dark:bg-amber-900/10 cursor-pointer hover:bg-amber-50/70 dark:hover:bg-amber-900/20 transition">
                  <input
                    type="checkbox"
                    checked={formData.isAdminWork}
                    onChange={(e) => setFormData({
                      ...formData,
                      isAdminWork: e.target.checked,
                      projectId: e.target.checked ? '' : formData.projectId,
                    })}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Административная работа</div>
                    <div className="text-xs text-muted-foreground">
                      Часы офисной работы без привязки к конкретному проекту — обучение, совещания, операционка
                    </div>
                  </div>
                </label>

                {!formData.isAdminWork && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Проект *</Label>
                    <ProjectCombobox
                      projects={allProjects}
                      myProjectIds={myProjectIds}
                      value={formData.projectId}
                      onChange={(id) => setFormData({ ...formData, projectId: id })}
                      placeholder="Выберите проект — введите название или клиента"
                      triggerClassName="w-full"
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Дата *</Label>
                    <Input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      className="bg-muted/40 border-0 focus-visible:ring-1"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Часы *</Label>
                    <Input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="24"
                      value={formData.hours}
                      onChange={(e) => setFormData({...formData, hours: e.target.value})}
                      placeholder="8.0"
                      className="bg-muted/40 border-0 focus-visible:ring-1"
                    />
                  </div>
                </div>
                {!formData.isAdminWork && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Секция аудита <span className="text-muted-foreground/60">— что именно делал на проекте</span>
                    </Label>
                    <SectionCombobox
                      value={formData.section}
                      onChange={(v) => setFormData({ ...formData, section: v })}
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Описание {formData.isAdminWork && <span className="text-amber-600 ml-1">— что именно делал в офисе</span>}
                  </Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder={formData.isAdminWork
                      ? 'Например: «совещание по бюджету», «обучение новых сотрудников», «работа с документами»'
                      : 'Опишите выполненную работу...'}
                    rows={3}
                    className="bg-muted/40 border-0 focus-visible:ring-1 resize-none"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => {
                    setShowAddDialog(false);
                    setEditingTimesheet(null);
                  }}>
                    Отмена
                  </Button>
                  <Button size="sm" onClick={saveTimesheet}>
                    {editingTimesheet ? 'Сохранить' : 'Создать'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Всего часов', value: (stats.total || 0).toFixed(1) + ' ч', sub: 'за день', icon: Clock, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
          { label: 'Черновики', value: stats.draft, sub: 'не отправлено', icon: Edit, color: 'text-gray-500', bg: 'bg-gray-500/10' },
          { label: 'На проверке', value: stats.submitted, sub: 'ожидают', icon: Filter, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { label: 'Утверждено', value: stats.approved, sub: 'принято', icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10' },
        ].map(({ label, value, sub, icon: Icon, color, bg }) => (
          <Card key={label} className="p-4 border-0 shadow-sm">
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground truncate">{label}</p>
                <p className="font-bold text-lg leading-tight">{value}</p>
                <p className="text-xs text-muted-foreground/60">{sub}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'list' | 'calendar')} className="w-full">
        <TabsList className="grid grid-cols-2 w-full sm:w-auto">
          <TabsTrigger value="calendar" className="gap-2">
            <Calendar className="w-4 h-4" /> Календарь
          </TabsTrigger>
          <TabsTrigger value="list" className="gap-2">
            <Filter className="w-4 h-4" /> Список
          </TabsTrigger>
        </TabsList>

        {/* Календарь — быстрое заполнение по дням месяца */}
        <TabsContent value="calendar" className="space-y-3 mt-3">
          {canFillTimesheets && user && (
            <MonthCalendar
              year={calendarMonth.year}
              month={calendarMonth.month}
              onMonthChange={setCalendarMonth}
              entries={visibleTimesheets.filter((t) => t.employeeId === user.id)}
              onCellClick={(date) => {
                setEditingTimesheet(null);
                setFormData({
                  projectId: '',
                  isAdminWork: false,
                  date,
                  hours: '8',
                  description: '',
                  section: '',
                });
                setShowAddDialog(true);
              }}
            />
          )}
        </TabsContent>

        {/* Список — старый вид с фильтрами */}
        <TabsContent value="list" className="space-y-3 mt-3">
      <Card className="p-3 sm:p-4 border-0 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Поиск по сотруднику, проекту..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-muted/40 border-0 focus-visible:ring-1"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="bg-muted/40 border-0 focus-visible:ring-1 text-sm"
            />
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
              <SelectTrigger className="bg-muted/40 border-0 text-sm">
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                <SelectItem value="draft">Черновик</SelectItem>
                <SelectItem value="submitted">На проверке</SelectItem>
                <SelectItem value="approved">Утверждено</SelectItem>
                <SelectItem value="rejected">Отклонено</SelectItem>
              </SelectContent>
            </Select>
            <ProjectCombobox
              projects={allProjects}
              myProjectIds={myProjectIds}
              value={filterProject}
              onChange={setFilterProject}
              placeholder="Все проекты"
              allowAll
              triggerClassName="text-sm h-10"
            />
          </div>
        </div>
      </Card>

      {/* Список тайм-шитов */}
      {filteredTimesheets.length === 0 ? (
        <Card className="p-12 text-center border-0 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-4">
            <Clock className="w-7 h-7 text-muted-foreground/50" />
          </div>
          <p className="font-medium text-muted-foreground">Тайм-щиты не найдены</p>
          <p className="text-sm text-muted-foreground/60 mt-1">
            {canFillTimesheets ? 'Нажмите «Добавить» для создания' : 'У вас нет доступа к заполнению тайм-щитов'}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredTimesheets.map((timesheet) => {
            const isOwner = user && timesheet.employeeId === user.id;
            const canEdit = isOwner && timesheet.status === 'draft';
            const canDelete = isOwner && timesheet.status === 'draft';
            const canSubmit = isOwner && timesheet.status === 'draft';
            const canApprove = canReviewTimesheets && timesheet.status === 'submitted';

            return (
              <Card key={timesheet.id} className="p-3 sm:p-4 border-0 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    timesheet.status === 'approved' ? 'bg-green-500/10' :
                    timesheet.status === 'submitted' ? 'bg-blue-500/10' :
                    timesheet.status === 'rejected' ? 'bg-red-500/10' : 'bg-muted/60'
                  }`}>
                    <Clock className={`w-5 h-5 ${
                      timesheet.status === 'approved' ? 'text-green-500' :
                      timesheet.status === 'submitted' ? 'text-blue-500' :
                      timesheet.status === 'rejected' ? 'text-red-500' : 'text-muted-foreground'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <h3 className="font-semibold text-sm">{timesheet.employeeName}</h3>
                      {getStatusBadge(timesheet.status)}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {timesheet.projectName && (
                        <span className="flex items-center gap-1 truncate">
                          <Briefcase className="w-3 h-3 flex-shrink-0" />{timesheet.projectName}
                        </span>
                      )}
                      <span className="flex items-center gap-1 flex-shrink-0">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(timesheet.date), 'dd MMM', { locale: ru })}
                      </span>
                    </div>
                    {timesheet.description && (
                      <p className="text-xs text-muted-foreground/70 mt-0.5 line-clamp-1">{timesheet.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right mr-1">
                      <p className="font-bold text-lg leading-tight text-primary">{(timesheet.hours || 0).toFixed(1)}<span className="text-xs font-normal text-muted-foreground ml-0.5">ч</span></p>
                    </div>
                    {(isOwner || canApprove) && (
                      <div className="flex gap-1">
                        {canSubmit && (
                          <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => handleSubmit(timesheet)}>
                            <span className="hidden sm:inline">Отправить</span>
                            <span className="sm:hidden">→</span>
                          </Button>
                        )}
                        {canEdit && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => handleEdit(timesheet)}>
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive" onClick={() => handleDelete(timesheet)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {canApprove && (
                          <>
                            <Button variant="outline" size="sm" className="text-xs h-8 border-green-200 text-green-700 hover:bg-green-50" onClick={() => handleReview(timesheet, 'approved')}>
                              <Check className="w-3.5 h-3.5 sm:mr-1" />
                              <span className="hidden sm:inline">Утвердить</span>
                            </Button>
                            <Button variant="outline" size="sm" className="text-xs h-8 border-red-200 text-red-700 hover:bg-red-50" onClick={() => handleReview(timesheet, 'rejected')}>
                              <XCircle className="w-3.5 h-3.5 sm:mr-1" />
                              <span className="hidden sm:inline">Отклонить</span>
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Календарная сетка месяца для быстрого заполнения тайм-щитов.
 * Каждая ячейка = один день. Цвет = заполнено/нет, выходной/будний.
 * Клик по дню → открывает диалог с предзаполненной датой.
 */
function MonthCalendar({
  year,
  month,
  onMonthChange,
  entries,
  onCellClick,
}: {
  year: number;
  month: number;
  onMonthChange: (m: { year: number; month: number }) => void;
  entries: TimesheetEntry[];
  onCellClick: (date: string) => void;
}) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const daysInMonth = last.getDate();
  // Понедельник = 0 для нашей сетки (стандартная неделя в KZ)
  const firstDow = (first.getDay() + 6) % 7;

  const pad = (n: number) => String(n).padStart(2, '0');
  const isoOf = (d: number) => `${year}-${pad(month + 1)}-${pad(d)}`;

  // Маппим entries → дата → массив записей
  const byDate = new Map<string, TimesheetEntry[]>();
  for (const e of entries) {
    const arr = byDate.get(e.date) || [];
    arr.push(e);
    byDate.set(e.date, arr);
  }

  const monthLabel = format(first, 'LLLL yyyy', { locale: ru });
  const today = new Date().toISOString().split('T')[0];

  // Заполняем выходные за месяц (чтобы стало 8 ч × рабочие дни)
  let workdays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month, d).getDay();
    if (dow !== 0 && dow !== 6) workdays++;
  }
  const norm = workdays * 8;
  const totalHours = entries
    .filter((e) => e.date.startsWith(`${year}-${pad(month + 1)}`))
    .reduce((s, e) => s + e.hours, 0);

  // Заполнить весь месяц 8ч/день админ-работа разом (по будням)
  const fillAdminAll = async () => {
    // Открываем диалог по первому НЕ заполненному рабочему дню
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(year, month, d).getDay();
      if (dow === 0 || dow === 6) continue;
      const iso = isoOf(d);
      if (!byDate.has(iso)) {
        onCellClick(iso);
        return;
      }
    }
  };

  return (
    <Card className="p-3 sm:p-4 border-0 shadow-sm">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onMonthChange({ year: month === 0 ? year - 1 : year, month: month === 0 ? 11 : month - 1 })}
            className="h-8"
          >
            ←
          </Button>
          <div className="font-semibold capitalize text-base px-2">{monthLabel}</div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onMonthChange({ year: month === 11 ? year + 1 : year, month: month === 11 ? 0 : month + 1 })}
            className="h-8"
          >
            →
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const d = new Date();
              onMonthChange({ year: d.getFullYear(), month: d.getMonth() });
            }}
            className="h-8 text-xs"
          >
            Сегодня
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          <span className="font-semibold">{totalHours.toFixed(0)}</span> / {norm} ч ·{' '}
          <span className="font-semibold">{byDate.size}</span> дней заполнено
        </div>
      </div>

      {/* Сетка дней недели */}
      <div className="grid grid-cols-7 gap-1 text-[10px] text-muted-foreground mb-1 font-medium uppercase">
        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => (
          <div key={d} className="text-center py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {/* Пустые ячейки до первого дня */}
        {Array.from({ length: firstDow }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const iso = isoOf(day);
          const dow = new Date(year, month, day).getDay();
          const isWeekend = dow === 0 || dow === 6;
          const isToday = iso === today;
          const dayEntries = byDate.get(iso) || [];
          const dayHours = dayEntries.reduce((s, e) => s + e.hours, 0);
          const hasAdmin = dayEntries.some((e) => !e.projectId || e.projectName === ADMIN_WORK_LABEL);
          const hasProject = dayEntries.some((e) => e.projectId);
          const tone = dayHours > 0
            ? hasProject
              ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 dark:text-emerald-100'
              : 'bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 dark:text-amber-100'
            : isWeekend
              ? 'bg-muted/30 hover:bg-muted/60 text-muted-foreground'
              : 'bg-background hover:bg-accent border border-dashed border-muted-foreground/30 text-foreground';
          return (
            <button
              key={day}
              type="button"
              onClick={() => onCellClick(iso)}
              className={`aspect-square rounded-md p-1 transition relative ${tone} ${isToday ? 'ring-2 ring-primary ring-offset-1' : ''}`}
              title={dayEntries.length > 0 ? `${dayEntries.length} запис${dayEntries.length === 1 ? 'ь' : 'ей'} / ${dayHours} ч` : 'Кликни, чтобы добавить'}
            >
              <div className="flex flex-col items-center justify-center h-full">
                <div className="text-xs font-semibold leading-none">{day}</div>
                {dayHours > 0 && (
                  <div className="text-[10px] mt-0.5 leading-none font-bold">
                    {dayHours % 1 === 0 ? dayHours.toFixed(0) : dayHours.toFixed(1)}ч
                  </div>
                )}
                {hasProject && hasAdmin && (
                  <div className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Подсказки + быстрая кнопка */}
      <div className="mt-3 flex items-center justify-between gap-2 flex-wrap text-xs text-muted-foreground">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-100 dark:bg-emerald-900/30 inline-block" /> Проект
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-100 dark:bg-amber-900/30 inline-block" /> Админ-работа
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded border border-dashed border-muted-foreground/40 inline-block" /> Пустой день
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={fillAdminAll} className="h-7 text-xs">
          Заполнить ближайший пустой день →
        </Button>
      </div>
    </Card>
  );
}

const ADMIN_WORK_LABEL = 'Административная работа';
