import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { KPIIndicator } from "@/components/KPIIndicator";
import { 
  Plus, 
  Search, 
  Filter, 
  DollarSign,
  TrendingUp,
  Users,
  Calendar,
  CheckCircle,
  Clock
} from "lucide-react";

export default function Bonuses() {
  const bonuses = [
    {
      id: 1,
      employee: { name: "Анна Иванова", avatar: "AI", role: "👤 Партнёр" },
      project: "Аудит налогов ПАО Газпром",
      amount: "₽45,000",
      kpi: 95,
      status: "paid" as const,
      date: "14 дек 2024",
      description: "Бонус за превышение KPI и своевременную сдачу аудита"
    },
    {
      id: 2,
      employee: { name: "Михаил Петров", avatar: "МП", role: "🧑‍💼 Руководитель" },
      project: "IT-аудит безопасности Сбербанк",
      amount: "₽32,000",
      kpi: 88,
      status: "pending" as const,
      date: "13 дек 2024",
      description: "Месячный бонус за управление IT-аудитом"
    },
    {
      id: 3,
      employee: { name: "Дмитрий Козлов", avatar: "ДК", role: "👤 Партнёр" },
      project: "Due Diligence ВТБ",
      amount: "₽55,000",
      kpi: 92,
      status: "paid" as const,
      date: "12 дек 2024",
      description: "Бонус за привлечение нового клиента на аудит"
    },
    {
      id: 4,
      employee: { name: "Елена Сидорова", avatar: "ЕС", role: "🧱 Ассистент" },
      project: "Аудит ФНО Альфа-Банк",
      amount: "₽18,000",
      kpi: 82,
      status: "pending" as const,
      date: "11 дек 2024",
      description: "Бонус за качественное выполнение аудиторских процедур"
    },
    {
      id: 5,
      employee: { name: "Ольга Морозова", avatar: "ОМ", role: "🧑‍💼 Руководитель" },
      project: "Аудит налогов ПАО Газпром",
      amount: "₽28,000",
      kpi: 85,
      status: "paid" as const,
      date: "10 дек 2024",
      description: "Бонус за эффективное управление налоговым аудитом"
    }
  ];

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      paid: { text: "💸 Выплачено", variant: "default" as const },
      pending: { text: "⏳ Ожидает", variant: "secondary" as const }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    
    return (
      <Badge 
        variant={config.variant}
        className={`
          ${status === 'paid' ? 'bg-success/20 text-success border-success/30' : ''}
          ${status === 'pending' ? 'bg-warning/20 text-warning border-warning/30' : ''}
        `}
      >
        {config.text}
      </Badge>
    );
  };

  // Analytics data
  const analytics = {
    totalBonuses: "₽1,245,000",
    paidBonuses: "₽892,000",
    pendingBonuses: "₽353,000",
    avgKPI: 88
  };

  const roleStats = [
    { role: "👤 Партнёр", amount: "₽520,000", count: 8 },
    { role: "🧑‍💼 Руководитель", amount: "₽380,000", count: 12 },
    { role: "🧱 Ассистент", amount: "₽185,000", count: 15 },
    { role: "💼 Бухгалтер", amount: "₽160,000", count: 5 }
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-warning bg-clip-text text-transparent">
            Бонусы
          </h1>
          <p className="text-muted-foreground mt-1">Управление системой бонусов и вознаграждений</p>
        </div>
        <Button 
          className="btn-gradient"
          onClick={() => {
            // TODO: Implement create bonus functionality
            console.log('Create bonus clicked');
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Новый бонус
        </Button>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="glass-card p-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-r from-primary/20 to-warning/20 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Всего бонусов</p>
              <p className="text-2xl font-bold">{analytics.totalBonuses}</p>
            </div>
          </div>
        </Card>
        
        <Card className="glass-card p-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-r from-success/20 to-emerald-500/20 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Выплачено</p>
              <p className="text-2xl font-bold">{analytics.paidBonuses}</p>
            </div>
          </div>
        </Card>
        
        <Card className="glass-card p-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-r from-warning/20 to-yellow-500/20 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ожидает</p>
              <p className="text-2xl font-bold">{analytics.pendingBonuses}</p>
            </div>
          </div>
        </Card>
        
        <Card className="glass-card p-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-r from-secondary/20 to-purple-500/20 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Средний KPI</p>
              <p className="text-2xl font-bold">{analytics.avgKPI}%</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Role Statistics */}
        <Card className="glass-card p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-r from-primary/20 to-warning/20 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Аналитика по ролям</h3>
              <p className="text-sm text-muted-foreground">Распределение бонусов</p>
            </div>
          </div>

          <div className="space-y-4">
            {roleStats.map((stat, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 border border-glass-border">
                <div>
                  <p className="font-medium text-sm">{stat.role}</p>
                  <p className="text-xs text-muted-foreground">{stat.count} сотрудников</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-primary">{stat.amount}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Bonuses List */}
        <Card className="glass-card lg:col-span-2">
          <div className="p-6 border-b border-glass-border">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Последние бонусы</h3>
              <div className="flex space-x-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Поиск..." 
                    className="w-64 pl-10 glass border-glass-border"
                  />
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="btn-glass"
                  onClick={() => {
                    // TODO: Implement filters functionality
                    console.log('Filters clicked');
                  }}
                >
                  <Filter className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
          
          <div className="divide-y divide-glass-border">
            {bonuses.map((bonus) => (
              <div key={bonus.id} className="p-6 hover:bg-secondary/20 transition-all duration-200">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    {/* Employee */}
                    <div className="w-12 h-12 bg-gradient-to-r from-primary to-warning rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold text-primary-foreground">{bonus.employee.avatar}</span>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <p className="font-medium">{bonus.employee.name}</p>
                        <span className="text-xs text-muted-foreground">{bonus.employee.role}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{bonus.project}</p>
                      <p className="text-xs text-muted-foreground">{bonus.description}</p>
                      
                      <div className="flex items-center space-x-4 mt-3">
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{bonus.date}</span>
                        </div>
                        <KPIIndicator value={bonus.kpi} size="sm" />
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xl font-bold text-success mb-2">{bonus.amount}</p>
                    {getStatusBadge(bonus.status)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}