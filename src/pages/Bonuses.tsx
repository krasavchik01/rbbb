import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjects } from '@/hooks/useProjects-simple';
import { useEmployees } from '@/hooks/useSupabaseData';
import { useAuth } from '@/contexts/AuthContext';
import { calculateProjectFinances } from '@/types/project-v3';
import {
  Gift,
  TrendingUp,
  DollarSign,
  Search,
  CheckCircle,
  Clock,
  Users
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
    <div className="space-y-4 sm:space-y-6 page-enter">

      {/* Заголовок */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <span className="w-9 h-9 rounded-xl bg-yellow-500/15 flex items-center justify-center">
            <Gift className="w-5 h-5 text-yellow-500" />
          </span>
          Бонусы
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">Система бонусов и поощрений</p>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Всего бонусов', value: stats.count, sub: 'записей', icon: Gift, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Общая сумма', value: (stats.total || 0).toLocaleString('ru-RU') + ' ₸', sub: 'начислено', icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-500/10' },
          { label: 'Ожидает', value: (stats.pending || 0).toLocaleString('ru-RU') + ' ₸', sub: 'на рассмотрении', icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
          { label: 'Выплачено', value: (stats.paid || 0).toLocaleString('ru-RU') + ' ₸', sub: 'итого', icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
        ].map(({ label, value, sub, icon: Icon, color, bg }) => (
          <Card key={label} className="p-4 border-0 shadow-sm">
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground truncate">{label}</p>
                <p className="font-bold text-base leading-tight mt-0.5 truncate">{value}</p>
                <p className="text-xs text-muted-foreground/60">{sub}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="list" className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="list" className="gap-1.5"><Gift className="w-3.5 h-3.5" />Список</TabsTrigger>
            <TabsTrigger value="by-employee" className="gap-1.5"><Users className="w-3.5 h-3.5" />По сотрудникам</TabsTrigger>
          </TabsList>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Поиск..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-muted/40 border-0 focus-visible:ring-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
                <SelectTrigger className="bg-muted/40 border-0 text-sm">
                  <SelectValue placeholder="Статус" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все статусы</SelectItem>
                  <SelectItem value="pending">Ожидает</SelectItem>
                  <SelectItem value="approved">Одобрен</SelectItem>
                  <SelectItem value="paid">Выплачен</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
                <SelectTrigger className="bg-muted/40 border-0 text-sm">
                  <SelectValue placeholder="Тип" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все типы</SelectItem>
                  <SelectItem value="project">Проект</SelectItem>
                  <SelectItem value="kpi">KPI</SelectItem>
                  <SelectItem value="annual">Годовой</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <TabsContent value="list" className="space-y-2 mt-2">
          {filteredBonuses.length === 0 ? (
            <Card className="p-12 text-center border-0 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-4">
                <Gift className="w-7 h-7 text-muted-foreground/50" />
              </div>
              <p className="font-medium text-muted-foreground">Бонусы не найдены</p>
              <p className="text-sm text-muted-foreground/60 mt-1">Попробуйте изменить фильтры</p>
            </Card>
          ) : (
            filteredBonuses.map((bonus) => (
              <Card key={bonus.id} className="p-4 border-0 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                    <Gift className="w-5 h-5 text-yellow-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-semibold text-sm truncate">{bonus.employeeName}</h3>
                      {getStatusBadge(bonus.status)}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{bonus.projectName} · {format(new Date(bonus.date), 'dd MMM yyyy', { locale: ru })}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-base text-primary">{(bonus.amount || 0).toLocaleString('ru-RU')} ₸</p>
                    <p className="text-xs text-muted-foreground">{bonus.percent}% от базы</p>
                  </div>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="by-employee" className="space-y-3 mt-2">
          {bonusesByEmployee.length === 0 ? (
            <Card className="p-12 text-center border-0 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-4">
                <Users className="w-7 h-7 text-muted-foreground/50" />
              </div>
              <p className="font-medium text-muted-foreground">Данные не найдены</p>
            </Card>
          ) : (
            bonusesByEmployee.map(({ employee, total, bonuses }) => (
              <Card key={employee.id || employee.name} className="p-4 border-0 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {(employee.name || 'N')[0]}
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{employee.name || 'Неизвестный сотрудник'}</h3>
                      <p className="text-xs text-muted-foreground">{bonuses.length} бонусов</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary">{(total || 0).toLocaleString('ru-RU')} ₸</p>
                    <p className="text-xs text-muted-foreground">Итого</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {bonuses.map((bonus) => (
                    <div key={bonus.id} className="flex items-center justify-between p-2.5 bg-muted/40 rounded-lg">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{bonus.projectName}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(bonus.date), 'dd MMM yyyy', { locale: ru })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                        {getStatusBadge(bonus.status)}
                        <span className="font-semibold text-sm">{(bonus.amount || 0).toLocaleString('ru-RU')} ₸</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
