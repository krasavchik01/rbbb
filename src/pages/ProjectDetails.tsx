import { useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Calendar, Users, ArrowLeft, CheckSquare, User } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface SimpleProject {
  id: string;
  name: string;
  status: string;
  completion: number;
  team: number;
  deadline: string;
  company: string;
}

export default function ProjectDetails() {
  const params = useParams();
  const location = useLocation();
  const state = location.state as { project?: SimpleProject } | null;

  const project = useMemo<SimpleProject | null>(() => {
    if (state?.project) return state.project;
    // Fallback demo data when navigated by URL
    if (params.id) {
      return {
        id: String(params.id),
        name: "Демо проект",
        status: "В работе",
        completion: 60,
        team: 3,
        deadline: new Date().toISOString(),
        company: "RB Partners IT Audit",
      };
    }
    return null;
  }, [params.id, state]);

  const [steps, setSteps] = useState(
    [
      { id: "s1", title: "Инициация проекта", done: true },
      { id: "s2", title: "Сбор требований / план работ", done: true },
      { id: "s3", title: "Формирование команды и доступов", done: true },
      { id: "s4", title: "Полевые процедуры / проверка", done: false },
      { id: "s5", title: "Подготовка отчёта / QA", done: false },
      { id: "s6", title: "Согласование с клиентом", done: false },
      { id: "s7", title: "Закрытие проекта / архив", done: false },
    ]
  );

  const [participants] = useState(
    [
      { id: "p1", name: "Анна Иванова", role: "Партнёр" },
      { id: "p2", name: "Михаил Петров", role: "Руководитель проекта" },
      { id: "p3", name: "Елена Сидорова", role: "Ассистент" },
    ]
  );

  const completionPct = useMemo(() => {
    const total = steps.length;
    const done = steps.filter(s => s.done).length;
    return Math.round((done / Math.max(total, 1)) * 100);
  }, [steps]);

  const toggleStep = (id: string) => {
    setSteps(prev => prev.map(s => (s.id === id ? { ...s, done: !s.done } : s)));
  };

  if (!project) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Проект не найден</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{project.name}</h1>
          <p className="text-muted-foreground">Компания: {project.company}</p>
        </div>
        <Button variant="outline" className="btn-glass" onClick={() => history.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Назад
        </Button>
      </div>

      <Card className="p-6 glass-card space-y-6">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{project.status}</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="w-4 h-4" /> Команда
            </div>
            <div className="text-lg font-semibold">{project.team} участников</div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" /> Дедлайн
            </div>
            <div className="text-lg font-semibold">
              {new Date(project.deadline).toLocaleDateString('ru-RU')}
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Прогресс</div>
            <Progress value={completionPct} className="h-2" />
            <div className="text-sm">{completionPct}% (по чек-листу)</div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 glass-card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Чек‑лист проекта</h3>
            </div>
            <Badge variant="secondary">Завершено: {completionPct}%</Badge>
          </div>
          <div className="space-y-3">
            {steps.map(step => (
              <div key={step.id} className="flex items-start justify-between p-3 rounded-lg border border-glass-border bg-secondary/20">
                <div className="flex items-start gap-3">
                  <Checkbox checked={step.done} onCheckedChange={() => toggleStep(step.id)} />
                  <div>
                    <p className="text-sm font-medium {step.done ? 'line-through text-muted-foreground' : ''}">{step.title}</p>
                  </div>
                </div>
                {step.done && <Badge className="bg-success/20 text-success">Готово</Badge>}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 glass-card">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">Участники</h3>
          </div>
          <div className="space-y-3">
            {participants.map(p => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded bg-secondary/20">
                <Avatar className="w-8 h-8">
                  <AvatarFallback>{p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.role}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}


