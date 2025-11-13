import { useState, useMemo, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProjects } from '@/hooks/useProjects-simple';
import { useEmployees } from '@/hooks/useSupabaseData';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
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
  Trash2
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
  
  // Получаем проекты пользователя (где он в команде)
  const userProjects = useMemo(() => {
    if (!user) return [];
    return projects.filter((p: any) => {
      const team = p.team || [];
      return team.some((member: any) => member.userId === user.id);
    });
  }, [projects, user]);

  // Загружаем тайм-шиты из localStorage
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('timesheets') || '[]');
    const enriched = saved.map((ts: any) => {
      const employee = employees.find((e: any) => e.id === ts.employeeId);
      const project = ts.projectId ? projects.find((p: any) => p.id === ts.projectId) : null;
      return {
        ...ts,
        employeeName: employee?.name || 'Неизвестный сотрудник',
        projectName: project?.name || project?.title || 'Без проекта'
      };
    });
    setTimesheets(enriched);
  }, [employees, projects]);

  // Фильтруем тайм-щиты по текущему пользователю (если не админ/CEO)
  const visibleTimesheets = useMemo(() => {
    if (!user) return [];
    if (user.role === 'ceo' || user.role === 'admin' || user.role === 'deputy_director') {
      return timesheets;
    }
    return timesheets.filter(ts => ts.employeeId === user.id);
  }, [timesheets, user]);

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
  const saveTimesheet = () => {
    if (!user) return;
    
    if (!formData.projectId) {
      toast({ title: 'Ошибка', description: 'Выберите проект', variant: 'destructive' });
      return;
    }
    
    if (!formData.hours || parseFloat(formData.hours) <= 0) {
      toast({ title: 'Ошибка', description: 'Укажите количество часов', variant: 'destructive' });
      return;
    }

    const newTimesheet: TimesheetEntry = {
      id: editingTimesheet?.id || `ts_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      employeeId: user.id,
      employeeName: user.name,
      projectId: formData.projectId,
      projectName: projects.find((p: any) => p.id === formData.projectId)?.name || projects.find((p: any) => p.id === formData.projectId)?.title || 'Без проекта',
      date: formData.date,
      hours: parseFloat(formData.hours),
      description: formData.description || 'Работа над проектом',
      status: editingTimesheet?.status || 'draft'
    };

    const saved = JSON.parse(localStorage.getItem('timesheets') || '[]');
    if (editingTimesheet) {
      const index = saved.findIndex((ts: any) => ts.id === editingTimesheet.id);
      if (index >= 0) {
        saved[index] = newTimesheet;
      }
    } else {
      saved.push(newTimesheet);
    }
    
    localStorage.setItem('timesheets', JSON.stringify(saved));
    
    // Обновляем состояние
    const enriched = saved.map((ts: any) => {
      const employee = employees.find((e: any) => e.id === ts.employeeId);
      const project = ts.projectId ? projects.find((p: any) => p.id === ts.projectId) : null;
      return {
        ...ts,
        employeeName: employee?.name || 'Неизвестный сотрудник',
        projectName: project?.name || project?.title || 'Без проекта'
      };
    });
    setTimesheets(enriched);
    
    toast({ title: 'Успешно', description: editingTimesheet ? 'Тайм-щит обновлен' : 'Тайм-щит создан' });
    setShowAddDialog(false);
    setEditingTimesheet(null);
    setFormData({
      projectId: '',
      date: new Date().toISOString().split('T')[0],
      hours: '',
      description: ''
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
  const handleDelete = (timesheet: TimesheetEntry) => {
    if (!user || timesheet.employeeId !== user.id) return;
    if (timesheet.status === 'approved') {
      toast({ title: 'Ошибка', description: 'Нельзя удалить утвержденный тайм-щит', variant: 'destructive' });
      return;
    }
    
    const saved = JSON.parse(localStorage.getItem('timesheets') || '[]');
    const filtered = saved.filter((ts: any) => ts.id !== timesheet.id);
    localStorage.setItem('timesheets', JSON.stringify(filtered));
    
    const enriched = filtered.map((ts: any) => {
      const employee = employees.find((e: any) => e.id === ts.employeeId);
      const project = ts.projectId ? projects.find((p: any) => p.id === ts.projectId) : null;
      return {
        ...ts,
        employeeName: employee?.name || 'Неизвестный сотрудник',
        projectName: project?.name || project?.title || 'Без проекта'
      };
    });
    setTimesheets(enriched);
    toast({ title: 'Успешно', description: 'Тайм-щит удален' });
  };

  // Отправка на проверку
  const handleSubmit = (timesheet: TimesheetEntry) => {
    if (!user || timesheet.employeeId !== user.id) return;
    
    const saved = JSON.parse(localStorage.getItem('timesheets') || '[]');
    const index = saved.findIndex((ts: any) => ts.id === timesheet.id);
    if (index >= 0) {
      saved[index].status = 'submitted';
      localStorage.setItem('timesheets', JSON.stringify(saved));
      
      const enriched = saved.map((ts: any) => {
        const employee = employees.find((e: any) => e.id === ts.employeeId);
        const project = ts.projectId ? projects.find((p: any) => p.id === ts.projectId) : null;
        return {
          ...ts,
          employeeName: employee?.name || 'Неизвестный сотрудник',
          projectName: project?.name || project?.title || 'Без проекта'
        };
      });
      setTimesheets(enriched);
      toast({ title: 'Успешно', description: 'Тайм-щит отправлен на проверку' });
    }
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
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Clock className="w-8 h-8" />
          Тайм-щиты
        </h1>
        <p className="text-muted-foreground mt-2">Учет рабочего времени</p>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Всего часов</p>
              <p className="text-2xl font-bold">{(stats.total || 0).toFixed(1)}</p>
            </div>
            <Clock className="w-8 h-8 text-primary" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Черновики</p>
              <p className="text-2xl font-bold">{stats.draft}</p>
            </div>
            <Clock className="w-8 h-8 text-gray-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">На проверке</p>
              <p className="text-2xl font-bold">{stats.submitted}</p>
            </div>
            <Clock className="w-8 h-8 text-blue-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Утверждено</p>
              <p className="text-2xl font-bold">{stats.approved}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </Card>
      </div>

      {/* Кнопка добавления (только для тех, кто может заполнять) */}
      {canFillTimesheets && (
        <div className="flex justify-end">
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingTimesheet(null);
                setFormData({
                  projectId: '',
                  date: new Date().toISOString().split('T')[0],
                  hours: '',
                  description: ''
                });
              }}>
                <Plus className="w-4 h-4 mr-2" />
                Добавить тайм-щит
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingTimesheet ? 'Редактировать тайм-щит' : 'Новый тайм-щит'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Проект *</Label>
                  <Select value={formData.projectId} onValueChange={(value) => setFormData({...formData, projectId: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите проект" />
                    </SelectTrigger>
                    <SelectContent>
                      {userProjects.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name || p.title || 'Без названия'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Дата *</Label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Количество часов *</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="24"
                    value={formData.hours}
                    onChange={(e) => setFormData({...formData, hours: e.target.value})}
                    placeholder="8.0"
                  />
                </div>
                <div>
                  <Label>Описание работы</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Опишите выполненную работу..."
                    rows={4}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => {
                    setShowAddDialog(false);
                    setEditingTimesheet(null);
                  }}>
                    Отмена
                  </Button>
                  <Button onClick={saveTimesheet}>
                    {editingTimesheet ? 'Сохранить' : 'Создать'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Фильтры */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Поиск..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <Input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="w-full md:w-auto"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-3 py-2 border rounded-md bg-background"
          >
            <option value="all">Все статусы</option>
            <option value="draft">Черновик</option>
            <option value="submitted">На проверке</option>
            <option value="approved">Утверждено</option>
            <option value="rejected">Отклонено</option>
          </select>
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="px-3 py-2 border rounded-md bg-background"
          >
            <option value="all">Все проекты</option>
            {userProjects.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.name || p.title || 'Без названия'}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Список тайм-шитов */}
      {filteredTimesheets.length === 0 ? (
        <Card className="p-8 text-center">
          <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Тайм-щиты не найдены</p>
          <p className="text-sm text-muted-foreground mt-2">
            {canFillTimesheets ? 'Создайте тайм-шит для учета рабочего времени' : 'У вас нет доступа к заполнению тайм-щитов'}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredTimesheets.map((timesheet) => {
            const isOwner = user && timesheet.employeeId === user.id;
            const canEdit = isOwner && timesheet.status === 'draft';
            const canDelete = isOwner && timesheet.status === 'draft';
            const canSubmit = isOwner && timesheet.status === 'draft';
            
            return (
              <Card key={timesheet.id} className="p-4 hover:bg-secondary/50 transition-colors">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="font-semibold">{timesheet.employeeName}</h3>
                      {getStatusBadge(timesheet.status)}
                    </div>
                    {timesheet.projectName && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
                        <Briefcase className="w-3 h-3" />
                        <span>{timesheet.projectName}</span>
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground mb-1">{timesheet.description}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{format(new Date(timesheet.date), 'dd MMM yyyy', { locale: ru })}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-2xl font-bold">{(timesheet.hours || 0).toFixed(1)} ч</p>
                      <p className="text-xs text-muted-foreground">Отработано</p>
                    </div>
                    {isOwner && (
                      <div className="flex gap-2">
                        {canEdit && (
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(timesheet)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(timesheet)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                        {canSubmit && (
                          <Button variant="outline" size="sm" onClick={() => handleSubmit(timesheet)}>
                            Отправить
                          </Button>
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
