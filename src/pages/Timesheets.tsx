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

const getProjectName = (project: any) => project?.name || project?.title || 'Без проекта';
const getProjectClient = (project: any) => project?.client || project?.company || project?.notes?.client || '';

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
            'justify-between bg-muted/40 border-0 font-normal',
            !selected && 'text-muted-foreground',
            triggerClassName,
          )}
        >
          <span className="truncate">{selected ? getProjectName(selected) : placeholder}</span>
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
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterProject, setFilterProject] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingTimesheet, setEditingTimesheet] = useState<TimesheetEntry | null>(null);
  
  // Форма
  const [formData, setFormData] = useState({
    projectId: '',
    date: new Date().toISOString().split('T')[0],
    hours: '',
    description: ''
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
      const matchesDate = ts.date === filterDate;
      const matchesProject = filterProject === 'all' || ts.projectId === filterProject;

      return matchesSearch && matchesStatus && matchesDate && matchesProject;
    });
  }, [visibleTimesheets, searchTerm, filterStatus, filterDate, filterProject]);

  // Сохранение тайм-щита
  const saveTimesheet = async () => {
    if (!user) return;

    if (!formData.projectId) {
      toast({ title: 'Ошибка', description: 'Выберите проект', variant: 'destructive' });
      return;
    }

    if (!formData.hours || parseFloat(formData.hours) <= 0) {
      toast({ title: 'Ошибка', description: 'Укажите количество часов', variant: 'destructive' });
      return;
    }

    const projectName = getProjectName(projects.find((p: any) => p.id === formData.projectId));
    const hours = parseFloat(formData.hours);
    const description = formData.description || 'Работа над проектом';

    if (editingTimesheet) {
      const updated = await updateEntry(editingTimesheet.id, {
        projectId: formData.projectId,
        projectName,
        workDate: formData.date,
        hours,
        notes: description,
      });
      if (!updated) {
        toast({ title: 'Ошибка', description: 'Не удалось обновить запись', variant: 'destructive' });
        return;
      }
    } else {
      const created = await createEntry({
        employeeId: user.id,
        employeeName: user.name,
        projectId: formData.projectId,
        projectName,
        workDate: formData.date,
        hours,
        notes: description,
        source: 'manual',
        status: 'draft',
        createdBy: user.id,
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
      date: new Date().toISOString().split('T')[0],
      hours: '',
      description: '',
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
      date: timesheet.date,
      hours: timesheet.hours.toString(),
      description: timesheet.description
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
                  date: new Date().toISOString().split('T')[0],
                  hours: '',
                  description: ''
                });
              }}>
                <Plus className="w-4 h-4" />
                Добавить
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingTimesheet ? 'Редактировать тайм-щит' : 'Новый тайм-щит'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
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
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Описание</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Опишите выполненную работу..."
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

      {/* Фильтры */}
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
    </div>
  );
}
