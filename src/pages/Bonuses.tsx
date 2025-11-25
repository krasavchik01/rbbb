import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProjects } from '@/hooks/useProjects-simple';
import { useEmployees } from '@/hooks/useSupabaseData';
import { useAuth } from '@/contexts/AuthContext';
import { calculateProjectFinances } from '@/types/project-v3';
import { 
  Gift, 
  TrendingUp, 
  DollarSign, 
  Calendar,
  Filter,
  Download,
  Search,
  CheckCircle,
  Clock,
  XCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export default function Bonuses() {
  const { user, checkPermission } = useAuth();
  const { projects = [] } = useProjects();
  const { employees = [] } = useEmployees();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'paid'>('all');
  const [filterType, setFilterType] = useState<'all' | 'project' | 'kpi' | 'annual'>('all');

  // Проверка прав доступа - только CEO и deputy_director могут видеть бонусы
  const canViewBonuses = checkPermission('VIEW_ALL_BONUSES');
  
  if (!canViewBonuses) {
    return (
      <div className="space-y-6 p-4 md:p-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Gift className="w-8 h-8" />
            Бонусы
          </h1>
        </div>
        <Card className="p-8 text-center">
          <p className="text-muted-foreground text-lg">
            У вас нет доступа к просмотру бонусов. Доступ имеют только генеральный директор и заместитель директора.
          </p>
        </Card>
      </div>
    );
  }

  // Получаем все бонусы из проектов
  const allBonuses = useMemo(() => {
    const bonuses: Array<{
      id: string;
      projectId: string;
      projectName: string;
      employeeId: string;
      employeeName: string;
      amount: number;
      percent: number;
      type: 'project' | 'kpi' | 'annual';
      status: 'pending' | 'approved' | 'paid';
      date: string;
      description: string;
    }> = [];

    projects.forEach((project: any) => {
      if (project.finances && project.finances.teamBonuses) {
        const finances = calculateProjectFinances(project);
        Object.entries(finances.teamBonuses).forEach(([userId, bonus]: [string, any]) => {
          const employee = employees.find((e: any) => e.id === userId);
          if (employee) {
            bonuses.push({
              id: `${project.id}-${userId}`,
              projectId: project.id,
              projectName: project.name || project.title || 'Без названия',
              employeeId: userId,
              employeeName: employee.name || employee.email,
              amount: bonus.amount || 0,
              percent: bonus.percent || 0,
              type: 'project',
              status: project.status === 'completed' ? 'approved' : 'pending',
              date: project.updated_at || project.created_at,
              description: `Бонус за проект "${project.name || project.title}"`
            });
          }
        });
      }
    });

    return bonuses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [projects, employees]);

  // Фильтрация бонусов
  const filteredBonuses = useMemo(() => {
    return allBonuses.filter(bonus => {
      const matchesSearch = 
        bonus.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bonus.projectName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = filterStatus === 'all' || bonus.status === filterStatus;
      const matchesType = filterType === 'all' || bonus.type === filterType;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [allBonuses, searchTerm, filterStatus, filterType]);

  // Статистика
  const stats = useMemo(() => {
    const safeNumber = (val: number) => isNaN(val) || !isFinite(val) ? 0 : val;
    const total = safeNumber(allBonuses.reduce((sum, b) => sum + (b.amount || 0), 0));
    const pending = safeNumber(allBonuses.filter(b => b.status === 'pending').reduce((sum, b) => sum + (b.amount || 0), 0));
    const approved = safeNumber(allBonuses.filter(b => b.status === 'approved').reduce((sum, b) => sum + (b.amount || 0), 0));
    const paid = safeNumber(allBonuses.filter(b => b.status === 'paid').reduce((sum, b) => sum + (b.amount || 0), 0));

    return { total, pending, approved, paid, count: allBonuses.length };
  }, [allBonuses]);

  // Бонусы по сотрудникам
  const bonusesByEmployee = useMemo(() => {
    const grouped: Record<string, { employee: any; total: number; bonuses: typeof allBonuses }> = {};
    
    filteredBonuses.forEach(bonus => {
      if (!grouped[bonus.employeeId]) {
        const employee = employees.find((e: any) => e.id === bonus.employeeId);
        grouped[bonus.employeeId] = {
          employee: employee || { name: bonus.employeeName },
          total: 0,
          bonuses: []
        };
      }
      grouped[bonus.employeeId].total += bonus.amount;
      grouped[bonus.employeeId].bonuses.push(bonus);
    });

    return Object.values(grouped).sort((a, b) => b.total - a.total);
  }, [filteredBonuses, employees]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Выплачен</Badge>;
      case 'approved':
        return <Badge className="bg-blue-500"><CheckCircle className="w-3 h-3 mr-1" />Одобрен</Badge>;
      case 'pending':
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Ожидает</Badge>;
      default:
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Отклонён</Badge>;
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Gift className="w-8 h-8" />
          Бонусы
        </h1>
        <p className="text-muted-foreground mt-2">Система бонусов и поощрений сотрудников</p>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Всего бонусов</p>
              <p className="text-2xl font-bold">{stats.count}</p>
            </div>
            <Gift className="w-8 h-8 text-primary" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Общая сумма</p>
              <p className="text-2xl font-bold">{(stats.total || 0).toLocaleString('ru-RU')} ₸</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Ожидает</p>
              <p className="text-2xl font-bold">{(stats.pending || 0).toLocaleString('ru-RU')} ₸</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Выплачено</p>
              <p className="text-2xl font-bold">{(stats.paid || 0).toLocaleString('ru-RU')} ₸</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </Card>
      </div>
      
      <Tabs defaultValue="list" className="space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <TabsList>
            <TabsTrigger value="list">Список бонусов</TabsTrigger>
            <TabsTrigger value="by-employee">По сотрудникам</TabsTrigger>
          </TabsList>

          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:flex-initial md:w-64">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Поиск..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-3 py-2 border rounded-md bg-background"
              >
                <option value="all">Все статусы</option>
                <option value="pending">Ожидает</option>
                <option value="approved">Одобрен</option>
                <option value="paid">Выплачен</option>
              </select>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="px-3 py-2 border rounded-md bg-background"
              >
                <option value="all">Все типы</option>
                <option value="project">Проект</option>
                <option value="kpi">KPI</option>
                <option value="annual">Годовой</option>
              </select>
            </div>
          </div>
        </div>

        <TabsContent value="list" className="space-y-4">
          {filteredBonuses.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">Бонусы не найдены</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredBonuses.map((bonus) => (
                <Card key={bonus.id} className="p-4 hover:bg-secondary/50 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{bonus.employeeName}</h3>
                        {getStatusBadge(bonus.status)}
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">{bonus.projectName}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(bonus.date), 'dd MMMM yyyy', { locale: ru })}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-2xl font-bold">{(bonus.amount || 0).toLocaleString('ru-RU')} ₸</p>
                        <p className="text-xs text-muted-foreground">{bonus.percent}% от базы</p>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="by-employee" className="space-y-4">
          {bonusesByEmployee.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">Данные не найдены</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {bonusesByEmployee.map(({ employee, total, bonuses }) => (
                <Card key={employee.id || employee.name} className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">{employee.name || 'Неизвестный сотрудник'}</h3>
                      <p className="text-sm text-muted-foreground">{bonuses.length} бонусов</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">{(total || 0).toLocaleString('ru-RU')} ₸</p>
                      <p className="text-xs text-muted-foreground">Итого</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {bonuses.map((bonus) => (
                      <div key={bonus.id} className="flex items-center justify-between p-2 bg-secondary/50 rounded">
                        <div>
                          <p className="text-sm font-medium">{bonus.projectName}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(bonus.date), 'dd MMM yyyy', { locale: ru })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(bonus.status)}
                          <span className="font-semibold">{(bonus.amount || 0).toLocaleString('ru-RU')} ₸</span>
                        </div>
                      </div>
                    ))}
                  </div>
      </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
