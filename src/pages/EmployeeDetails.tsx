import { useMemo } from "react";
import { useLocation, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, MapPin, Briefcase, ArrowLeft, TrendingUp, DollarSign, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface Employee {
  id: number | string;
  name: string;
  email: string;
  role: string;
  avatar: string;
  location: string;
  kpi?: number;
  projects?: { name: string; role: string }[];
}

export default function EmployeeDetails() {
  const params = useParams();
  const location = useLocation();
  const state = location.state as { employee?: Employee } | null;

  const employee = useMemo<Employee | null>(() => {
    // локальный справочник демо‑данных для обогащения карточки
    const directory: Record<string, Partial<Employee>> = {
      "1": {
        email: "anna.ivanova@company.com",
        location: "Москва",
        projects: [
          { name: "Аудит налогов ПАО Газпром", role: "Партнёр" },
          { name: "IT‑аудит безопасности Сбербанк", role: "Консультант" },
        ],
      },
      "2": {
        email: "mikhail.petrov@company.com",
        location: "СПб",
        projects: [
          { name: "Due Diligence ВТБ", role: "Руководитель" },
        ],
      },
      "3": {
        email: "elena.sidorova@company.com",
        location: "Москва",
        projects: [
          { name: "Аудит ФНО Альфа‑Банк", role: "Ассистент" },
        ],
      },
      "4": {
        email: "dmitry.kozlov@company.com",
        location: "Новосибирск",
        projects: [
          { name: "IT‑аудит безопасности Сбербанк", role: "Партнёр" },
        ],
      },
      "5": {
        email: "olga.morozova@company.com",
        location: "Казань",
        projects: [
          { name: "Аудит налогов ПАО Газпром", role: "Консультант" },
        ],
      },
    };

    // если пришел объект из state — дополним его справочником по id
    if (state?.employee) {
      const idKey = String(state.employee.id);
      return { ...state.employee, ...(directory[idKey] || {}) } as Employee;
    }

    // прямой переход по URL — вернем демо по id, либо общий демо‑профиль
    if (params.id) {
      const idKey = String(params.id);
      const base: Employee = {
        id: idKey,
        name: "Демо сотрудник",
        email: "demo@company.com",
        role: "🧑‍💼 Руководитель проекта",
        avatar: "Дм",
        location: "Москва",
        kpi: 85,
        projects: [
          { name: "Демо проект A", role: "Руководитель" },
          { name: "Демо проект B", role: "Консультант" },
        ],
      };
      return { ...base, ...(directory[idKey] || {}) } as Employee;
    }
    return null;
  }, [params.id, state]);

  if (!employee) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Сотрудник не найден</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{employee.name}</h1>
          <p className="text-muted-foreground">{employee.role}</p>
        </div>
        <Button variant="outline" className="btn-glass" onClick={() => history.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Назад
        </Button>
      </div>

      <Card className="p-6 glass-card">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 bg-gradient-to-r from-primary to-warning rounded-full flex items-center justify-center">
            <span className="text-lg font-bold text-primary-foreground">{employee.avatar}</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="w-4 h-4" /> {employee.email}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4" /> {employee.location}
            </div>
            {typeof employee.kpi === 'number' && (
              <Badge variant="secondary">KPI: {employee.kpi}%</Badge>
            )}
          </div>
        </div>

        {/* mini dashboards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <Card className="p-4 glass-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Средний KPI</p>
                <p className="text-xl font-bold">{employee.kpi ?? 0}%</p>
              </div>
              <TrendingUp className="w-5 h-5 text-warning" />
            </div>
            <div className="mt-2">
              <Progress value={employee.kpi ?? 0} className="h-2" />
            </div>
          </Card>
          <Card className="p-4 glass-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Вовлечённость</p>
                <p className="text-xl font-bold">—</p>
              </div>
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div className="mt-2">
              <Progress value={70} className="h-2" />
            </div>
          </Card>
          <Card className="p-4 glass-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Бонусы (демо)</p>
                <p className="text-xl font-bold text-success">₽120,000</p>
              </div>
              <DollarSign className="w-5 h-5 text-success" />
            </div>
          </Card>
        </div>

        {employee.projects && employee.projects.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center">
              <Briefcase className="w-4 h-4 mr-1" /> Проекты ({employee.projects.length})
            </h3>
            <div className="space-y-2">
              {employee.projects.map((p, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded bg-secondary/10">
                  <span className="text-sm">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.role}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}


