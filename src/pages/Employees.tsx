import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KPIIndicator } from "@/components/KPIIndicator";
import { ProgressBar } from "@/components/ProgressBar";
import { 
  Plus, 
  Search, 
  Filter, 
  Mail,
  MapPin,
  Briefcase,
  Star,
  DollarSign
} from "lucide-react";

export default function Employees() {
  const navigate = useNavigate();
  const employees = [
    {
      id: 1,
      name: "Анна Иванова",
      email: "anna.ivanova@company.com",
      role: "👤 Партнёр",
      kpi: 95,
      bonuses: "₽125,000",
      engagement: 92,
      avatar: "AI",
      projects: [
        { name: "Аудит налогов ПАО Газпром", role: "Партнёр" },
        { name: "IT-аудит безопасности Сбербанк", role: "Консультант" }
      ],
      location: "Москва"
    },
    {
      id: 2,
      name: "Михаил Петров",
      email: "mikhail.petrov@company.com",
      role: "🧑‍💼 Руководитель проекта",
      kpi: 88,
      bonuses: "₽85,000",
      engagement: 87,
      avatar: "МП",
      projects: [
        { name: "Аудит налогов ПАО Газпром", role: "Руководитель" },
        { name: "Due Diligence ВТБ", role: "Руководитель" }
      ],
      location: "СПб"
    },
    {
      id: 3,
      name: "Елена Сидорова",
      email: "elena.sidorova@company.com",
      role: "🧱 Ассистент",
      kpi: 82,
      bonuses: "₽45,000",
      engagement: 85,
      avatar: "ЕС",
      projects: [
        { name: "Аудит ФНО Альфа-Банк", role: "Ассистент" },
        { name: "IT-аудит безопасности Сбербанк", role: "Ассистент" }
      ],
      location: "Москва"
    },
    {
      id: 4,
      name: "Дмитрий Козлов",
      email: "dmitry.kozlov@company.com",
      role: "👤 Партнёр",
      kpi: 90,
      bonuses: "₽150,000",
      engagement: 94,
      avatar: "ДК",
      projects: [
        { name: "IT-аудит безопасности Сбербанк", role: "Партнёр" }
      ],
      location: "Новосибирск"
    },
    {
      id: 5,
      name: "Ольга Морозова",
      email: "olga.morozova@company.com",
      role: "🧑‍💼 Руководитель проекта",
      kpi: 85,
      bonuses: "₽72,000",
      engagement: 89,
      avatar: "ОМ",
      projects: [
        { name: "Аудит налогов ПАО Газпром", role: "Руководитель" },
        { name: "Due Diligence ВТБ", role: "Консультант" }
      ],
      location: "Казань"
    },
    {
      id: 6,
      name: "Сергей Волков",
      email: "sergey.volkov@company.com",
      role: "🧑‍💼 Руководитель проекта",
      kpi: 79,
      bonuses: "₽68,000",
      engagement: 78,
      avatar: "СВ",
      projects: [
        { name: "Due Diligence ВТБ", role: "Руководитель" }
      ],
      location: "Екатеринбург"
    }
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-warning bg-clip-text text-transparent">
            Сотрудники
          </h1>
          <p className="text-muted-foreground mt-1">Управление командой и персоналом</p>
        </div>
        <Button 
          className="btn-gradient"
          onClick={() => {
            // TODO: Implement add employee functionality
            console.log('Add employee clicked');
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Добавить сотрудника
        </Button>
      </div>

      {/* Filters */}
      <Card className="glass-card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Поиск сотрудников..." 
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

      {/* Employees Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {employees.map((employee) => (
          <Card key={employee.id} className="glass-card p-6 hover:scale-[1.02] transition-all duration-300">
            {/* Employee Header */}
            <div className="flex items-start space-x-4 mb-4">
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-r from-primary to-warning rounded-full flex items-center justify-center">
                  <span className="text-lg font-bold text-primary-foreground">{employee.avatar}</span>
                </div>
                {employee.kpi >= 90 && (
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-warning rounded-full flex items-center justify-center">
                    <Star className="w-3 h-3 text-warning-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold">{employee.name}</h3>
                <p className="text-sm text-muted-foreground mb-1">{employee.role}</p>
                <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                  <Mail className="w-3 h-3" />
                  <span>{employee.email}</span>
                </div>
                <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-1">
                  <MapPin className="w-3 h-3" />
                  <span>{employee.location}</span>
                </div>
              </div>
            </div>

            {/* KPI */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">KPI</span>
                <KPIIndicator value={employee.kpi} size="sm" />
              </div>
            </div>

            {/* Bonuses */}
            <div className="mb-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 border border-glass-border">
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-4 h-4 text-success" />
                  <span className="text-sm text-muted-foreground">Бонусы</span>
                </div>
                <span className="font-semibold text-success">{employee.bonuses}</span>
              </div>
            </div>

            {/* Engagement */}
            <div className="mb-4">
              <ProgressBar 
                value={employee.engagement}
                variant={employee.engagement >= 90 ? "success" : employee.engagement >= 75 ? "warning" : "destructive"}
                showLabel={false}
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Вовлечённость</span>
                <span>{employee.engagement}%</span>
              </div>
            </div>

            {/* Projects */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center">
                <Briefcase className="w-4 h-4 mr-1" />
                Проекты ({employee.projects.length})
              </h4>
              <div className="space-y-2">
                {employee.projects.map((project, index) => (
                  <div key={index} className="flex items-center justify-between p-2 rounded bg-secondary/10">
                    <span className="text-sm">{project.name}</span>
                    <span className="text-xs text-muted-foreground">{project.role}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex space-x-2">
              <Button 
                size="sm" 
                className="btn-gradient flex-1"
                onClick={() => navigate(`/employees/${employee.id}`, { state: { employee } })}
              >
                Подробнее
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="btn-glass"
                onClick={() => {
                  // TODO: Implement send email functionality
                  console.log('Send email clicked:', employee.email);
                }}
              >
                <Mail className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}