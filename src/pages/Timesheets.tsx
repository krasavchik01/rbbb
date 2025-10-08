import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { 
  Plus, 
  Search, 
  Clock,
  Calendar,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Clock as ClockIcon
} from "lucide-react";
import { useTimesheets, useProjects, useEmployees } from "@/hooks/useDataStore";
import { Timesheet } from "@/store/dataStore";
import { useAuth } from "@/contexts/AuthContext";

export default function Timesheets() {
  const { timesheets, addTimesheet, updateTimesheet, deleteTimesheet } = useTimesheets();
  const { projects } = useProjects();
  const { employees } = useEmployees();
  const { user } = useAuth();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredTimesheets, setFilteredTimesheets] = useState<Timesheet[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedTimesheet, setSelectedTimesheet] = useState<Timesheet | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Форма
  const [formData, setFormData] = useState({
    employee_id: user?.id || '1',
    project_id: '',
    date: new Date().toISOString().split('T')[0],
    hours: 8,
    description: '',
    status: 'Черновик' as Timesheet['status'],
  });

  useEffect(() => {
    let filtered = timesheets;

    // Фильтр по статусу
    if (filterStatus !== 'all') {
      filtered = filtered.filter(t => t.status === filterStatus);
    }

    // Фильтр по поиску
    if (searchQuery) {
      filtered = filtered.filter(t => {
        const employee = employees.find(e => e.id === t.employee_id);
        const project = projects.find(p => p.id === t.project_id);
        return (
          employee?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          project?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.description.toLowerCase().includes(searchQuery.toLowerCase())
        );
      });
    }

    // Сортировка по дате (новые сверху)
    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    setFilteredTimesheets(filtered);
  }, [timesheets, searchQuery, filterStatus, employees, projects]);

  const resetForm = () => {
    setFormData({
      employee_id: user?.id || '1',
      project_id: '',
      date: new Date().toISOString().split('T')[0],
      hours: 8,
      description: '',
      status: 'Черновик',
    });
  };

  const handleCreate = () => {
    if (!formData.project_id || formData.hours <= 0) return;
    
    addTimesheet(formData);
    setIsCreateModalOpen(false);
    resetForm();
  };

  const handleEdit = (timesheet: Timesheet) => {
    setSelectedTimesheet(timesheet);
    setFormData({
      employee_id: timesheet.employee_id,
      project_id: timesheet.project_id,
      date: timesheet.date,
      hours: timesheet.hours,
      description: timesheet.description,
      status: timesheet.status,
    });
    setIsEditModalOpen(true);
  };

  const handleUpdate = () => {
    if (!selectedTimesheet) return;
    
    updateTimesheet(selectedTimesheet.id, formData);
    setIsEditModalOpen(false);
    setSelectedTimesheet(null);
    resetForm();
  };

  const handleDeleteClick = (timesheet: Timesheet) => {
    setSelectedTimesheet(timesheet);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!selectedTimesheet) return;
    
    deleteTimesheet(selectedTimesheet.id);
    setIsDeleteDialogOpen(false);
    setSelectedTimesheet(null);
  };

  const handleApprove = (timesheet: Timesheet) => {
    updateTimesheet(timesheet.id, { status: 'Утверждено' });
  };

  const handleReject = (timesheet: Timesheet) => {
    updateTimesheet(timesheet.id, { status: 'Отклонено' });
  };

  const getStatusBadge = (status: Timesheet['status']) => {
    switch (status) {
      case 'Черновик':
        return <Badge variant="secondary">Черновик</Badge>;
      case 'На утверждении':
        return <Badge className="bg-yellow-500">На утверждении</Badge>;
      case 'Утверждено':
        return <Badge className="bg-green-500">Утверждено</Badge>;
      case 'Отклонено':
        return <Badge variant="destructive">Отклонено</Badge>;
    }
  };

  const TimesheetCard = ({ timesheet }: { timesheet: Timesheet }) => {
    const employee = employees.find(e => e.id === timesheet.employee_id);
    const project = projects.find(p => p.id === timesheet.project_id);
    const canEdit = user?.role === 'admin' || timesheet.employee_id === user?.id;
    const canApprove = user?.role === 'admin' || user?.role === 'manager';

    return (
      <Card className="p-6 hover:shadow-lg transition-all duration-200 group">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-white font-semibold">
                {employee?.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <h3 className="font-semibold">{employee?.name}</h3>
                <p className="text-sm text-muted-foreground">{employee?.position}</p>
              </div>
            </div>
            {getStatusBadge(timesheet.status)}
          </div>
          {canEdit && (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" onClick={() => handleEdit(timesheet)}>
                <Edit className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(timesheet)}>
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span>{new Date(timesheet.date).toLocaleDateString('ru-RU', { 
              day: 'numeric', 
              month: 'long', 
              year: 'numeric' 
            })}</span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <ClockIcon className="w-4 h-4 text-muted-foreground" />
            <span className="font-semibold">{timesheet.hours} часов</span>
          </div>

          <div>
            <p className="text-sm font-medium mb-1">Проект:</p>
            <p className="text-sm text-muted-foreground">{project?.name || 'Проект не найден'}</p>
          </div>

          {timesheet.description && (
            <div>
              <p className="text-sm font-medium mb-1">Описание:</p>
              <p className="text-sm text-muted-foreground">{timesheet.description}</p>
            </div>
          )}
        </div>

        {canApprove && timesheet.status === 'На утверждении' && (
          <div className="flex gap-2 mt-4">
            <Button 
              variant="default" 
              size="sm" 
              className="flex-1 bg-green-500 hover:bg-green-600"
              onClick={() => handleApprove(timesheet)}
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              Утвердить
            </Button>
            <Button 
              variant="destructive" 
              size="sm" 
              className="flex-1"
              onClick={() => handleReject(timesheet)}
            >
              <XCircle className="w-4 h-4 mr-1" />
              Отклонить
            </Button>
          </div>
        )}
      </Card>
    );
  };

  const TimesheetFormFields = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="project">Проект *</Label>
        <Select value={formData.project_id} onValueChange={(value) => setFormData({ ...formData, project_id: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Выберите проект" />
          </SelectTrigger>
          <SelectContent>
            {projects.map(project => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="date">Дата *</Label>
          <Input
            id="date"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="hours">Часы *</Label>
          <Input
            id="hours"
            type="number"
            min="0.5"
            max="24"
            step="0.5"
            value={formData.hours}
            onChange={(e) => setFormData({ ...formData, hours: Number(e.target.value) })}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="description">Описание работы</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Что было сделано..."
          rows={3}
        />
      </div>

      <div>
        <Label htmlFor="status">Статус</Label>
        <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as Timesheet['status'] })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Черновик">Черновик</SelectItem>
            <SelectItem value="На утверждении">На утверждении</SelectItem>
            <SelectItem value="Утверждено">Утверждено</SelectItem>
            <SelectItem value="Отклонено">Отклонено</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  // Статистика
  const totalHours = timesheets.reduce((sum, t) => sum + t.hours, 0);
  const approvedHours = timesheets.filter(t => t.status === 'Утверждено').reduce((sum, t) => sum + t.hours, 0);
  const pendingHours = timesheets.filter(t => t.status === 'На утверждении').reduce((sum, t) => sum + t.hours, 0);

  return (
    <div className="space-y-6 animate-fade-in p-4 md:p-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-warning bg-clip-text text-transparent">
            Тайм-шиты
          </h1>
          <p className="text-muted-foreground mt-1">Учёт рабочего времени</p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)} className="w-full md:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          Добавить запись
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск..."
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
            <SelectItem value="all">Все записи</SelectItem>
            <SelectItem value="Черновик">Черновик</SelectItem>
            <SelectItem value="На утверждении">На утверждении</SelectItem>
            <SelectItem value="Утверждено">Утверждено</SelectItem>
            <SelectItem value="Отклонено">Отклонено</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-2xl font-bold">{totalHours}ч</div>
          <div className="text-sm text-muted-foreground">Всего часов</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-green-500">{approvedHours}ч</div>
          <div className="text-sm text-muted-foreground">Утверждено</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-yellow-500">{pendingHours}ч</div>
          <div className="text-sm text-muted-foreground">На утверждении</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{timesheets.length}</div>
          <div className="text-sm text-muted-foreground">Записей</div>
        </Card>
      </div>

      {/* Timesheets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTimesheets.map((timesheet) => (
          <TimesheetCard key={timesheet.id} timesheet={timesheet} />
        ))}
      </div>

      {filteredTimesheets.length === 0 && (
        <Card className="p-12 text-center">
          <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Записей не найдено</p>
          <Button onClick={() => setIsCreateModalOpen(true)} variant="link" className="mt-2">
            Добавить первую запись
          </Button>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить запись времени</DialogTitle>
            <DialogDescription>
              Укажите время, потраченное на проект
            </DialogDescription>
          </DialogHeader>
          <TimesheetFormFields />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleCreate}>
              Добавить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать запись</DialogTitle>
            <DialogDescription>
              Измените информацию о времени
            </DialogDescription>
          </DialogHeader>
          <TimesheetFormFields />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleUpdate}>
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Alert Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить запись?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить эту запись времени? 
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
