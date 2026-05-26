import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployees } from '@/hooks/useSupabaseData';
import { Calendar, Clock, MapPin, Users, Building2, Briefcase, Home, Plane, Heart, Navigation, Activity } from 'lucide-react';
import { useAppSettings } from '@/lib/appSettings';
import { supabase } from '@/integrations/supabase/client';
import { CheckInWidget } from '@/components/CheckInWidget';
import { WidgetErrorBoundary } from '@/components/WidgetErrorBoundary';

// Расширенные статусы посещаемости
type AttendanceStatus = 'in_office' | 'on_project' | 'remote' | 'vacation' | 'sick_leave' | 'day_off';

interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  checkIn: string;
  checkOut?: string;
  location: string;
  status: AttendanceStatus;
  date: string;
  coordinates?: { lat: number; lng: number };
}

// Настройки геолокации офиса
interface OfficeLocation {
  name: string;
  lat: number;
  lng: number;
  radius: number; // метры
}

const STATUS_LABELS: Record<AttendanceStatus, { label: string; icon: React.ReactNode; color: string }> = {
  in_office: { label: 'В офисе', icon: <Building2 className="w-4 h-4" />, color: 'bg-green-500' },
  on_project: { label: 'На проекте', icon: <Briefcase className="w-4 h-4" />, color: 'bg-blue-500' },
  remote: { label: 'Удалённо', icon: <Home className="w-4 h-4" />, color: 'bg-purple-500' },
  vacation: { label: 'В отпуске', icon: <Plane className="w-4 h-4" />, color: 'bg-orange-500' },
  sick_leave: { label: 'На больничном', icon: <Heart className="w-4 h-4" />, color: 'bg-red-500' },
  day_off: { label: 'Выходной', icon: <Calendar className="w-4 h-4" />, color: 'bg-gray-500' },
};

export default function Attendance() {
  const { user } = useAuth();
  const { employees = [] } = useEmployees();
  const [appSettings] = useAppSettings();
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [filterStatus, setFilterStatus] = useState<AttendanceStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Настройки геолокации офиса - БЕРЁМ ИЗ ГЛОБАЛЬНЫХ НАСТРОЕК
  const officeLocations: OfficeLocation[] = useMemo(() => {
    // Если координаты из глобальных настроек заданы
    if (appSettings.officeLocation.latitude && appSettings.officeLocation.longitude) {
      return [{
        name: appSettings.officeLocation.address || 'Главный офис',
        lat: appSettings.officeLocation.latitude,
        lng: appSettings.officeLocation.longitude,
        radius: appSettings.officeLocation.radiusMeters,
      }];
    }
    // Фоллбэк на дефолтные координаты
    return [{ name: 'Главный офис', lat: 43.238949, lng: 76.945465, radius: 100 }];
  }, [appSettings]);

  // Загружаем записи посещений из Supabase
  useEffect(() => {
    async function loadAttendance() {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .order('date', { ascending: false })
        .order('check_in', { ascending: false });

      if (error) {
        console.error('Error loading attendance:', error);
        return;
      }

      // Маппим данные из Supabase в формат компонента
      const records: AttendanceRecord[] = (data || []).map((row: any) => {
        const employee = employees.find((emp: any) => emp.id === row.employee_id);
        // Маппим location_type из БД в наши статусы
        const statusMap: Record<string, AttendanceStatus> = {
          'office': 'in_office',
          'remote': 'remote',
          'client': 'on_project',
          'trip': 'on_project',
        };
        const dbStatus = row.status; // present, late, absent, vacation, sick_leave
        let status: AttendanceStatus;
        if (dbStatus === 'vacation') status = 'vacation';
        else if (dbStatus === 'sick_leave') status = 'sick_leave';
        else status = statusMap[row.location_type] || 'in_office';

        const locationLabels: Record<string, string> = {
          'office': 'В офисе',
          'remote': 'Удалённо',
          'client': 'У клиента',
          'trip': 'Командировка',
        };

        return {
          id: row.id,
          employeeId: row.employee_id,
          employeeName: employee?.name || 'Неизвестный сотрудник',
          checkIn: row.check_in || '',
          checkOut: row.check_out || undefined,
          location: locationLabels[row.location_type] || row.location_type || '',
          status,
          date: new Date(row.date).toDateString(),
          coordinates: row.check_in_lat && row.check_in_lng
            ? { lat: Number(row.check_in_lat), lng: Number(row.check_in_lng) }
            : undefined,
        };
      });

      setAttendanceRecords(records);
    }

    if (employees.length > 0) {
      loadAttendance();
    }
  }, [employees]);

  // Дебаунс поиска
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 250);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Фильтрация записей (мемоизация)
  const filteredRecords = useMemo(() => {
    const filterDateStr = new Date(filterDate + 'T00:00:00').toDateString();
    const s = debouncedSearch.toLowerCase();
    return attendanceRecords.filter(record => {
      const matchesDate = record.date === filterDateStr;
      const matchesEmployee = filterEmployee === 'all' || record.employeeId === filterEmployee;
      const matchesStatus = filterStatus === 'all' || record.status === filterStatus;
      const matchesSearch = record.employeeName.toLowerCase().includes(s);
      return matchesDate && matchesEmployee && matchesStatus && matchesSearch;
    });
  }, [attendanceRecords, filterDate, filterEmployee, filterStatus, debouncedSearch]);

  // Статистика (уникальные сотрудники за сегодня)
  const today = new Date().toDateString();
  const todayRecords = attendanceRecords.filter(r => r.date === today);
  const todayEmployees = new Set(todayRecords.map(r => r.employeeId));

  const todayStats = {
    total: todayEmployees.size,
    inOffice: new Set(todayRecords.filter(r => r.status === 'in_office').map(r => r.employeeId)).size,
    onProject: new Set(todayRecords.filter(r => r.status === 'on_project').map(r => r.employeeId)).size,
    remote: new Set(todayRecords.filter(r => r.status === 'remote').map(r => r.employeeId)).size,
    vacation: new Set(todayRecords.filter(r => r.status === 'vacation').map(r => r.employeeId)).size,
    sickLeave: new Set(todayRecords.filter(r => r.status === 'sick_leave').map(r => r.employeeId)).size,
  };


  // Вычисляем время работы (check_in/check_out — TIME строки HH:MM:SS)
  const calculateWorkTime = (checkIn: string, checkOut?: string) => {
    if (!checkOut || !checkIn) return 'В работе';

    const [h1, m1] = checkIn.split(':').map(Number);
    const [h2, m2] = checkOut.split(':').map(Number);
    const diffMin = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diffMin <= 0) return 'В работе';

    const hours = Math.floor(diffMin / 60);
    const minutes = diffMin % 60;
    return `${hours}ч ${minutes}м`;
  };

  const isAdmin = user?.role === 'admin';
  const isCEO = user?.role === 'ceo';
  // canViewAll — кто видит всю фирму (директора, HR, админ).
  // Остальные сотрудники видят только СВОЮ посещаемость (personal view).
  const canViewAll = user && ['ceo', 'deputy_director', 'hr', 'admin'].includes(user.role);
  const personalView = !canViewAll;

  // Если personal view — режем filteredRecords только по своим записям.
  // Также скрываем фильтр «Сотрудник» (нечего фильтровать).
  const visibleRecords = useMemo(
    () => (personalView && user ? filteredRecords.filter(r => r.employeeId === user.id) : filteredRecords),
    [filteredRecords, personalView, user],
  );

  // Аналитика по периоду для директоров (30 / 90 / 365 дней назад).
  // Для каждого периода — топ статусов и распределение часов.
  const analytics = useMemo(() => {
    if (!canViewAll) return null;
    const now = Date.now();
    const DAY = 86400 * 1000;
    const calc = (sinceMs: number) => {
      const since = now - sinceMs;
      const sliced = attendanceRecords.filter(r => new Date(r.date).getTime() >= since);
      const byStatus: Record<string, number> = {};
      const uniqueDays = new Set<string>();
      const uniquePeople = new Set<string>();
      for (const r of sliced) {
        byStatus[r.status] = (byStatus[r.status] || 0) + 1;
        uniqueDays.add(r.date);
        uniquePeople.add(r.employeeId);
      }
      return { total: sliced.length, byStatus, uniqueDays: uniqueDays.size, uniquePeople: uniquePeople.size };
    };
    return {
      month: calc(30 * DAY),
      quarter: calc(90 * DAY),
      year: calc(365 * DAY),
    };
  }, [canViewAll, attendanceRecords]);

  // Топ-N сотрудников по посещаемости в офисе за месяц (для CEO).
  const topByPresence = useMemo(() => {
    if (!canViewAll) return [];
    const since = Date.now() - 30 * 86400 * 1000;
    const sliced = attendanceRecords.filter(r => new Date(r.date).getTime() >= since);
    const map = new Map<string, { name: string; office: number; remote: number; project: number; absent: number; total: number }>();
    for (const r of sliced) {
      const cur = map.get(r.employeeId) || { name: r.employeeName, office: 0, remote: 0, project: 0, absent: 0, total: 0 };
      cur.total++;
      if (r.status === 'in_office') cur.office++;
      else if (r.status === 'remote') cur.remote++;
      else if (r.status === 'on_project') cur.project++;
      else if (r.status === 'vacation' || r.status === 'sick_leave' || r.status === 'day_off') cur.absent++;
      map.set(r.employeeId, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [canViewAll, attendanceRecords]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">📊 Посещаемость</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            {personalView ? 'Мои отметки за период' : 'Учёт рабочего времени сотрудников'}
          </p>
        </div>
        {isAdmin && (
          <Badge variant="outline" className="text-xs self-start sm:self-auto">
            Настройки → Система → Геолокация
          </Badge>
        )}
      </div>

      {/* Виджет отметки прихода/ухода — доступен всем ролям прямо тут.
          Обёрнут в ErrorBoundary, чтобы падение виджета не валило всю страницу. */}
      <WidgetErrorBoundary label="Отметка посещений">
        <CheckInWidget />
      </WidgetErrorBoundary>

      {/* Personal info: только свои записи */}
      {personalView && (
        <Card className="p-4 bg-muted/30 border-muted">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-muted-foreground">
                Видишь только свои отметки. Отметить приход/уход можно кнопкой выше.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Аналитика для CEO/зам.ГД/HR/admin — как требовал юзер «прям как аналитика» */}
      {canViewAll && analytics && (
        <Card className="p-4">
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Аналитика посещаемости — за период
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { label: 'За 30 дней', data: analytics.month },
              { label: 'За квартал (90д)', data: analytics.quarter },
              { label: 'За год (365д)', data: analytics.year },
            ].map(({ label, data }) => (
              <div key={label} className="rounded-lg bg-muted/40 p-3 space-y-1.5 text-xs">
                <div className="font-medium text-foreground text-sm">{label}</div>
                <div className="flex justify-between"><span className="text-muted-foreground">Записей</span><b>{data.total}</b></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Уникальных дней</span><b>{data.uniqueDays}</b></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Сотрудников</span><b>{data.uniquePeople}</b></div>
                <div className="border-t pt-1.5 mt-1.5 space-y-1">
                  <div className="flex justify-between"><span className="text-green-700">🏢 В офисе</span><b>{data.byStatus['in_office'] || 0}</b></div>
                  <div className="flex justify-between"><span className="text-blue-700">💼 На проекте</span><b>{data.byStatus['on_project'] || 0}</b></div>
                  <div className="flex justify-between"><span className="text-purple-700">🏠 Удалённо</span><b>{data.byStatus['remote'] || 0}</b></div>
                  <div className="flex justify-between"><span className="text-orange-700">✈ Отпуск</span><b>{data.byStatus['vacation'] || 0}</b></div>
                  <div className="flex justify-between"><span className="text-red-700">🤒 Больничный</span><b>{data.byStatus['sick_leave'] || 0}</b></div>
                </div>
              </div>
            ))}
          </div>

          {/* Топ-10 за месяц — для CEO/зам.ГД сразу видно «кто как ходит» */}
          {topByPresence.length > 0 && (
            <div className="mt-4 border-t pt-3">
              <h3 className="text-sm font-medium mb-2">Топ-10 за 30 дней (сколько записей)</h3>
              <div className="space-y-1.5">
                {topByPresence.map((e, idx) => (
                  <div key={e.name} className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-2 items-center text-xs p-2 rounded bg-muted/30">
                    <span className="text-muted-foreground w-6">{idx + 1}.</span>
                    <span className="font-medium truncate">{e.name}</span>
                    <span className="text-green-700">🏢 {e.office}</span>
                    <span className="text-purple-700">🏠 {e.remote}</span>
                    <span className="text-blue-700">💼 {e.project}</span>
                    <span className="text-orange-700">✈ {e.absent}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Сводная статистика «сегодня» — только для директоров/HR/админа.
          Сотруднику нет смысла видеть сколько человек в фирме сегодня в офисе. */}
      {canViewAll && (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-primary" />
            <div>
              <p className="text-2xl font-bold">{todayStats.total}</p>
              <p className="text-xs text-muted-foreground">Всего</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{todayStats.inOffice}</p>
              <p className="text-xs text-muted-foreground">В офисе</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <Briefcase className="w-5 h-5 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{todayStats.onProject}</p>
              <p className="text-xs text-muted-foreground">На проекте</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <Home className="w-5 h-5 text-purple-500" />
            <div>
              <p className="text-2xl font-bold">{todayStats.remote}</p>
              <p className="text-xs text-muted-foreground">Удалённо</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <Plane className="w-5 h-5 text-orange-500" />
            <div>
              <p className="text-2xl font-bold">{todayStats.vacation}</p>
              <p className="text-xs text-muted-foreground">В отпуске</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <Heart className="w-5 h-5 text-red-500" />
            <div>
              <p className="text-2xl font-bold">{todayStats.sickLeave}</p>
              <p className="text-xs text-muted-foreground">Больничный</p>
            </div>
          </div>
        </Card>
      </div>
      )}

      {/* Карта офисных локаций - для CEO (только просмотр) */}
      {isCEO && officeLocations.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Офисные точки</h3>
            </div>
            <Badge variant="outline" className="text-xs">
              Только для просмотра
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {officeLocations.map((office, index) => (
              <Card key={index} className="p-4 bg-secondary/10">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-primary" />
                      {office.name}
                    </h4>
                    <Badge variant="outline" className="text-xs">
                      {office.radius}м
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div className="flex items-center gap-2">
                      <Navigation className="w-3 h-3" />
                      <span className="font-mono text-xs">
                        {office.lat.toFixed(6)}, {office.lng.toFixed(6)}
                      </span>
                    </div>
                    <a
                      href={`https://www.google.com/maps?q=${office.lat},${office.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-xs flex items-center gap-1 mt-2"
                    >
                      <MapPin className="w-3 h-3" />
                      Открыть в Google Maps
                    </a>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </Card>
      )}

      {/* Фильтры */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Поиск по имени сотрудника..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-40"
            />

            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as AttendanceStatus | 'all')}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                {Object.entries(STATUS_LABELS).map(([key, { label, icon }]) => (
                  <SelectItem key={key} value={key}>
                    <span className="flex items-center gap-2">
                      {icon}
                      {label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {canViewAll && (
              <Select value={filterEmployee} onValueChange={setFilterEmployee}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Выберите сотрудника" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все сотрудники</SelectItem>
                  {employees.map((emp: any) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </Card>

      {/* Список записей */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">
          Записи посещений - {new Date(filterDate).toLocaleDateString('ru-RU')}
        </h2>

        {visibleRecords.length > 0 ? (
          <div className="space-y-3">
            {visibleRecords.map((record) => {
              const statusInfo = STATUS_LABELS[record.status] || STATUS_LABELS.in_office;
              return (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center space-x-4">
                    <div className={`flex-shrink-0 p-2 rounded-full ${statusInfo.color} text-white`}>
                      {statusInfo.icon}
                    </div>

                    <div>
                      <p className="font-medium">{record.employeeName}</p>
                      <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span className="flex items-center space-x-1">
                          <Clock className="h-3 w-3" />
                          <span>Приход: {record.checkIn?.slice(0, 5) || '—'}</span>
                        </span>
                        {record.checkOut && (
                          <span className="flex items-center space-x-1">
                            <Clock className="h-3 w-3" />
                            <span>Уход: {record.checkOut?.slice(0, 5)}</span>
                          </span>
                        )}
                        <span className="flex items-center space-x-1">
                          <MapPin className="h-3 w-3" />
                          <span>{record.location}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Badge className={`${statusInfo.color} text-white`}>
                      {statusInfo.label}
                    </Badge>

                    <div className="text-right">
                      <p className="font-medium">{calculateWorkTime(record.checkIn, record.checkOut)}</p>
                      <p className="text-sm text-muted-foreground">Время работы</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Нет записей посещений за выбранную дату</p>
          </div>
        )}
      </Card>
    </div>
  );
}