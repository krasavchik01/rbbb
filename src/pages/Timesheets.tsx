import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Search, 
  Filter, 
  Clock,
  Calendar,
  User,
  Send,
  Edit,
  CheckCircle
} from "lucide-react";

export default function Timesheets() {
  const timesheets = [
    {
      id: 1,
      employee: { name: "Анна Иванова", avatar: "AI" },
      project: "Аудит налогов ПАО Газпром",
      date: "14 дек 2024",
      hours: 8,
      workType: "Налоговое консультирование",
      status: "approved" as const,
      description: "Анализ налоговых деклараций и документов"
    },
    {
      id: 2,
      employee: { name: "Михаил Петров", avatar: "МП" },
      project: "IT-аудит безопасности Сбербанк",
      date: "14 дек 2024",
      hours: 6,
      workType: "IT-аудит",
      status: "pending" as const,
      description: "Тестирование систем информационной безопасности"
    },
    {
      id: 3,
      employee: { name: "Елена Сидорова", avatar: "ЕС" },
      project: "Аудит ФНО Альфа-Банк",
      date: "13 дек 2024",
      hours: 7,
      workType: "Аудит ФНО",
      status: "approved" as const,
      description: "Проверка справедливой стоимости финансовых инструментов"
    },
    {
      id: 4,
      employee: { name: "Дмитрий Козлов", avatar: "ДК" },
      project: "Due Diligence ВТБ",
      date: "13 дек 2024",
      hours: 5,
      workType: "Due Diligence",
      status: "draft" as const,
      description: "Анализ финансового состояния и активов компании"
    },
    {
      id: 5,
      employee: { name: "Ольга Морозова", avatar: "ОМ" },
      project: "Аудит налогов ПАО Газпром",
      date: "12 дек 2024",
      hours: 8,
      workType: "Управление проектом",
      status: "approved" as const,
      description: "Координация работы команды налоговых консультантов"
    },
    {
      id: 6,
      employee: { name: "Сергей Волков", avatar: "СВ" },
      project: "Due Diligence ВТБ",
      date: "12 дек 2024",
      hours: 9,
      workType: "Финансовый анализ",
      status: "pending" as const,
      description: "Подготовка финансовой модели и анализ рисков"
    }
  ];

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      approved: { text: "Утверждено", variant: "default" as const },
      pending: { text: "На проверке", variant: "secondary" as const },
      draft: { text: "Черновик", variant: "secondary" as const }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    
    return (
      <Badge 
        variant={config.variant}
        className={`
          ${status === 'approved' ? 'bg-success/20 text-success border-success/30' : ''}
          ${status === 'pending' ? 'bg-warning/20 text-warning border-warning/30' : ''}
          ${status === 'draft' ? 'bg-secondary/20 text-secondary-foreground border-secondary/30' : ''}
        `}
      >
        {config.text}
      </Badge>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-warning bg-clip-text text-transparent">
            Тайм-щиты
          </h1>
          <p className="text-muted-foreground mt-1">Учёт рабочего времени сотрудников</p>
        </div>
        <Button 
          className="btn-gradient"
          onClick={() => {
            // TODO: Implement create timesheet functionality
            console.log('Create timesheet clicked');
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Новый тайм-щит
        </Button>
      </div>

      {/* Filters */}
      <Card className="glass-card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Поиск по сотруднику или проекту..." 
              className="pl-10 glass border-glass-border"
            />
          </div>
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
        </div>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="glass-card p-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-primary/20 to-warning/20 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Всего часов</p>
              <p className="text-xl font-bold">236</p>
            </div>
          </div>
        </Card>
        
        <Card className="glass-card p-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-success/20 to-emerald-500/20 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Утверждено</p>
              <p className="text-xl font-bold">189</p>
            </div>
          </div>
        </Card>
        
        <Card className="glass-card p-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-warning/20 to-yellow-500/20 rounded-lg flex items-center justify-center">
              <Send className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">На проверке</p>
              <p className="text-xl font-bold">32</p>
            </div>
          </div>
        </Card>
        
        <Card className="glass-card p-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-secondary/20 to-gray-500/20 rounded-lg flex items-center justify-center">
              <Edit className="w-5 h-5 text-secondary-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Черновики</p>
              <p className="text-xl font-bold">15</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Timesheets List */}
      <Card className="glass-card">
        <div className="p-6 border-b border-glass-border">
          <h3 className="text-lg font-semibold">Последние записи</h3>
        </div>
        
        <div className="divide-y divide-glass-border">
          {timesheets.map((timesheet) => (
            <div key={timesheet.id} className="p-6 hover:bg-secondary/20 transition-all duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {/* Employee */}
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-primary to-warning rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold text-primary-foreground">{timesheet.employee.avatar}</span>
                    </div>
                    <div>
                      <p className="font-medium">{timesheet.employee.name}</p>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        <span>{timesheet.date}</span>
                      </div>
                    </div>
                  </div>

                  {/* Project & Work Type */}
                  <div className="hidden md:block">
                    <p className="font-medium text-sm">{timesheet.project}</p>
                    <p className="text-sm text-muted-foreground">{timesheet.workType}</p>
                  </div>

                  {/* Description */}
                  <div className="hidden lg:block max-w-xs">
                    <p className="text-sm text-muted-foreground truncate">{timesheet.description}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  {/* Hours */}
                  <div className="text-center">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="font-semibold">{timesheet.hours}ч</span>
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    {getStatusBadge(timesheet.status)}
                  </div>

                  {/* Actions */}
                  <div className="flex space-x-2">
                    {timesheet.status === "draft" && (
                      <Button 
                        size="sm" 
                        className="btn-gradient"
                        onClick={() => {
                          // TODO: Implement send timesheet functionality
                          console.log('Send timesheet clicked:', timesheet.id);
                        }}
                      >
                        <Send className="w-4 h-4 mr-1" />
                        Отправить
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="btn-glass"
                      onClick={() => {
                        // TODO: Implement edit timesheet functionality
                        console.log('Edit timesheet clicked:', timesheet.id);
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Mobile Project Info */}
              <div className="md:hidden mt-3 pt-3 border-t border-glass-border">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium text-sm">{timesheet.project}</p>
                    <p className="text-sm text-muted-foreground">{timesheet.workType}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2">{timesheet.description}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}