import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useProjects } from '@/hooks/useProjects-simple';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Briefcase,
  User,
  AlertCircle
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, getDay } from 'date-fns';
import { ru } from 'date-fns/locale';

export default function Calendar() {
  const { user } = useAuth();
  const { projects = [] } = useProjects();
  const [currentDate, setCurrentDate] = useState(new Date());

  // События из проектов
  const events = useMemo(() => {
    const eventsList: Array<{
      id: string;
      title: string;
      date: Date;
      type: 'deadline' | 'start' | 'milestone';
      projectId: string;
      projectName: string;
    }> = [];

    projects.forEach((project: any) => {
      if (project.deadline) {
        eventsList.push({
          id: `${project.id}-deadline`,
          title: `Дедлайн: ${project.name || project.title}`,
          date: new Date(project.deadline),
          type: 'deadline',
          projectId: project.id,
          projectName: project.name || project.title || 'Без названия'
        });
      }
      if (project.start_date) {
        eventsList.push({
          id: `${project.id}-start`,
          title: `Старт: ${project.name || project.title}`,
          date: new Date(project.start_date),
          type: 'start',
          projectId: project.id,
          projectName: project.name || project.title || 'Без названия'
        });
      }
    });

    return eventsList;
  }, [projects]);

  // Дни месяца
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // События для конкретного дня
  const getEventsForDay = (day: Date) => {
    return events.filter(event => isSameDay(event.date, day));
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'deadline':
        return 'bg-red-500';
      case 'start':
        return 'bg-green-500';
      case 'milestone':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  // Начало недели (понедельник)
  const firstDayOfWeek = getDay(monthStart) === 0 ? 6 : getDay(monthStart) - 1;
  const emptyDays = Array(firstDayOfWeek).fill(null);

  // Предстоящие события
  const upcomingEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return events
      .filter(event => event.date >= today)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 10);
  }, [events]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
      <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <CalendarIcon className="w-8 h-8" />
            Календарь
          </h1>
          <p className="text-muted-foreground mt-2">Календарь событий и задач</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => setCurrentDate(new Date())}
          >
            Сегодня
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Календарь */}
        <div className="lg:col-span-2">
          <Card className="p-4">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-center">
                {format(currentDate, 'MMMM yyyy', { locale: ru })}
              </h2>
            </div>

            {/* Дни недели */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map((day, index) => (
                <div key={index} className="text-center text-sm font-medium text-muted-foreground p-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Календарная сетка */}
            <div className="grid grid-cols-7 gap-1">
              {emptyDays.map((_, index) => (
                <div key={`empty-${index}`} className="aspect-square" />
              ))}
              {daysInMonth.map((day) => {
                const dayEvents = getEventsForDay(day);
                const isToday = isSameDay(day, new Date());
                
                return (
                  <div
                    key={day.toISOString()}
                    className={`aspect-square border rounded p-1 ${
                      isToday ? 'bg-primary/10 border-primary' : 'border-border'
                    } ${!isSameMonth(day, currentDate) ? 'opacity-50' : ''}`}
                  >
                    <div className="text-sm font-medium mb-1">
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 2).map((event) => (
                        <div
                          key={event.id}
                          className={`text-xs p-0.5 rounded truncate ${getEventColor(event.type)} text-white`}
                          title={event.title}
                        >
                          {event.type === 'deadline' ? '⏰' : event.type === 'start' ? '🚀' : '📌'}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-xs text-muted-foreground">
                          +{dayEvents.length - 2}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Предстоящие события */}
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Предстоящие события
            </h3>
            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Нет предстоящих событий</p>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.map((event) => (
                  <div
                    key={event.id}
                    className="p-3 border rounded-lg hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{event.projectName}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(event.date, 'dd MMMM yyyy', { locale: ru })}
                        </p>
                      </div>
                      <Badge className={getEventColor(event.type)}>
                        {event.type === 'deadline' ? 'Дедлайн' : event.type === 'start' ? 'Старт' : 'Этап'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{format(event.date, 'HH:mm')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Статистика */}
          <Card className="p-4">
            <h3 className="font-semibold mb-4">Статистика</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Событий в этом месяце</span>
                <span className="font-medium">
                  {events.filter(e => isSameMonth(e.date, currentDate)).length}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Дедлайнов</span>
                <span className="font-medium text-red-500">
                  {events.filter(e => e.type === 'deadline' && isSameMonth(e.date, currentDate)).length}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Стартов проектов</span>
                <span className="font-medium text-green-500">
                  {events.filter(e => e.type === 'start' && isSameMonth(e.date, currentDate)).length}
                </span>
              </div>
            </div>
      </Card>
        </div>
      </div>
    </div>
  );
}
