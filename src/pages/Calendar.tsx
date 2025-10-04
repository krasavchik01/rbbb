import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Calendar as CalendarIcon, Plus, Edit, Trash2, Clock, MapPin, Users } from "lucide-react";
import { format, startOfWeek, addDays, subMonths, addMonths, isSameMonth, isSameDay, parseISO, addHours } from "date-fns";
import { ru } from "date-fns/locale";

interface Event {
  id: string;
  title: string;
  description?: string;
  date: string; // ISO string
  time: string; // HH:mm format
  type: "project" | "deadline" | "meeting" | "personal" | "holiday";
  location?: string;
  participants?: string[];
  isAllDay?: boolean;
}

const eventTypeColors = {
  project: "bg-green-500/20 text-green-400 border-green-500/30",
  deadline: "bg-red-500/20 text-red-400 border-red-500/30",
  meeting: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  personal: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  holiday: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

const eventTypeLabels = {
  project: "Проект",
  deadline: "Дедлайн",
  meeting: "Встреча",
  personal: "Личное",
  holiday: "Праздник",
};

export default function Calendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<Event[]>([]);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Demo events
  useEffect(() => {
    const demoEvents: Event[] = [
      {
        id: "1",
        title: "Аудит налогов ПАО Газпром",
        description: "Проведение комплексного налогового аудита",
        date: "2025-12-15T10:00:00",
        time: "10:00",
        type: "deadline",
        location: "Офис ПАО Газпром",
        participants: ["Иван Петров", "Мария Сидорова"],
      },
      {
        id: "2",
        title: "Встреча по проекту 'Развитие'",
        description: "Планирование следующего этапа проекта",
        date: "2025-12-18T14:00:00",
        time: "14:00",
        type: "meeting",
        location: "Конференц-зал",
        participants: ["Алексей Козлов", "Елена Морозова"],
      },
      {
        id: "3",
        title: "Запуск нового проекта 'Альфа'",
        description: "Презентация и запуск нового проекта",
        date: "2025-12-22T09:00:00",
        time: "09:00",
        type: "project",
        location: "Главный офис",
        participants: ["Вся команда"],
      },
      {
        id: "4",
        title: "IT-аудит безопасности Сбербанк",
        description: "Проверка систем безопасности",
        date: "2025-12-20T11:00:00",
        time: "11:00",
        type: "deadline",
        location: "ЦОД Сбербанк",
        participants: ["IT-отдел"],
      },
      {
        id: "5",
        title: "Ежемесячный отчет",
        description: "Подготовка и презентация месячного отчета",
        date: "2025-12-03T16:00:00",
        time: "16:00",
        type: "meeting",
        location: "Переговорная 1",
        participants: ["Руководство"],
      },
      {
        id: "6",
        title: "Планирование Q1 2026",
        description: "Стратегическое планирование на первый квартал",
        date: "2026-01-05T10:00:00",
        time: "10:00",
        type: "meeting",
        location: "Конференц-зал",
        participants: ["Топ-менеджмент"],
      },
      {
        id: "7",
        title: "Новогодние каникулы",
        description: "Официальные выходные дни",
        date: "2025-12-31T00:00:00",
        time: "00:00",
        type: "holiday",
        isAllDay: true,
      },
    ];
    setEvents(demoEvents);
  }, []);

  const headerFormat = "MMMM yyyy";
  const dateFormat = "d";
  const daysOfWeekFormat = "EE";

  const days = [];
  const startDate = startOfWeek(currentMonth, { locale: ru });

  for (let i = 0; i < 42; i++) {
    days.push(addDays(startDate, i));
  }

  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const prevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const getEventsForDay = (day: Date) => {
    return events.filter(event => {
      const eventDate = parseISO(event.date);
      return isSameDay(eventDate, day);
    });
  };

  const filteredEvents = events.filter(event => {
    const matchesType = filterType === "all" || event.type === filterType;
    const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         event.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const getEventsForSelectedDate = () => {
    return filteredEvents.filter(event => isSameDay(parseISO(event.date), selectedDate));
  };

  const handleCreateEvent = () => {
    setEditingEvent(null);
    setIsEventDialogOpen(true);
  };

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    setIsEventDialogOpen(true);
  };

  const handleDeleteEvent = (eventId: string) => {
    setEvents(prev => prev.filter(e => e.id !== eventId));
  };

  const handleSaveEvent = (eventData: Omit<Event, 'id'>) => {
    if (editingEvent) {
      setEvents(prev => prev.map(e => e.id === editingEvent.id ? { ...eventData, id: editingEvent.id } : e));
    } else {
      const newEvent: Event = {
        ...eventData,
        id: Date.now().toString(),
      };
      setEvents(prev => [...prev, newEvent]);
    }
    setIsEventDialogOpen(false);
    setEditingEvent(null);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center space-x-3">
          <CalendarIcon className="w-8 h-8 text-primary" />
          <span>Календарь</span>
        </h1>
        <Button onClick={handleCreateEvent} className="btn-gradient">
          <Plus className="w-4 h-4 mr-2" />
          Добавить событие
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium">Тип события:</label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все</SelectItem>
                <SelectItem value="project">Проекты</SelectItem>
                <SelectItem value="deadline">Дедлайны</SelectItem>
                <SelectItem value="meeting">Встречи</SelectItem>
                <SelectItem value="personal">Личные</SelectItem>
                <SelectItem value="holiday">Праздники</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium">Поиск:</label>
            <Input
              placeholder="Поиск событий..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-60"
            />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2">
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <Button variant="ghost" onClick={prevMonth}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h2 className="text-xl font-semibold">
                {format(currentMonth, headerFormat, { locale: ru })}
              </h2>
              <Button variant="ghost" onClick={nextMonth}>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid grid-cols-7 text-center text-muted-foreground font-medium mb-2">
              {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day, index) => (
                <div key={index}>{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {days.map((day, index) => (
                <div
                  key={index}
                  className={`p-2 h-24 flex flex-col items-center justify-start rounded-md transition-colors duration-200
                    ${!isSameMonth(day, currentMonth) ? "text-muted-foreground opacity-50" : ""}
                    ${isSameDay(day, selectedDate) ? "bg-primary/20" : "hover:bg-secondary/30"}
                    ${isSameDay(day, new Date()) ? "border border-primary" : ""}
                    cursor-pointer
                  `}
                  onClick={() => setSelectedDate(day)}
                >
                  <span className="font-semibold text-lg">{format(day, dateFormat, { locale: ru })}</span>
                  <div className="mt-1 space-y-0.5 overflow-hidden w-full">
                    {getEventsForDay(day).slice(0, 2).map(event => (
                      <div
                        key={event.id}
                        className={`text-xs px-1 py-0.5 rounded-sm truncate border
                          ${eventTypeColors[event.type]}
                        `}
                        title={event.title}
                      >
                        {event.title}
                      </div>
                    ))}
                    {getEventsForDay(day).length > 2 && (
                      <div className="text-xs text-muted-foreground">
                        +{getEventsForDay(day).length - 2} еще
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Events for selected date */}
        <div className="space-y-4">
          <Card className="p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center">
              <CalendarIcon className="w-5 h-5 mr-2" />
              События на {format(selectedDate, "d MMMM yyyy", { locale: ru })}
            </h3>
            {getEventsForSelectedDate().length > 0 ? (
              <div className="space-y-3">
                {getEventsForSelectedDate().map(event => (
                  <div key={event.id} className="p-3 rounded-lg border bg-card">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <Badge variant="outline" className={eventTypeColors[event.type]}>
                            {eventTypeLabels[event.type]}
                          </Badge>
                          {!event.isAllDay && (
                            <div className="flex items-center text-sm text-muted-foreground">
                              <Clock className="w-3 h-3 mr-1" />
                              {event.time}
                            </div>
                          )}
                        </div>
                        <h4 className="font-medium">{event.title}</h4>
                        {event.description && (
                          <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                        )}
                        {event.location && (
                          <div className="flex items-center text-sm text-muted-foreground mt-1">
                            <MapPin className="w-3 h-3 mr-1" />
                            {event.location}
                          </div>
                        )}
                        {event.participants && event.participants.length > 0 && (
                          <div className="flex items-center text-sm text-muted-foreground mt-1">
                            <Users className="w-3 h-3 mr-1" />
                            {event.participants.join(", ")}
                          </div>
                        )}
                      </div>
                      <div className="flex space-x-1 ml-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditEvent(event)}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteEvent(event.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">На этот день событий нет.</p>
            )}
          </Card>
        </div>
      </div>

      {/* Event Dialog */}
      <EventDialog
        isOpen={isEventDialogOpen}
        onClose={() => {
          setIsEventDialogOpen(false);
          setEditingEvent(null);
        }}
        onSave={handleSaveEvent}
        event={editingEvent}
      />
    </div>
  );
}

interface EventDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: Omit<Event, 'id'>) => void;
  event?: Event | null;
}

function EventDialog({ isOpen, onClose, onSave, event }: EventDialogProps) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    date: "",
    time: "",
    type: "meeting" as Event['type'],
    location: "",
    participants: "",
    isAllDay: false,
  });

  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title,
        description: event.description || "",
        date: event.date.split('T')[0],
        time: event.time,
        type: event.type,
        location: event.location || "",
        participants: event.participants?.join(", ") || "",
        isAllDay: event.isAllDay || false,
      });
    } else {
      setFormData({
        title: "",
        description: "",
        date: "",
        time: "",
        type: "meeting",
        location: "",
        participants: "",
        isAllDay: false,
      });
    }
  }, [event, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const eventData: Omit<Event, 'id'> = {
      title: formData.title,
      description: formData.description,
      date: `${formData.date}T${formData.time}:00`,
      time: formData.time,
      type: formData.type,
      location: formData.location,
      participants: formData.participants ? formData.participants.split(',').map(p => p.trim()) : [],
      isAllDay: formData.isAllDay,
    };
    onSave(eventData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {event ? "Редактировать событие" : "Создать событие"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Название *</label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Тип события</label>
              <Select value={formData.type} onValueChange={(value) => setFormData(prev => ({ ...prev, type: value as Event['type'] }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="project">Проект</SelectItem>
                  <SelectItem value="deadline">Дедлайн</SelectItem>
                  <SelectItem value="meeting">Встреча</SelectItem>
                  <SelectItem value="personal">Личное</SelectItem>
                  <SelectItem value="holiday">Праздник</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Описание</label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Дата *</label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Время</label>
              <Input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                disabled={formData.isAllDay}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isAllDay"
              checked={formData.isAllDay}
              onChange={(e) => setFormData(prev => ({ ...prev, isAllDay: e.target.checked }))}
              className="rounded"
            />
            <label htmlFor="isAllDay" className="text-sm font-medium">Весь день</label>
          </div>

          <div>
            <label className="text-sm font-medium">Место проведения</label>
            <Input
              value={formData.location}
              onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Участники</label>
            <Input
              value={formData.participants}
              onChange={(e) => setFormData(prev => ({ ...prev, participants: e.target.value }))}
              placeholder="Иван Петров, Мария Сидорова"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Разделите имена запятыми
            </p>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Отмена
            </Button>
            <Button type="submit" className="btn-gradient">
              {event ? "Сохранить" : "Создать"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}



