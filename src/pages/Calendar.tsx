import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useProjects } from '@/hooks/useSupabaseData';
import { useAuth } from '@/contexts/AuthContext';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Briefcase,
  User,
  AlertCircle,
  Loader2,
  X
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, getDay } from 'date-fns';
import { ru } from 'date-fns/locale';

export default function Calendar() {
  const { user } = useAuth();
  const { projects = [], loading } = useProjects();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // События из проектов
  const events = useMemo(() => {
    const eventsList: Array<{
      id: string;
      title: string;
      date: Date;
      type: 'deadline' | 'start' | 'milestone';
      projectId: string;
      projectName: string;
      status?: string;
    }> = [];

    projects.forEach((project: any) => {
      const projectId = project.id || project.notes?.id;
      const projectName = project.name || project.notes?.name || project.title || 'Без названия';
      const projectStatus = project.status || project.notes?.status;

      // Проверяем deadline (может быть в разных местах)
      const deadline = project.deadline || project.notes?.deadline;
      if (deadline) {
        try {
          const deadlineDate = new Date(deadline);
          if (!isNaN(deadlineDate.getTime())) {
            eventsList.push({
              id: `${projectId}-deadline`,
              title: `Дедлайн: ${projectName}`,
              date: deadlineDate,
              type: 'deadline',
              projectId: projectId,
              projectName: projectName,
              status: projectStatus
            });
          }
        } catch (e) {
          console.log('Invalid deadline date:', deadline);
        }
      }

      // Проверяем start_date (может быть в разных местах)
      const startDate = project.start_date || project.notes?.startDate || project.notes?.createdAt;
      if (startDate) {
        try {
          const startDateObj = new Date(startDate);
          if (!isNaN(startDateObj.getTime())) {
            eventsList.push({
              id: `${projectId}-start`,
              title: `Старт: ${projectName}`,
              date: startDateObj,
              type: 'start',
              projectId: projectId,
              projectName: projectName,
              status: projectStatus
            });
          }
        } catch (e) {
          console.log('Invalid start_date:', startDate);
        }
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
    <div className="space-y-4 sm:space-y-6 page-enter">

      {/* Заголовок */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center">
              <CalendarIcon className="w-5 h-5 text-blue-500" />
            </span>
            Календарь
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {format(currentDate, 'MMMM yyyy', { locale: ru })} · {events.filter(e => isSameMonth(e.date, currentDate)).length} событий
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" className="px-4" onClick={() => setCurrentDate(new Date())}>
            Сегодня
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Календарь */}
        <div className="lg:col-span-2">
          <Card className="p-3 sm:p-4 border-0 shadow-sm">
            <div className="mb-3 flex items-center justify-center gap-2">
              <h2 className="text-base font-semibold capitalize">
                {format(currentDate, 'MMMM yyyy', { locale: ru })}
              </h2>
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
            </div>

            {/* Дни недели */}
            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {weekDays.map((day, index) => (
                <div key={index} className={`text-center text-xs font-semibold py-1.5 ${index >= 5 ? 'text-primary/60' : 'text-muted-foreground'}`}>
                  {day}
                </div>
              ))}
            </div>

            {/* Календарная сетка */}
            <div className="grid grid-cols-7 gap-0.5">
              {emptyDays.map((_, index) => (
                <div key={`empty-${index}`} className="aspect-square" />
              ))}
              {daysInMonth.map((day) => {
                const dayEvents = getEventsForDay(day);
                const isToday = isSameDay(day, new Date());
                const isSelected = selectedDay && isSameDay(day, selectedDay);
                const hasDeadline = dayEvents.some(e => e.type === 'deadline');
                const hasStart = dayEvents.some(e => e.type === 'start');

                return (
                  <div
                    key={day.toISOString()}
                    onClick={() => setSelectedDay(dayEvents.length > 0 ? day : null)}
                    className={`aspect-square rounded-lg p-0.5 sm:p-1 flex flex-col cursor-pointer transition-all duration-150 ${
                      isSelected ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1' :
                      isToday ? 'bg-primary/15 ring-1 ring-primary/40' :
                      dayEvents.length > 0 ? 'hover:bg-muted/60 bg-muted/20' : 'hover:bg-muted/40'
                    } ${!isSameMonth(day, currentDate) ? 'opacity-30' : ''}`}
                  >
                    <div className={`text-xs sm:text-sm font-semibold text-center leading-tight ${isToday && !isSelected ? 'text-primary' : ''}`}>
                      {format(day, 'd')}
                    </div>
                    {dayEvents.length > 0 && (
                      <div className="flex gap-0.5 justify-center mt-auto flex-wrap">
                        {hasDeadline && <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-primary-foreground' : 'bg-red-500'}`} />}
                        {hasStart && <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-primary-foreground' : 'bg-green-500'}`} />}
                        {dayEvents.some(e => e.type === 'milestone') && <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-primary-foreground' : 'bg-blue-500'}`} />}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Легенда */}
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" />Дедлайн</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" />Старт</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" />Этап</span>
            </div>

            {/* Детали выбранного дня */}
            {selectedDay && (
              <div className="mt-4 p-3 rounded-xl bg-muted/40 border border-border/50">
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="font-semibold text-sm capitalize">
                    {format(selectedDay, 'dd MMMM yyyy', { locale: ru })}
                  </h3>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedDay(null)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {getEventsForDay(selectedDay).map((event) => (
                    <div key={event.id} className="p-2.5 rounded-lg bg-background border border-border/50">
                      <div className="flex items-center gap-2">
                        <Badge className={`${getEventColor(event.type)} text-xs`}>
                          {event.type === 'deadline' ? 'Дедлайн' : event.type === 'start' ? 'Старт' : 'Этап'}
                        </Badge>
                        <span className="font-medium text-sm truncate">{event.projectName}</span>
                      </div>
                      {event.status && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {event.status === 'approved' ? 'Утверждён' :
                           event.status === 'pending' ? 'Ожидает' :
                           event.status === 'in_progress' ? 'В работе' :
                           event.status === 'completed' ? 'Завершён' : event.status}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Предстоящие события */}
        <div className="space-y-4">
          <Card className="p-4 border-0 shadow-sm">
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
              <span className="w-7 h-7 rounded-lg bg-orange-500/15 flex items-center justify-center">
                <AlertCircle className="w-3.5 h-3.5 text-orange-500" />
              </span>
              Предстоящие события
            </h3>
            {upcomingEvents.length === 0 ? (
              <div className="py-6 text-center">
                <div className="w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center mx-auto mb-2">
                  <CalendarIcon className="w-5 h-5 text-muted-foreground/40" />
                </div>
                <p className="text-xs text-muted-foreground">Нет предстоящих событий</p>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingEvents.map((event) => (
                  <div
                    key={event.id}
                    className="p-2.5 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        event.type === 'deadline' ? 'bg-red-500/15' :
                        event.type === 'start' ? 'bg-green-500/15' : 'bg-blue-500/15'
                      }`}>
                        <div className={`w-2 h-2 rounded-full ${
                          event.type === 'deadline' ? 'bg-red-500' :
                          event.type === 'start' ? 'bg-green-500' : 'bg-blue-500'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs truncate">{event.projectName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(event.date, 'dd MMM', { locale: ru })}
                          <span className="mx-1 opacity-40">·</span>
                          <span className={
                            event.type === 'deadline' ? 'text-red-500' :
                            event.type === 'start' ? 'text-green-600' : 'text-blue-500'
                          }>
                            {event.type === 'deadline' ? 'Дедлайн' : event.type === 'start' ? 'Старт' : 'Этап'}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Статистика */}
          <Card className="p-4 border-0 shadow-sm">
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
              <span className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
                <Briefcase className="w-3.5 h-3.5 text-blue-500" />
              </span>
              {format(currentDate, 'MMMM', { locale: ru })}
            </h3>
            <div className="space-y-2">
              {[
                { label: 'Всего событий', value: events.filter(e => isSameMonth(e.date, currentDate)).length, color: 'text-foreground' },
                { label: 'Дедлайнов', value: events.filter(e => e.type === 'deadline' && isSameMonth(e.date, currentDate)).length, color: 'text-red-500' },
                { label: 'Стартов', value: events.filter(e => e.type === 'start' && isSameMonth(e.date, currentDate)).length, color: 'text-green-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className={`text-sm font-bold ${color}`}>{value}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
