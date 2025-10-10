/**
 * Управление командой для зам. директора
 * Детальная информация о сотрудниках, загрузка, назначение на проекты
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, 
  User, 
  Briefcase, 
  Calendar as CalendarIcon, 
  Clock, 
  TrendingUp, 
  MapPin, 
  Phone, 
  Mail,
  Award,
  Target,
  Activity,
  BarChart3,
  Table as TableIcon,
  Kanban,
  GanttChart,
  Plus,
  Eye
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Типы данных
interface Employee {
  id: string;
  name: string;
  position: string;
  department: string;
  email: string;
  phone: string;
  avatar?: string;
  location: 'office' | 'project' | 'remote' | 'vacation';
  currentProjects: ProjectAssignment[];
  futureProjects: ProjectAssignment[];
  stats: EmployeeStats;
  timesheet: TimesheetEntry[];
}

interface ProjectAssignment {
  projectId: string;
  projectName: string;
  role: string;
  startDate: string;
  endDate: string;
  hoursAllocated: number;
  hoursSpent: number;
  status: 'planned' | 'active' | 'completed';
}

interface EmployeeStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  utilizationRate: number; // % загрузки
  averageScore: number; // Средний балл
  onTimeDelivery: number; // % вовремя
}

interface TimesheetEntry {
  date: string;
  projectId: string;
  projectName: string;
  hours: number;
  description: string;
}

export default function TeamManagement() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'gantt' | 'calendar' | 'table'>('kanban');
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);

  // Демо-данные сотрудников
  const employees: Employee[] = [
    {
      id: 'emp-1',
      name: 'Анна Иванова',
      position: 'Старший аудитор',
      department: 'Аудит',
      email: 'a.ivanova@rbpartners.com',
      phone: '+7 (777) 123-45-67',
      location: 'project',
      currentProjects: [
        {
          projectId: 'proj-1',
          projectName: 'Аудит АО "Компания"',
          role: 'Руководитель',
          startDate: '2025-01-05',
          endDate: '2025-02-15',
          hoursAllocated: 160,
          hoursSpent: 85,
          status: 'active',
        },
      ],
      futureProjects: [
        {
          projectId: 'proj-4',
          projectName: 'Оценка ТОО "Бизнес"',
          role: 'Супервайзер',
          startDate: '2025-02-20',
          endDate: '2025-03-30',
          hoursAllocated: 120,
          hoursSpent: 0,
          status: 'planned',
        },
      ],
      stats: {
        totalProjects: 12,
        activeProjects: 1,
        completedProjects: 11,
        utilizationRate: 85,
        averageScore: 4.8,
        onTimeDelivery: 95,
      },
      timesheet: [
        { date: '2025-01-09', projectId: 'proj-1', projectName: 'Аудит АО "Компания"', hours: 8, description: 'Проверка ОС' },
        { date: '2025-01-08', projectId: 'proj-1', projectName: 'Аудит АО "Компания"', hours: 7.5, description: 'Анализ ДЗ' },
        { date: '2025-01-07', projectId: 'proj-1', projectName: 'Аудит АО "Компания"', hours: 8, description: 'Тесты контролей' },
      ],
    },
    {
      id: 'emp-2',
      name: 'Михаил Петров',
      position: 'Ассистент',
      department: 'Аудит',
      email: 'm.petrov@rbpartners.com',
      phone: '+7 (777) 234-56-78',
      location: 'office',
      currentProjects: [],
      futureProjects: [],
      stats: {
        totalProjects: 5,
        activeProjects: 0,
        completedProjects: 5,
        utilizationRate: 30,
        averageScore: 4.2,
        onTimeDelivery: 88,
      },
      timesheet: [],
    },
    {
      id: 'emp-3',
      name: 'Елена Сидорова',
      position: 'Супервайзер',
      department: 'Консалтинг',
      email: 'e.sidorova@rbpartners.com',
      phone: '+7 (777) 345-67-89',
      location: 'project',
      currentProjects: [
        {
          projectId: 'proj-2',
          projectName: 'Трансформация МСФО',
          role: 'Супервайзер',
          startDate: '2025-01-10',
          endDate: '2025-02-28',
          hoursAllocated: 140,
          hoursSpent: 45,
          status: 'active',
        },
        {
          projectId: 'proj-3',
          projectName: 'Налоговый консалтинг',
          role: 'Консультант',
          startDate: '2025-01-15',
          endDate: '2025-02-10',
          hoursAllocated: 80,
          hoursSpent: 20,
          status: 'active',
        },
      ],
      futureProjects: [],
      stats: {
        totalProjects: 18,
        activeProjects: 2,
        completedProjects: 16,
        utilizationRate: 95,
        averageScore: 4.9,
        onTimeDelivery: 98,
      },
      timesheet: [
        { date: '2025-01-09', projectId: 'proj-2', projectName: 'Трансформация МСФО', hours: 6, description: 'Корректировки' },
        { date: '2025-01-09', projectId: 'proj-3', projectName: 'Налоговый консалтинг', hours: 2, description: 'Встреча с клиентом' },
      ],
    },
  ];

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp =>
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.department.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, employees]);

  const getLocationIcon = (location: Employee['location']) => {
    switch (location) {
      case 'office': return '🏢';
      case 'project': return '📋';
      case 'remote': return '🏠';
      case 'vacation': return '🏖️';
    }
  };

  const getLocationLabel = (location: Employee['location']) => {
    switch (location) {
      case 'office': return 'В офисе';
      case 'project': return 'На проекте';
      case 'remote': return 'Удаленно';
      case 'vacation': return 'В отпуске';
    }
  };

  const getUtilizationColor = (rate: number) => {
    if (rate >= 90) return 'text-red-500';
    if (rate >= 70) return 'text-green-500';
    if (rate >= 50) return 'text-yellow-500';
    return 'text-gray-500';
  };

  // Компонент краткого индикатора
  const EmployeeQuickStats = ({ employee }: { employee: Employee }) => (
    <div className="grid grid-cols-4 gap-2 mt-3 p-3 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg border border-blue-400/20">
      <div className="text-center">
        <div className="text-lg font-bold text-blue-400">{employee.stats.activeProjects}</div>
        <div className="text-xs text-muted-foreground">Активных</div>
      </div>
      <div className="text-center">
        <div className={`text-lg font-bold ${getUtilizationColor(employee.stats.utilizationRate)}`}>
          {employee.stats.utilizationRate}%
        </div>
        <div className="text-xs text-muted-foreground">Загрузка</div>
      </div>
      <div className="text-center">
        <div className="text-lg font-bold text-yellow-400">{employee.stats.averageScore}</div>
        <div className="text-xs text-muted-foreground">Средний балл</div>
      </div>
      <div className="text-center">
        <div className="text-lg font-bold text-green-400">{employee.stats.onTimeDelivery}%</div>
        <div className="text-xs text-muted-foreground">Вовремя</div>
      </div>
    </div>
  );

  // Канбан вид
  const KanbanView = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Доступны */}
      <Card className="border-green-500/30">
        <CardHeader className="bg-green-500/10">
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            Доступны ({filteredEmployees.filter(e => e.stats.utilizationRate < 70).length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {filteredEmployees.filter(e => e.stats.utilizationRate < 70).map(emp => (
            <Card key={emp.id} className="p-4 hover:shadow-lg transition-all cursor-pointer" onClick={() => setSelectedEmployee(emp)}>
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>{emp.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold truncate">{emp.name}</h4>
                  <p className="text-sm text-muted-foreground truncate">{emp.position}</p>
                </div>
                <Badge variant="secondary">{emp.stats.utilizationRate}%</Badge>
              </div>
              <EmployeeQuickStats employee={emp} />
            </Card>
          ))}
        </CardContent>
      </Card>

      {/* Загружены */}
      <Card className="border-yellow-500/30">
        <CardHeader className="bg-yellow-500/10">
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse" />
            Загружены ({filteredEmployees.filter(e => e.stats.utilizationRate >= 70 && e.stats.utilizationRate < 90).length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {filteredEmployees.filter(e => e.stats.utilizationRate >= 70 && e.stats.utilizationRate < 90).map(emp => (
            <Card key={emp.id} className="p-4 hover:shadow-lg transition-all cursor-pointer" onClick={() => setSelectedEmployee(emp)}>
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>{emp.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold truncate">{emp.name}</h4>
                  <p className="text-sm text-muted-foreground truncate">{emp.position}</p>
                </div>
                <Badge variant="secondary">{emp.stats.utilizationRate}%</Badge>
              </div>
              <EmployeeQuickStats employee={emp} />
            </Card>
          ))}
        </CardContent>
      </Card>

      {/* Перегружены */}
      <Card className="border-red-500/30">
        <CardHeader className="bg-red-500/10">
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            Перегружены ({filteredEmployees.filter(e => e.stats.utilizationRate >= 90).length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {filteredEmployees.filter(e => e.stats.utilizationRate >= 90).map(emp => (
            <Card key={emp.id} className="p-4 hover:shadow-lg transition-all cursor-pointer border-red-500/30" onClick={() => setSelectedEmployee(emp)}>
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>{emp.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold truncate">{emp.name}</h4>
                  <p className="text-sm text-muted-foreground truncate">{emp.position}</p>
                </div>
                <Badge variant="destructive">{emp.stats.utilizationRate}%</Badge>
              </div>
              <EmployeeQuickStats employee={emp} />
            </Card>
          ))}
        </CardContent>
      </Card>
    </div>
  );

  // Табличный вид
  const TableView = () => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left p-4">Сотрудник</th>
            <th className="text-left p-4">Позиция</th>
            <th className="text-center p-4">Локация</th>
            <th className="text-center p-4">Активных проектов</th>
            <th className="text-center p-4">Загрузка</th>
            <th className="text-center p-4">Средний балл</th>
            <th className="text-center p-4">Вовремя %</th>
            <th className="text-center p-4">Действия</th>
          </tr>
        </thead>
        <tbody>
          {filteredEmployees.map(emp => (
            <tr key={emp.id} className="border-b border-border hover:bg-muted/50 transition-colors">
              <td className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>{emp.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-semibold">{emp.name}</div>
                    <div className="text-sm text-muted-foreground">{emp.email}</div>
                  </div>
                </div>
              </td>
              <td className="p-4">{emp.position}</td>
              <td className="p-4 text-center">
                <Badge variant="outline">
                  {getLocationIcon(emp.location)} {getLocationLabel(emp.location)}
                </Badge>
              </td>
              <td className="p-4 text-center">
                <Badge>{emp.stats.activeProjects}</Badge>
              </td>
              <td className="p-4">
                <div className="flex flex-col items-center gap-1">
                  <span className={`font-bold ${getUtilizationColor(emp.stats.utilizationRate)}`}>
                    {emp.stats.utilizationRate}%
                  </span>
                  <Progress value={emp.stats.utilizationRate} className="w-full h-2" />
                </div>
              </td>
              <td className="p-4 text-center">
                <div className="flex items-center justify-center gap-1">
                  <Award className="w-4 h-4 text-yellow-500" />
                  <span className="font-semibold">{emp.stats.averageScore}</span>
                </div>
              </td>
              <td className="p-4 text-center text-green-500 font-semibold">
                {emp.stats.onTimeDelivery}%
              </td>
              <td className="p-4">
                <div className="flex gap-2 justify-center">
                  <Button size="sm" variant="outline" onClick={() => setSelectedEmployee(emp)}>
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="default" onClick={() => { setSelectedEmployee(emp); setIsAssignDialogOpen(true); }}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in p-4 md:p-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-warning bg-clip-text text-transparent">
            👥 Управление командой
          </h1>
          <p className="text-muted-foreground mt-1">
            Загрузка сотрудников, назначение на проекты, тайм-шиты
          </p>
        </div>
        <Badge variant="outline" className="text-lg">
          Всего: {filteredEmployees.length} сотрудников
        </Badge>
      </div>

      {/* Search and View Controls */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск сотрудников..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'kanban' ? 'default' : 'outline'}
            onClick={() => setViewMode('kanban')}
          >
            <Kanban className="w-4 h-4 mr-2" />
            Канбан
          </Button>
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            onClick={() => setViewMode('table')}
          >
            <TableIcon className="w-4 h-4 mr-2" />
            Таблица
          </Button>
        </div>
      </div>

      {/* Views */}
      {viewMode === 'kanban' && <KanbanView />}
      {viewMode === 'table' && <TableView />}

      {/* Employee Details Dialog */}
      {selectedEmployee && !isAssignDialogOpen && (
        <Dialog open={!!selectedEmployee} onOpenChange={() => setSelectedEmployee(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl flex items-center gap-3">
                <Avatar className="w-12 h-12">
                  <AvatarFallback className="text-lg">
                    {selectedEmployee.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                {selectedEmployee.name}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Контактная информация */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">📋 Основная информация</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">{selectedEmployee.position}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{selectedEmployee.department}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{selectedEmployee.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{selectedEmployee.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 col-span-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <Badge>
                      {getLocationIcon(selectedEmployee.location)} {getLocationLabel(selectedEmployee.location)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Статистика */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4">
                  <div className="text-2xl font-bold text-blue-500">{selectedEmployee.stats.totalProjects}</div>
                  <div className="text-sm text-muted-foreground">Всего проектов</div>
                </Card>
                <Card className="p-4">
                  <div className={`text-2xl font-bold ${getUtilizationColor(selectedEmployee.stats.utilizationRate)}`}>
                    {selectedEmployee.stats.utilizationRate}%
                  </div>
                  <div className="text-sm text-muted-foreground">Загрузка</div>
                  <Progress value={selectedEmployee.stats.utilizationRate} className="mt-2 h-2" />
                </Card>
                <Card className="p-4">
                  <div className="text-2xl font-bold text-yellow-500">{selectedEmployee.stats.averageScore}</div>
                  <div className="text-sm text-muted-foreground">Средний балл</div>
                </Card>
                <Card className="p-4">
                  <div className="text-2xl font-bold text-green-500">{selectedEmployee.stats.onTimeDelivery}%</div>
                  <div className="text-sm text-muted-foreground">Вовремя</div>
                </Card>
              </div>

              {/* Текущие проекты */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>📋 Текущие проекты ({selectedEmployee.currentProjects.length})</span>
                    <Button size="sm" onClick={() => setIsAssignDialogOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Назначить
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedEmployee.currentProjects.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">Нет активных проектов</p>
                  ) : (
                    selectedEmployee.currentProjects.map(proj => (
                      <Card key={proj.projectId} className="p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold">{proj.projectName}</h4>
                          <Badge>{proj.role}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground mb-2">
                          <div>📅 {new Date(proj.startDate).toLocaleDateString('ru-RU')} - {new Date(proj.endDate).toLocaleDateString('ru-RU')}</div>
                          <div>⏱️ {proj.hoursSpent} / {proj.hoursAllocated} часов</div>
                        </div>
                        <Progress value={(proj.hoursSpent / proj.hoursAllocated) * 100} className="h-2" />
                      </Card>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Будущие проекты */}
              {selectedEmployee.futureProjects.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">🔮 Запланированные проекты ({selectedEmployee.futureProjects.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selectedEmployee.futureProjects.map(proj => (
                      <Card key={proj.projectId} className="p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold">{proj.projectName}</h4>
                          <Badge variant="outline">{proj.role}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          📅 Начало: {new Date(proj.startDate).toLocaleDateString('ru-RU')}
                        </div>
                      </Card>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Тайм-шит */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">⏰ Тайм-шит (последние записи)</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedEmployee.timesheet.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">Нет записей</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedEmployee.timesheet.map((entry, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div className="flex-1">
                            <div className="font-semibold">{entry.projectName}</div>
                            <div className="text-sm text-muted-foreground">{entry.description}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-blue-500">{entry.hours}ч</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(entry.date).toLocaleDateString('ru-RU')}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Assign Dialog */}
      {isAssignDialogOpen && selectedEmployee && (
        <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Назначить на проект: {selectedEmployee.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Проект</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите проект" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="proj-1">Аудит АО "Компания"</SelectItem>
                    <SelectItem value="proj-2">Трансформация МСФО</SelectItem>
                    <SelectItem value="proj-3">Налоговый консалтинг</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Роль</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите роль" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="partner">Партнер</SelectItem>
                    <SelectItem value="supervisor">Супервайзер</SelectItem>
                    <SelectItem value="assistant">Ассистент</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Часов выделено</Label>
                <Input type="number" placeholder="160" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
                Отмена
              </Button>
              <Button onClick={() => {
                toast({
                  title: "✅ Сотрудник назначен",
                  description: `${selectedEmployee.name} назначен на проект`,
                });
                setIsAssignDialogOpen(false);
              }}>
                Назначить
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

