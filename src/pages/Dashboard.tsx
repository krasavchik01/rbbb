import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { useProjects } from '@/hooks/useProjects';
import { useEmployees } from '@/hooks/useSupabaseData';
import { CheckInWidget } from '@/components/CheckInWidget';
import { 
  TrendingUp, 
  Users, 
  Briefcase, 
  DollarSign, 
  Calendar,
  Clock,
  Target,
  BarChart3,
  PieChart,
  Activity,
  CheckCircle,
  AlertTriangle,
  Zap
} from 'lucide-react';

// Простые компоненты графиков без Recharts
const SimpleBarChart = ({ data, title }: { data: Array<{name: string, value: number}>, title: string }) => {
  const maxValue = Math.max(...data.map(d => d.value));
  
  return (
    <div className="space-y-3">
      <h4 className="font-semibold">{title}</h4>
      {data.map((item, index) => (
        <div key={index} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>{item.name}</span>
            <span className="font-medium">{item.value}</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-500"
              style={{ width: `${(item.value / maxValue) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

const SimplePieChart = ({ data, title }: { data: Array<{name: string, value: number, color: string}>, title: string }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  return (
    <div className="space-y-3">
      <h4 className="font-semibold">{title}</h4>
      <div className="grid grid-cols-2 gap-2">
        {data.map((item, index) => (
          <div key={index} className="flex items-center space-x-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: item.color }}
            />
            <span className="text-sm">{item.name}</span>
            <span className="text-sm font-medium">
              {total > 0 ? Math.round((item.value / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function Dashboard() {
  const { user } = useAuth();
  const { projects = [], loading: projectsLoading } = useProjects();
  const { employees = [], loading: employeesLoading } = useEmployees();
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);

  // Загружаем записи посещений
  useEffect(() => {
    const records = JSON.parse(localStorage.getItem('attendanceRecords') || '[]');
    setAttendanceRecords(records);
  }, []);

  // Безопасные вычисления
  const safeNumber = (value: any): number => {
    if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
      return 0;
    }
    return Number(value);
  };

  // Статистика проектов
  const projectStats = {
    total: projects.length,
    active: projects.filter((p: any) => p.status === 'active').length,
    completed: projects.filter((p: any) => p.status === 'completed').length,
    totalRevenue: projects.reduce((sum: number, p: any) => sum + safeNumber(p.budget), 0),
    avgBudget: projects.length > 0 ? projects.reduce((sum: number, p: any) => sum + safeNumber(p.budget), 0) / projects.length : 0
  };

  // Статистика сотрудников
  const employeeStats = {
    total: employees.length,
    byRole: employees.reduce((acc: any, emp: any) => {
      acc[emp.role] = (acc[emp.role] || 0) + 1;
      return acc;
    }, {}),
    attendanceToday: attendanceRecords.filter((r: any) => 
      r.date === new Date().toDateString()
    ).length
  };

  // Данные для графиков
  const projectStatusData = [
    { name: 'Активные', value: projectStats.active, color: '#10b981' },
    { name: 'Завершенные', value: projectStats.completed, color: '#3b82f6' },
    { name: 'В планах', value: projectStats.total - projectStats.active - projectStats.completed, color: '#f59e0b' }
  ];

  const roleDistributionData = Object.entries(employeeStats.byRole).map(([role, count]) => ({
    name: role === 'partner' ? 'Партнеры' : 
          role === 'project_manager' ? 'РП' :
          role === 'manager' ? 'Менеджеры' :
          role === 'tax_specialist' ? 'Налоговики' :
          role === 'assistant' ? 'Ассистенты' :
          role === 'admin' ? 'Админы' : role,
    value: count as number
  }));

  const monthlyRevenueData = [
    { name: 'Янв', value: 1500000 },
    { name: 'Фев', value: 1800000 },
    { name: 'Мар', value: 2200000 },
    { name: 'Апр', value: 1900000 },
    { name: 'Май', value: 2500000 },
    { name: 'Июн', value: 2800000 }
  ];

  // KPI метрики
  const kpiMetrics = [
    {
      title: 'Выполнение плана',
      value: 87,
      target: 100,
      icon: Target,
      color: 'text-success'
    },
    {
      title: 'Средний бюджет проекта',
      value: Math.round(projectStats.avgBudget / 1000),
      target: 3000,
      icon: DollarSign,
      color: 'text-primary'
    },
    {
      title: 'Активность команды',
      value: Math.round((employeeStats.attendanceToday / employeeStats.total) * 100),
      target: 90,
      icon: Activity,
      color: 'text-warning'
    },
    {
      title: 'Завершенные проекты',
      value: projectStats.completed,
      target: 15,
      icon: CheckCircle,
      color: 'text-info'
    }
  ];

  if (projectsLoading || employeesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">📊 Дашборд</h1>
          <p className="text-muted-foreground">Обзор деятельности компании</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="flex items-center space-x-1">
            <Activity className="h-3 w-3" />
            <span>Обновлено: {new Date().toLocaleTimeString('ru-RU')}</span>
          </Badge>
        </div>
      </div>

      {/* Основные метрики */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Общая выручка</p>
              <p className="text-2xl font-bold">
                {(projectStats.totalRevenue / 1000000).toFixed(1)}M ₸
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-success" />
          </div>
          <div className="mt-2">
            <Badge variant="outline" className="text-xs">
              <TrendingUp className="h-3 w-3 mr-1" />
              +12% к прошлому месяцу
            </Badge>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Активные проекты</p>
              <p className="text-2xl font-bold">{projectStats.active}</p>
            </div>
            <Briefcase className="h-8 w-8 text-primary" />
          </div>
          <div className="mt-2">
            <Badge variant="outline" className="text-xs">
              <Zap className="h-3 w-3 mr-1" />
              В работе
            </Badge>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Сотрудники</p>
              <p className="text-2xl font-bold">{employeeStats.total}</p>
            </div>
            <Users className="h-8 w-8 text-info" />
          </div>
          <div className="mt-2">
            <Badge variant="outline" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              {employeeStats.attendanceToday} сегодня
            </Badge>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Завершено</p>
              <p className="text-2xl font-bold">{projectStats.completed}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-success" />
          </div>
          <div className="mt-2">
            <Badge variant="outline" className="text-xs">
              <Calendar className="h-3 w-3 mr-1" />
              За этот месяц
            </Badge>
          </div>
        </Card>
      </div>

      {/* KPI метрики */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiMetrics.map((metric, index) => (
          <Card key={index} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <metric.icon className={`h-5 w-5 ${metric.color}`} />
              <span className="text-sm text-muted-foreground">KPI</span>
            </div>
            <p className="text-lg font-semibold">{metric.value}</p>
            <p className="text-sm text-muted-foreground mb-2">{metric.title}</p>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Прогресс</span>
                <span>{Math.round((metric.value / metric.target) * 100)}%</span>
              </div>
              <Progress 
                value={(metric.value / metric.target) * 100} 
                className="h-2"
              />
            </div>
          </Card>
        ))}
      </div>

      {/* Графики и аналитика */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Статус проектов */}
        <Card className="p-6">
          <div className="flex items-center space-x-2 mb-4">
            <PieChart className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Статус проектов</h3>
          </div>
          <SimplePieChart data={projectStatusData} title="" />
        </Card>

        {/* Распределение по ролям */}
        <Card className="p-6">
          <div className="flex items-center space-x-2 mb-4">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Команда по ролям</h3>
          </div>
          <SimpleBarChart data={roleDistributionData} title="" />
        </Card>

        {/* Месячная выручка */}
        <Card className="p-6">
          <div className="flex items-center space-x-2 mb-4">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Выручка по месяцам</h3>
          </div>
          <SimpleBarChart data={monthlyRevenueData} title="" />
        </Card>

        {/* Посещаемость */}
        <Card className="p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Activity className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Посещаемость</h3>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm">Сегодня в офисе</span>
              <span className="font-semibold">
                {attendanceRecords.filter((r: any) => 
                  r.date === new Date().toDateString() && r.status === 'in_office'
                ).length}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Удаленно</span>
              <span className="font-semibold">
                {attendanceRecords.filter((r: any) => 
                  r.date === new Date().toDateString() && r.status === 'remote'
                ).length}
              </span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full"
                style={{ 
                  width: `${employeeStats.total > 0 ? 
                    (employeeStats.attendanceToday / employeeStats.total) * 100 : 0}%` 
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {employeeStats.total > 0 ? 
                Math.round((employeeStats.attendanceToday / employeeStats.total) * 100) : 0}% 
              сотрудников сегодня
            </p>
          </div>
        </Card>
      </div>

      {/* Виджет отметки посещений */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <CheckInWidget />
        </div>
        
        {/* Последние активности */}
        <div className="lg:col-span-2">
          <Card className="p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Clock className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Последние активности</h3>
            </div>
            <div className="space-y-3">
              {attendanceRecords
                .filter((r: any) => r.date === new Date().toDateString())
                .slice(-5)
                .map((record: any, index: number) => (
                <div key={index} className="flex items-center space-x-3 p-3 bg-secondary/50 rounded-lg">
                  <div className="flex-shrink-0">
                    {record.checkOut ? (
                      <XCircle className="h-4 w-4 text-destructive" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-success" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {employees.find((emp: any) => emp.id === record.employeeId)?.name || 'Сотрудник'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {record.checkOut ? 'Завершил работу' : 'Начал работу'} в {new Date(record.checkIn).toLocaleTimeString('ru-RU')}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {record.status === 'in_office' ? 'В офисе' : 'Удаленно'}
                  </Badge>
                </div>
              ))}
              
              {attendanceRecords.filter((r: any) => r.date === new Date().toDateString()).length === 0 && (
                <div className="text-center py-4">
                  <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Нет активностей за сегодня</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}