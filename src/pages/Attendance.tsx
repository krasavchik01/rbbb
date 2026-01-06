import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployees } from '@/hooks/useSupabaseData';
import { Calendar, Clock, MapPin, Users, CheckCircle, XCircle, Settings, Building2, Briefcase, Home, Plane, Heart, Navigation } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAppSettings } from '@/lib/appSettings';

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
  const { toast } = useToast();
  const [appSettings] = useAppSettings();
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [filterStatus, setFilterStatus] = useState<AttendanceStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Настройки геолокации офиса - БЕРЁМ ИЗ ГЛОБАЛЬНЫХ НАСТРОЕК
  const [officeSettingsOpen, setOfficeSettingsOpen] = useState(false);
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

  // Загружаем записи посещений
  useEffect(() => {
    const records = JSON.parse(localStorage.getItem('attendanceRecords') || '[]');
    
    // Обогащаем записи именами сотрудников
    const enrichedRecords = records.map((record: any) => {
      const employee = employees.find((emp: any) => emp.id === record.employeeId);
      return {
        ...record,
        employeeName: employee?.name || 'Неизвестный сотрудник'
      };
    });
    
    setAttendanceRecords(enrichedRecords);
  }, [employees]);

  // Дебаунс поиска
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 250);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Фильтрация записей (мемоизация)
  const filteredRecords = useMemo(() => {
    const dateStr = new Date(filterDate).toDateString();
    const s = debouncedSearch.toLowerCase();
    return attendanceRecords.filter(record => {
      const matchesDate = record.date === dateStr;
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


  // Вычисляем время работы
  const calculateWorkTime = (checkIn: string, checkOut?: string) => {
    if (!checkOut) return 'В работе';
    
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}ч ${minutes}м`;
  };

  const isHR = user?.role === 'admin' || user?.role === 'ceo';
  const isAdmin = user?.role === 'admin';
  const isCEO = user?.role === 'ceo';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">📊 Посещаемость</h1>
          <p className="text-muted-foreground">Учет рабочего времени сотрудников</p>
        </div>
        {isAdmin && (
          <Badge variant="outline" className="text-xs">
            Настройки офиса: Настройки → Система → Геолокация офиса
          </Badge>
        )}
      </div>

      {/* Статистика - расширенная */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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

            {isHR && (
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

        {filteredRecords.length > 0 ? (
          <div className="space-y-3">
            {filteredRecords.map((record) => {
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
                          <span>Приход: {new Date(record.checkIn).toLocaleTimeString('ru-RU')}</span>
                        </span>
                        {record.checkOut && (
                          <span className="flex items-center space-x-1">
                            <Clock className="h-3 w-3" />
                            <span>Уход: {new Date(record.checkOut).toLocaleTimeString('ru-RU')}</span>
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