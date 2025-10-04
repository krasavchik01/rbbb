import { StatCard } from "@/components/StatCard";
import { KPIIndicator } from "@/components/KPIIndicator";
import { ProgressBar } from "@/components/ProgressBar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  FolderOpen, 
  Users, 
  TrendingUp, 
  DollarSign, 
  Calendar,
  Bell,
  ArrowRight,
  Star,
  Trophy,
  BarChart3,
  PieChart,
  Activity,
  Target
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { RoleBasedAccess, RoleAccess } from "@/components/RoleBasedAccess";
import { useAuth } from "@/hooks/useAuth";
import { PERMISSIONS } from "@/types/roles";
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart as RechartsPieChart, 
  Pie,
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  RadialBarChart,
  RadialBar
} from 'recharts';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, checkPermission } = useAuth();
  const topEmployees = [
    { id: 1, name: "Анна Иванова", role: "Руководитель проекта", kpi: 95, avatar: "AI" },
    { id: 2, name: "Михаил Петров", role: "Партнёр", kpi: 92, avatar: "МП" },
    { id: 3, name: "Елена Сидорова", role: "Ассистент", kpi: 88, avatar: "ЕС" },
    { id: 4, name: "Дмитрий Козлов", role: "Руководитель проекта", kpi: 85, avatar: "ДК" },
    { id: 5, name: "Ольга Морозова", role: "Партнёр", kpi: 82, avatar: "ОМ" }
  ];

  const recentProjects = [
    { name: "Аудит налогов ПАО Газпром", progress: 85, status: "progress" },
    { name: "IT-аудит безопасности Сбербанк", progress: 95, status: "active" },
    { name: "Due Diligence ВТБ", progress: 100, status: "completed" }
  ];

  const deadlines = [
    { project: "Аудит налогов ПАО Газпром", date: "15 дек", urgent: true },
    { project: "IT-аудит безопасности Сбербанк", date: "20 дек", urgent: false },
    { project: "Аудит ФНО Альфа-Банк", date: "25 дек", urgent: false }
  ];

  // Данные для графиков
  const revenueData = [
    { month: 'Янв', revenue: 1800000, projects: 8 },
    { month: 'Фев', revenue: 2100000, projects: 10 },
    { month: 'Мар', revenue: 1950000, projects: 9 },
    { month: 'Апр', revenue: 2400000, projects: 12 },
    { month: 'Май', revenue: 2200000, projects: 11 },
    { month: 'Июн', revenue: 2600000, projects: 13 }
  ];

  const kpiData = [
    { name: 'Анна Иванова', kpi: 95, projects: 3 },
    { name: 'Михаил Петров', kpi: 92, projects: 4 },
    { name: 'Елена Сидорова', kpi: 88, projects: 2 },
    { name: 'Дмитрий Козлов', kpi: 85, projects: 3 },
    { name: 'Ольга Морозова', kpi: 82, projects: 2 }
  ];

  const projectStatusData = [
    { name: 'В работе', value: 8, color: '#3B82F6' },
    { name: 'Завершены', value: 12, color: '#10B981' },
    { name: 'На паузе', value: 3, color: '#F59E0B' },
    { name: 'Просрочены', value: 2, color: '#EF4444' }
  ];

  const departmentPerformance = [
    { department: 'Аудиторы', performance: 92, employees: 15 },
    { department: 'Налоговики', performance: 88, employees: 12 },
    { department: 'ИТ', performance: 95, employees: 8 },
    { department: 'HR', performance: 85, employees: 5 },
    { department: 'Юридический', performance: 90, employees: 6 }
  ];

  const monthlyGoals = [
    { goal: 'Проекты', current: 12, target: 15, color: '#3B82F6' },
    { goal: 'Доход', current: 2400000, target: 3000000, color: '#10B981' },
    { goal: 'KPI', current: 87, target: 90, color: '#F59E0B' },
    { goal: 'Клиенты', current: 8, target: 10, color: '#8B5CF6' }
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="animate-slide-up">
          <h1 className="text-4xl font-bold text-gradient text-glow">
            🚀 Дашборд RB Partners
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">Операционный центр группы компаний RB Partners Group</p>
        </div>
        <div className="flex space-x-3 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <RoleBasedAccess 
            permission={PERMISSIONS.VIEW_NOTIFICATIONS}
            userRole={user?.role || 'employee'}
          >
            <Button
              className="btn-enhanced btn-glass hover-glow"
              onClick={() => navigate('/notifications')}
            >
              <Bell className="w-4 h-4 mr-2" />
              🔔 Уведомления
            </Button>
          </RoleBasedAccess>
          <RoleBasedAccess 
            permission={PERMISSIONS.VIEW_CALENDAR}
            userRole={user?.role || 'employee'}
          >
            <Button
              className="btn-enhanced btn-gradient hover-glow"
              onClick={() => navigate('/calendar')}
            >
              <Calendar className="w-4 h-4 mr-2" />
              📅 Календарь
            </Button>
          </RoleBasedAccess>
        </div>
      </div>

      {/* Key Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card-enhanced hover-lift animate-bounce-in" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center animate-float">
              <FolderOpen className="w-6 h-6 text-white" />
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gradient">12</div>
              <div className="text-sm text-success flex items-center">
                <TrendingUp className="w-3 h-3 mr-1" />
                +8.5%
              </div>
            </div>
          </div>
          <h3 className="text-lg font-semibold mb-1">Активные проекты</h3>
          <p className="text-sm text-muted-foreground">В работе сейчас</p>
        </div>

        <div className="card-enhanced hover-lift animate-bounce-in" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 gradient-success rounded-xl flex items-center justify-center animate-float" style={{ animationDelay: '0.5s' }}>
              <Users className="w-6 h-6 text-white" />
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gradient">45</div>
              <div className="text-sm text-success flex items-center">
                <TrendingUp className="w-3 h-3 mr-1" />
                +12.3%
              </div>
            </div>
          </div>
          <h3 className="text-lg font-semibold mb-1">Сотрудники</h3>
          <p className="text-sm text-muted-foreground">В команде</p>
        </div>

        <div className="card-enhanced hover-lift animate-bounce-in" style={{ animationDelay: '0.3s' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 gradient-warning rounded-xl flex items-center justify-center animate-float" style={{ animationDelay: '1s' }}>
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gradient">87%</div>
              <div className="text-sm text-success flex items-center">
                <TrendingUp className="w-3 h-3 mr-1" />
                +3.2%
              </div>
            </div>
          </div>
          <h3 className="text-lg font-semibold mb-1">Средний KPI</h3>
          <p className="text-sm text-muted-foreground">Эффективность</p>
        </div>

        <div className="card-enhanced hover-lift animate-bounce-in" style={{ animationDelay: '0.4s' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center animate-float" style={{ animationDelay: '1.5s' }}>
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gradient">₽2.4M</div>
              <div className="text-sm text-success flex items-center">
                <TrendingUp className="w-3 h-3 mr-1" />
                +15.8%
              </div>
            </div>
          </div>
          <h3 className="text-lg font-semibold mb-1">Доход за месяц</h3>
          <p className="text-sm text-muted-foreground">Общая выручка</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Top Employees */}
        <div className="card-enhanced hover-lift lg:col-span-2 animate-slide-up">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 gradient-warning rounded-xl flex items-center justify-center animate-pulse-glow">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gradient">🏆 ТОП-5 сотрудников</h3>
                <p className="text-sm text-muted-foreground">По показателям KPI</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="btn-enhanced text-primary hover:text-primary-glow"
              onClick={() => navigate('/employees')}
            >
              Все сотрудники
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          <div className="space-y-4">
            {topEmployees.map((employee, index) => (
              <div 
                key={employee.id} 
                className="flex items-center space-x-4 p-4 rounded-xl hover:bg-secondary/30 transition-all duration-300 cursor-pointer hover-lift group"
                onClick={() => navigate(`/employees/${employee.id}`, { state: { employee } })}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="w-12 h-12 gradient-primary rounded-full flex items-center justify-center shadow-lg group-hover:shadow-primary/50 transition-all duration-300">
                      <span className="text-sm font-bold text-white">{employee.avatar}</span>
                    </div>
                    {index < 3 && (
                      <div className="absolute -top-1 -right-1 w-6 h-6 gradient-warning rounded-full flex items-center justify-center animate-pulse-glow">
                        <Star className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-lg group-hover:text-primary transition-colors">{employee.name}</p>
                    <p className="text-sm text-muted-foreground">{employee.role}</p>
                  </div>
                </div>
                <div className="ml-auto">
                  <div className="badge-primary px-3 py-1">
                    {employee.kpi}% KPI
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Deadlines */}
        <div className="card-enhanced hover-lift animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-12 h-12 gradient-warning rounded-xl flex items-center justify-center animate-pulse-glow">
              <Bell className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gradient">⏰ Критичные дедлайны</h3>
              <p className="text-sm text-muted-foreground">Ближайшие сроки</p>
            </div>
          </div>

          <div className="space-y-3">
            {deadlines.map((deadline, index) => (
              <div 
                key={index} 
                className={`p-4 rounded-xl border transition-all duration-300 hover-lift ${
                  deadline.urgent 
                    ? 'border-destructive/30 bg-destructive/10 hover:bg-destructive/20'
                    : 'border-glass-border bg-secondary/20 hover:bg-secondary/30'
                }`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-sm group-hover:text-primary transition-colors">{deadline.project}</p>
                    <p className={`text-xs flex items-center ${
                      deadline.urgent ? 'text-destructive' : 'text-muted-foreground'
                    }`}>
                      <Calendar className="w-3 h-3 mr-1" />
                      Дедлайн: {deadline.date}
                    </p>
                  </div>
                  {deadline.urgent && (
                    <div className="w-3 h-3 bg-destructive rounded-full animate-pulse-glow" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Projects */}
      <div className="card-enhanced hover-lift animate-slide-up" style={{ animationDelay: '0.4s' }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center animate-float">
              <FolderOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gradient">📁 Прогресс проектов</h3>
              <p className="text-sm text-muted-foreground">Текущее состояние активных проектов</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="btn-enhanced text-primary hover:text-primary-glow"
            onClick={() => navigate('/projects')}
          >
            Все проекты
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {recentProjects.map((project, index) => (
            <div 
              key={index} 
              className="p-5 rounded-xl border border-glass-border bg-secondary/20 hover:bg-secondary/30 transition-all duration-300 hover-lift group"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="mb-4">
                <h4 className="font-semibold text-lg group-hover:text-primary transition-colors">{project.name}</h4>
                <p className="text-sm text-muted-foreground flex items-center">
                  <div className="w-2 h-2 bg-success rounded-full mr-2 animate-pulse-glow"></div>
                  Активен
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{project.progress}%</span>
                  <span className="text-muted-foreground">Прогресс</span>
                </div>
                <div className="progress-enhanced h-3">
                  <div 
                    className="h-full rounded-full transition-all duration-500"
                    style={{ 
                      width: `${project.progress}%`,
                      background: project.progress === 100 
                        ? 'linear-gradient(90deg, #10B981, #059669)'
                        : project.progress > 80 
                        ? 'linear-gradient(90deg, #F59E0B, #D97706)'
                        : 'linear-gradient(90deg, #3B82F6, #1D4ED8)'
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Revenue Trend Chart */}
        <div className="card-enhanced hover-lift animate-slide-up" style={{ animationDelay: '0.5s' }}>
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-12 h-12 gradient-success rounded-xl flex items-center justify-center animate-float">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gradient">📈 Динамика доходов</h3>
              <p className="text-sm text-muted-foreground">За последние 6 месяцев</p>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => `₽${(value / 1000000).toFixed(1)}M`} />
                <Tooltip 
                  formatter={(value, name) => [
                    name === 'revenue' ? `₽${(value as number).toLocaleString()}` : value,
                    name === 'revenue' ? 'Доход' : 'Проекты'
                  ]}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#10B981" 
                  fill="url(#revenueGradient)" 
                  strokeWidth={2}
                />
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Project Status Distribution */}
        <div className="card-enhanced hover-lift animate-slide-up" style={{ animationDelay: '0.6s' }}>
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center animate-float" style={{ animationDelay: '0.5s' }}>
              <PieChart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gradient">🥧 Статус проектов</h3>
              <p className="text-sm text-muted-foreground">Распределение по статусам</p>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={projectStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {projectStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value} проектов`, 'Количество']} />
                <Legend />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Department Performance & Monthly Goals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Department Performance */}
        <div className="card-enhanced hover-lift animate-slide-up" style={{ animationDelay: '0.7s' }}>
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-12 h-12 gradient-warning rounded-xl flex items-center justify-center animate-float" style={{ animationDelay: '1s' }}>
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gradient">📊 Производительность отделов</h3>
              <p className="text-sm text-muted-foreground">Средний KPI по отделам</p>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departmentPerformance} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis dataKey="department" type="category" width={80} />
                <Tooltip 
                  formatter={(value, name) => [
                    `${value}%`,
                    name === 'performance' ? 'KPI' : 'Сотрудники'
                  ]}
                />
                <Bar dataKey="performance" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Goals Progress */}
        <div className="card-enhanced hover-lift animate-slide-up" style={{ animationDelay: '0.8s' }}>
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-12 h-12 gradient-warning rounded-xl flex items-center justify-center animate-float" style={{ animationDelay: '1.5s' }}>
              <Target className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gradient">🎯 Цели месяца</h3>
              <p className="text-sm text-muted-foreground">Прогресс по ключевым показателям</p>
            </div>
          </div>
          <div className="space-y-4">
            {monthlyGoals.map((goal, index) => {
              const percentage = Math.round((goal.current / goal.target) * 100);
              return (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{goal.goal}</span>
                    <span className="text-sm text-muted-foreground">
                      {goal.goal === 'Доход' 
                        ? `₽${(goal.current / 1000000).toFixed(1)}M / ₽${(goal.target / 1000000).toFixed(1)}M`
                        : `${goal.current} / ${goal.target}`
                      }
                    </span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div 
                      className="h-2 rounded-full transition-all duration-500"
                      style={{ 
                        width: `${Math.min(percentage, 100)}%`,
                        backgroundColor: goal.color
                      }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {percentage}% выполнено
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* KPI Performance Chart */}
      <div className="card-enhanced hover-lift animate-slide-up" style={{ animationDelay: '0.9s' }}>
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-12 h-12 gradient-warning rounded-xl flex items-center justify-center animate-float" style={{ animationDelay: '2s' }}>
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gradient">⚡ KPI сотрудников</h3>
            <p className="text-sm text-muted-foreground">Топ-5 по показателям эффективности</p>
          </div>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={kpiData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="name" />
              <YAxis domain={[0, 100]} />
              <Tooltip 
                formatter={(value, name) => [
                  `${value}%`,
                  name === 'kpi' ? 'KPI' : 'Проекты'
                ]}
              />
              <Bar dataKey="kpi" fill="#F59E0B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}