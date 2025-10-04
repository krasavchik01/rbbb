import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/StatCard";
import { KPIIndicator } from "@/components/KPIIndicator";
import { ProgressBar } from "@/components/ProgressBar";
import { CompanyBadge } from "@/components/CompanyBadge";
import { COMPANIES, DEPARTMENTS } from "@/types";
import { 
  TrendingUp, 
  Users, 
  DollarSign,
  FolderOpen,
  Building2,
  UserCheck,
  ArrowRight,
  Download,
  Filter
} from "lucide-react";

export default function Analytics() {
  const companyStats = [
    {
      company: COMPANIES[0],
      projects: 8,
      employees: 12,
      revenue: "₽1,200,000",
      avgKPI: 87,
      completed: 5
    },
    {
      company: COMPANIES[1],
      projects: 5,
      employees: 8,
      revenue: "₽850,000",
      avgKPI: 91,
      completed: 3
    },
    {
      company: COMPANIES[2],
      projects: 3,
      employees: 6,
      revenue: "₽450,000",
      avgKPI: 83,
      completed: 2
    },
    {
      company: COMPANIES[3],
      projects: 4,
      employees: 7,
      revenue: "₽620,000",
      avgKPI: 79,
      completed: 1
    },
    {
      company: COMPANIES[4],
      projects: 2,
      employees: 4,
      revenue: "₽320,000",
      avgKPI: 85,
      completed: 2
    }
  ];

  const departmentStats = [
    { department: DEPARTMENTS[1], employees: 5, avgKPI: 92, bonuses: "₽480,000" },
    { department: DEPARTMENTS[2], employees: 8, avgKPI: 85, bonuses: "₽320,000" },
    { department: DEPARTMENTS[4], employees: 12, avgKPI: 81, bonuses: "₽240,000" },
    { department: DEPARTMENTS[3], employees: 6, avgKPI: 88, bonuses: "₽180,000" },
    { department: DEPARTMENTS[5], employees: 9, avgKPI: 83, bonuses: "₽270,000" }
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Аналитика
          </h1>
          <p className="text-muted-foreground mt-1">Сводная аналитика по группе компаний</p>
        </div>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            className="btn-glass"
            onClick={() => {
              // TODO: Implement filters functionality
              console.log('Filters clicked');
            }}
          >
            <Filter className="w-4 h-4 mr-2" />
            Фильтры
          </Button>
          <Button 
            className="btn-gradient"
            onClick={() => {
              // TODO: Implement PDF export functionality
              console.log('Export PDF clicked');
            }}
          >
            <Download className="w-4 h-4 mr-2" />
            Экспорт PDF
          </Button>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Общий доход"
          value="₽3.44M"
          icon={<DollarSign className="w-6 h-6 text-primary" />}
          trend={{ value: 18.2, isPositive: true }}
          variant="primary"
        />
        <StatCard
          title="Активные проекты"
          value={22}
          icon={<FolderOpen className="w-6 h-6 text-success" />}
          trend={{ value: 12.1, isPositive: true }}
          variant="success"
        />
        <StatCard
          title="Сотрудники группы"
          value={47}
          icon={<Users className="w-6 h-6 text-warning" />}
          trend={{ value: 8.7, isPositive: true }}
          variant="warning"
        />
        <StatCard
          title="Средний KPI группы"
          value="85%"
          icon={<TrendingUp className="w-6 h-6 text-secondary" />}
          trend={{ value: 4.3, isPositive: true }}
        />
      </div>

      {/* Company Analytics */}
      <Card className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Аналитика по компаниям</h3>
              <p className="text-sm text-muted-foreground">Показатели эффективности каждой компании</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-primary hover:text-primary-glow"
            onClick={() => {
              // TODO: Implement detailed company analytics functionality
              console.log('View detailed company analytics clicked');
            }}
          >
            Подробнее
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {companyStats.map((stat, index) => (
            <div key={index} className="p-4 rounded-lg border border-glass-border bg-secondary/20">
              <div className="flex items-center justify-between mb-3">
                <CompanyBadge company={stat.company} variant="secondary" />
                <KPIIndicator value={stat.avgKPI} size="sm" />
              </div>
              
              <div className="space-y-2 mb-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Проекты:</span>
                  <span>{stat.projects} ({stat.completed} завершено)</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Сотрудники:</span>
                  <span>{stat.employees}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Доход:</span>
                  <span className="font-semibold text-success">{stat.revenue}</span>
                </div>
              </div>

              <ProgressBar 
                value={(stat.completed / stat.projects) * 100}
                variant="success"
                showLabel={false}
              />
              <div className="text-xs text-muted-foreground mt-1">
                Завершено: {Math.round((stat.completed / stat.projects) * 100)}%
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Department Analytics */}
      <Card className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-success/20 to-warning/20 rounded-lg flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-success" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Аналитика по отделам</h3>
              <p className="text-sm text-muted-foreground">KPI и бонусы по отделам</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {departmentStats.map((stat, index) => (
            <div key={index} className="p-4 rounded-lg border border-glass-border bg-secondary/20">
              <div className="flex items-center justify-between mb-3">
                <h4 className={`text-sm font-medium ${stat.department.color}`}>
                  {stat.department.name}
                </h4>
                <KPIIndicator value={stat.avgKPI} size="sm" />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Сотрудники:</span>
                  <span>{stat.employees}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Средний KPI:</span>
                  <span>{stat.avgKPI}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Бонусы:</span>
                  <span className="font-semibold text-success">{stat.bonuses}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Monthly Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-card p-6">
          <h3 className="text-lg font-semibold mb-4">Тренды по месяцам</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Ноябрь 2023</span>
              <div className="flex items-center space-x-2">
                <span className="text-sm">KPI: 83%</span>
                <span className="text-sm text-success">Доход: ₽2.8M</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Декабрь 2023</span>
              <div className="flex items-center space-x-2">
                <span className="text-sm">KPI: 85%</span>
                <span className="text-sm text-success">Доход: ₽3.2M</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Январь 2024</span>
              <div className="flex items-center space-x-2">
                <span className="text-sm">KPI: 87%</span>
                <span className="text-sm text-success">Доход: ₽3.44M</span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="glass-card p-6">
          <h3 className="text-lg font-semibold mb-4">Топ показатели</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2 rounded bg-success/10">
              <span className="text-sm">Лучший KPI отдела</span>
              <span className="text-sm font-semibold text-success">Партнёры - 92%</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-primary/10">
              <span className="text-sm">Самая прибыльная компания</span>
              <span className="text-sm font-semibold text-primary">RB IT Audit</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-warning/10">
              <span className="text-sm">Больше всего проектов</span>
              <span className="text-sm font-semibold text-warning">RB IT Audit - 8</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}