import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Bell, Check, Trash2, Search } from "lucide-react";

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  date: string;
  type: "info" | "warning" | "urgent";
  read: boolean;
}

export default function Notifications() {
  const [query, setQuery] = useState("");
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: "1",
      title: "Аудит налогов ПАО Газпром",
      description: "Срок сдачи через 2 дня",
      date: "15 дек",
      type: "urgent",
      read: false,
    },
    {
      id: "2",
      title: "Обновление проекта IT-аудит Сбербанк",
      description: "Добавлены новые задачи в спринт",
      date: "14 дек",
      type: "info",
      read: false,
    },
    {
      id: "3",
      title: "Отпуск сотрудника",
      description: "Елена Сидорова будет отсутствовать 25-28 дек",
      date: "13 дек",
      type: "warning",
      read: true,
    },
  ]);

  const filtered = notifications.filter(n =>
    [n.title, n.description].join(" ").toLowerCase().includes(query.toLowerCase())
  );

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearRead = () => {
    setNotifications(prev => prev.filter(n => !n.read));
  };

  const toggleRead = (id: string) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: !n.read } : n)));
  };

  const typeBadge = (type: NotificationItem["type"]) => {
    switch (type) {
      case "urgent":
        return <Badge variant="secondary" className="text-destructive">Критично</Badge>;
      case "warning":
        return <Badge variant="secondary" className="text-warning">Важно</Badge>;
      default:
        return <Badge variant="secondary">Инфо</Badge>;
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Уведомления
          </h1>
          <p className="text-muted-foreground mt-1">Все события и напоминания по проектам</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={markAllRead} className="btn-glass">
            <Check className="w-4 h-4 mr-2" /> Отметить все прочитанными
          </Button>
          <Button variant="outline" onClick={clearRead} className="btn-glass">
            <Trash2 className="w-4 h-4 mr-2" /> Очистить прочитанные
          </Button>
        </div>
      </div>

      <Card className="glass-card">
        <div className="p-4 border-b border-glass-border flex items-center gap-3">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Поиск уведомлений..."
              className="pl-10"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="divide-y divide-glass-border">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Нет уведомлений</div>
          ) : (
            filtered.map((n) => (
              <div key={n.id} className="p-4 hover:bg-secondary/20 transition-all duration-200">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-primary to-warning rounded-full flex items-center justify-center">
                      <Bell className="w-4 h-4 text-primary-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{n.title}</p>
                        {typeBadge(n.type)}
                        {!n.read && <Badge className="bg-primary/20 text-primary">Новое</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{n.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">{n.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="btn-glass" onClick={() => toggleRead(n.id)}>
                      <Check className="w-4 h-4 mr-1" /> {n.read ? "Сделать непрочитанным" : "Прочитано"}
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}





