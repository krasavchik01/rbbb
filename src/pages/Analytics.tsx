import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProjects } from '@/hooks/useProjects-simple';
import { useEmployees } from '@/hooks/useSupabaseData';
import { useAuth } from '@/contexts/AuthContext';
import { 
  TrendingUp, 
  TrendingDown,
  Users, 
  Briefcase, 
  DollarSign, 
  Calendar,
  BarChart3,
  PieChart,
  Activity,
  Target,
  Clock,
  CheckCircle
} from 'lucide-react';
import { calculateProjectFinances } from '@/types/project-v3';

// Простые компоненты графиков
const SimpleBarChart = ({ data, title }: { data: Array<{name: string, value: number}>, title: string }) => {
  const safeValue = (val: number) => isNaN(val) || !isFinite(val) ? 0 : val;
  const maxValue = Math.max(...data.map(d => safeValue(d.value)), 1);
  
  return (
    <div className="space-y-3">
      <h4 className="font-semibold mb-4">{title}</h4>
      {data.map((item, index) => {
        const value = safeValue(item.value);
        const width = maxValue > 0 ? (value / maxValue) * 100 : 0;
        return (
          <div key={index} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="truncate flex-1">{item.name}</span>
              <span className="font-medium ml-2">{value.toLocaleString('ru-RU')}</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(0, Math.min(100, width))}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const SimplePieChart = ({ data, title }: { data: Array<{name: string, value: number, color: string}>, title: string }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  return (
    <div className="space-y-3">
      <h4 className="font-semibold mb-4">{title}</h4>
      <div className="space-y-2">
        {data.map((item, index) => (
          <div key={index} className="flex items-center justify-between">
            <div className="flex items-center space-x-2 flex-1">
              <div 
                className="w-4 h-4 rounded-full flex-shrink-0" 
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm truncate">{item.name}</span>
            </div>
            <div className="text-right ml-2">
              <span className="text-sm font-medium">
                {total > 0 ? Math.round((item.value / total) * 100) : 0}%
              </span>
              <span className="text-xs text-muted-foreground ml-1">
                ({(item.value || 0).toLocaleString('ru-RU')})
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function Analytics() {
  const { projects = [] } = useProjects();
  const { employees = [] } = useEmployees();
  const { checkPermission } = useAuth();
  
  // Проверка прав доступа к бонусам
  const canViewBonuses = checkPermission('VIEW_ALL_BONUSES');

  // Статистика проектов
  const projectStats = useMemo(() => {
    const total = projects.length;
    const inProgress = projects.filter((p: any) => p.status === 'in_progress').length;
    const completed = projects.filter((p: any) => p.status === 'completed').length;
    const pending = projects.filter((p: any) => p.status === 'pending' || p.status === 'draft').length;
    
    const totalRevenue = projects.reduce((sum: number, p: any) => {
      const finances = calculateProjectFinances(p);
      return sum + finances.amountWithoutVAT;
    }, 0);

    const totalBonuses = projects.reduce((sum: number, p: any) => {
      const finances = calculateProjectFinances(p);
      return sum + finances.totalBonusAmount;
    }, 0);

    const totalProfit = projects.reduce((sum: number, p: any) => {
      const finances = calculateProjectFinances(p);
      return sum + finances.grossProfit;
    }, 0);

    return {
      total,
      inProgress,
      completed,
      pending,
      totalRevenue,
      totalBonuses,
      totalProfit,
      avgProfitMargin: total > 0 ? projects.reduce((sum: number, p: any) => {
        const finances = calculateProjectFinances(p);
        return sum + finances.profitMargin;
      }, 0) / total : 0
    };
  }, [projects]);

  // Проекты по статусам
  const projectsByStatus = useMemo(() => {
    const statuses: Record<string, number> = {};
    projects.forEach((p: any) => {
      statuses[p.status] = (statuses[p.status] || 0) + 1;
    });
    return Object.entries(statuses).map(([status, count]) => ({
      name: status === 'in_progress' ? 'В работе' : 
            status === 'completed' ? 'Завершено' :
            status === 'pending' ? 'Ожидает' :
            status === 'draft' ? 'Черновик' : status,
      value: count
    }));
  }, [projects]);

  // Проекты по менеджерам
  const projectsByManager = useMemo(() => {
    const managers: Record<string, number> = {};
    projects.forEach((p: any) => {
      const managerId = p.manager_id || p.managerId;
      if (managerId) {
        const manager = employees.find((e: any) => e.id === managerId);
        const name = manager?.name || `Менеджер ${managerId}`;
        managers[name] = (managers[name] || 0) + 1;
      }
    });
    return Object.entries(managers)
      .map(([name, count]) => ({ name, value: count }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [projects, employees]);

  // Финансы по проектам
  const financesByProject = useMemo(() => {
    return projects
      .map((p: any) => {
        const finances = calculateProjectFinances(p);
        return {
          name: p.name || p.title || 'Без названия',
          revenue: finances.amountWithoutVAT,
          profit: finances.grossProfit,
          bonuses: finances.totalBonusAmount
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [projects]);

  // Бонусы по сотрудникам
  const bonusesByEmployee = useMemo(() => {
    const bonuses: Record<string, number> = {};
    projects.forEach((p: any) => {
      const finances = calculateProjectFinances(p);
      if (finances.teamBonuses) {
        Object.entries(finances.teamBonuses).forEach(([userId, bonus]: [string, any]) => {
          bonuses[userId] = (bonuses[userId] || 0) + (bonus.amount || 0);
        });
      }
    });

    return Object.entries(bonuses)
      .map(([userId, amount]) => {
        const employee = employees.find((e: any) => e.id === userId);
        return {
          name: employee?.name || `Сотрудник ${userId}`,
          value: amount
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [projects, employees]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <BarChart3 className="w-8 h-8" />
          Аналитика
        </h1>
        <p className="text-muted-foreground mt-2">Детальная аналитика по проектам и сотрудникам</p>
      </div>

      {/* Основные метрики */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Всего проектов</p>
              <p className="text-2xl font-bold">{projectStats.total}</p>
            </div>
            <Briefcase className="w-8 h-8 text-primary" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Общая выручка</p>
              <p className="text-2xl font-bold">{(projectStats.totalRevenue || 0).toLocaleString('ru-RU')} ₸</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Общая прибыль</p>
              <p className="text-2xl font-bold">{(projectStats.totalProfit || 0).toLocaleString('ru-RU')} ₸</p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Средняя маржа</p>
              <p className="text-2xl font-bold">{(isNaN(projectStats.avgProfitMargin) ? 0 : projectStats.avgProfitMargin).toFixed(1)}%</p>
            </div>
            <Target className="w-8 h-8 text-purple-500" />
          </div>
        </Card>
      </div>
      
      <Tabs defaultValue="projects" className="space-y-4">
        <TabsList>
          <TabsTrigger value="projects">Проекты</TabsTrigger>
          <TabsTrigger value="finances">Финансы</TabsTrigger>
          {canViewBonuses && <TabsTrigger value="bonuses">Бонусы</TabsTrigger>}
          <TabsTrigger value="employees">Сотрудники</TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-6">
              <SimplePieChart 
                data={[
                  { name: 'В работе', value: projectStats.inProgress, color: '#3B82F6' },
                  { name: 'Завершено', value: projectStats.completed, color: '#10B981' },
                  { name: 'Ожидает', value: projectStats.pending, color: '#F59E0B' }
                ]}
                title="Проекты по статусам"
              />
            </Card>
            <Card className="p-6">
              <SimpleBarChart 
                data={projectsByManager}
                title="Проекты по менеджерам"
              />
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="finances" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-6">
              <SimpleBarChart 
                data={financesByProject.map(p => ({ name: p.name, value: p.revenue }))}
                title="Выручка по проектам (топ 10)"
              />
            </Card>
            <Card className="p-6">
              <SimpleBarChart 
                data={financesByProject.map(p => ({ name: p.name, value: p.profit }))}
                title="Прибыль по проектам (топ 10)"
              />
            </Card>
          </div>
        </TabsContent>

        {canViewBonuses && (
          <TabsContent value="bonuses" className="space-y-4">
      <Card className="p-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Общая сумма бонусов</h3>
                <p className="text-3xl font-bold text-primary mt-2">
                  {(projectStats.totalBonuses || 0).toLocaleString('ru-RU')} ₸
                </p>
              </div>
              <SimpleBarChart 
                data={bonusesByEmployee}
                title="Бонусы по сотрудникам (топ 10)"
              />
            </Card>
          </TabsContent>
        )}

        <TabsContent value="employees" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Всего сотрудников</p>
                  <p className="text-2xl font-bold">{employees.length}</p>
                </div>
                <Users className="w-8 h-8 text-primary" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Активных проектов</p>
                  <p className="text-2xl font-bold">{projectStats.inProgress}</p>
                </div>
                <Activity className="w-8 h-8 text-green-500" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Завершено проектов</p>
                  <p className="text-2xl font-bold">{projectStats.completed}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-blue-500" />
              </div>
      </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
