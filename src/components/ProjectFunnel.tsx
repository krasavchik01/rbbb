/**
 * Воронка проектов - визуализация пути проекта по этапам
 * Для CEO чтобы видеть где застревают проекты
 */

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, AlertCircle, CheckCircle, Clock, Users } from 'lucide-react';

interface ProjectFunnelProps {
  projects: any[];
}

interface FunnelStage {
  id: string;
  name: string;
  description: string;
  count: number;
  percentage: number;
  color: string;
  icon: any;
}

export function ProjectFunnel({ projects }: ProjectFunnelProps) {
  const stages: FunnelStage[] = useMemo(() => {
    const total = projects.length;
    
    // Считаем проекты на каждом этапе
    const newProjects = projects.filter(p => p.status === 'new');
    const approvalProjects = projects.filter(p => p.status === 'approval');
    const planningProjects = projects.filter(p => p.status === 'planning');
    const inProgressProjects = projects.filter(p => p.status === 'in_progress');
    const reviewProjects = projects.filter(p => p.status === 'review');
    const completedProjects = projects.filter(p => p.status === 'completed');
    
    return [
      {
        id: 'new',
        name: 'Новые',
        description: 'Созданы отделом закупок',
        count: newProjects.length,
        percentage: total > 0 ? (newProjects.length / total) * 100 : 0,
        color: 'bg-gray-500',
        icon: AlertCircle,
      },
      {
        id: 'approval',
        name: 'На утверждении',
        description: 'Ждут назначения команды',
        count: approvalProjects.length,
        percentage: total > 0 ? (approvalProjects.length / total) * 100 : 0,
        color: 'bg-yellow-500',
        icon: Clock,
      },
      {
        id: 'planning',
        name: 'Планирование',
        description: 'Партнер распределяет задачи',
        count: planningProjects.length,
        percentage: total > 0 ? (planningProjects.length / total) * 100 : 0,
        color: 'bg-blue-500',
        icon: Users,
      },
      {
        id: 'in_progress',
        name: 'В работе',
        description: 'Команда выполняет процедуры',
        count: inProgressProjects.length,
        percentage: total > 0 ? (inProgressProjects.length / total) * 100 : 0,
        color: 'bg-purple-500',
        icon: ArrowRight,
      },
      {
        id: 'review',
        name: 'На проверке',
        description: 'Финальная проверка партнером',
        count: reviewProjects.length,
        percentage: total > 0 ? (reviewProjects.length / total) * 100 : 0,
        color: 'bg-orange-500',
        icon: AlertCircle,
      },
      {
        id: 'completed',
        name: 'Завершены',
        description: 'Успешно закрыты',
        count: completedProjects.length,
        percentage: total > 0 ? (completedProjects.length / total) * 100 : 0,
        color: 'bg-green-500',
        icon: CheckCircle,
      },
    ];
  }, [projects]);

  const totalProjects = projects.length;

  return (
    <Card className="col-span-1 md:col-span-2 lg:col-span-3">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">📊 Воронка проектов</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Путь проектов от создания до завершения
            </p>
          </div>
          <Badge variant="outline" className="text-lg">
            Всего: {totalProjects}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {stages.map((stage, index) => {
            const Icon = stage.icon;
            const widthPercentage = totalProjects > 0 ? (stage.count / totalProjects) * 100 : 0;
            
            return (
              <div key={stage.id} className="relative">
                {/* Соединительная линия */}
                {index < stages.length - 1 && (
                  <div className="absolute left-8 top-full h-4 w-0.5 bg-muted-foreground/20 z-0" />
                )}
                
                <div className="relative z-10 group">
                  <div className="flex items-center gap-4">
                    {/* Иконка этапа */}
                    <div className={`flex-shrink-0 w-16 h-16 rounded-full ${stage.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    
                    {/* Информация об этапе */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-lg">{stage.name}</h3>
                          <p className="text-sm text-muted-foreground">{stage.description}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold">{stage.count}</div>
                          <div className="text-sm text-muted-foreground">
                            {stage.percentage.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                      
                      {/* Прогресс-бар */}
                      <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${stage.color} transition-all duration-500 rounded-full`}
                          style={{ width: `${widthPercentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Предупреждение если застревают */}
                  {stage.count > 5 && stage.id !== 'completed' && (
                    <div className="mt-2 ml-20 p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <p className="text-sm text-red-500 font-medium">
                        ⚠️ Много проектов на этапе "{stage.name}" - возможно требуется внимание
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Статистика конверсии */}
        <div className="mt-6 pt-6 border-t grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-purple-500/10">
            <div className="text-sm text-muted-foreground">Коэффициент завершения</div>
            <div className="text-2xl font-bold text-green-500">
              {totalProjects > 0 ? ((stages.find(s => s.id === 'completed')?.count || 0) / totalProjects * 100).toFixed(1) : 0}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Завершено от общего числа
            </div>
          </Card>
          
          <Card className="p-4 bg-gradient-to-br from-yellow-500/10 to-orange-500/10">
            <div className="text-sm text-muted-foreground">В работе</div>
            <div className="text-2xl font-bold text-blue-500">
              {stages.filter(s => ['approval', 'planning', 'in_progress', 'review'].includes(s.id)).reduce((sum, s) => sum + s.count, 0)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Активных проектов
            </div>
          </Card>
          
          <Card className="p-4 bg-gradient-to-br from-red-500/10 to-pink-500/10">
            <div className="text-sm text-muted-foreground">Требуют действий</div>
            <div className="text-2xl font-bold text-yellow-500">
              {stages.filter(s => s.id === 'new' || s.id === 'approval').reduce((sum, s) => sum + s.count, 0)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Новые + На утверждении
            </div>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}

