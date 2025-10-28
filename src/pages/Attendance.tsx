import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployees } from '@/hooks/useSupabaseData';
import { Calendar, Clock, MapPin, Users, TrendingUp, CheckCircle, XCircle } from 'lucide-react';

interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  checkIn: string;
  checkOut?: string;
  location: string;
  status: 'in_office' | 'remote' | 'client';
  date: string;
}

export default function Attendance() {
  const { user } = useAuth();
  const { employees = [] } = useEmployees();
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

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

  // Фильтрация записей
  const filteredRecords = attendanceRecords.filter(record => {
    const matchesDate = record.date === new Date(filterDate).toDateString();
    const matchesEmployee = filterEmployee === 'all' || record.employeeId === filterEmployee;
    const matchesSearch = record.employeeName.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesDate && matchesEmployee && matchesSearch;
  });

  // Статистика
  const todayStats = {
    total: attendanceRecords.filter(r => r.date === new Date().toDateString()).length,
    inOffice: attendanceRecords.filter(r => r.date === new Date().toDateString() && r.status === 'in_office').length,
    remote: attendanceRecords.filter(r => r.date === new Date().toDateString() && r.status === 'remote').length,
    checkedOut: attendanceRecords.filter(r => r.date === new Date().toDateString() && r.checkOut).length
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">📊 Посещаемость</h1>
          <p className="text-muted-foreground">Учет рабочего времени сотрудников</p>
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-primary" />
            <div>
              <p className="text-2xl font-bold">{todayStats.total}</p>
              <p className="text-sm text-muted-foreground">Всего сегодня</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-success" />
            <div>
              <p className="text-2xl font-bold">{todayStats.inOffice}</p>
              <p className="text-sm text-muted-foreground">В офисе</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-warning" />
            <div>
              <p className="text-2xl font-bold">{todayStats.remote}</p>
              <p className="text-sm text-muted-foreground">Удаленно</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <XCircle className="w-5 h-5 text-info" />
            <div>
              <p className="text-2xl font-bold">{todayStats.checkedOut}</p>
              <p className="text-sm text-muted-foreground">Завершили работу</p>
            </div>
          </div>
        </Card>
      </div>

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
          
          <div className="flex gap-2">
            <Input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-40"
            />
            
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
            {filteredRecords.map((record) => (
              <div 
                key={record.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    {record.checkOut ? (
                      <XCircle className="h-5 w-5 text-destructive" />
                    ) : (
                      <CheckCircle className="h-5 w-5 text-success" />
                    )}
                  </div>
                  
                  <div>
                    <p className="font-medium">{record.employeeName}</p>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
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
                  <Badge 
                    variant={record.status === 'in_office' ? 'default' : 'secondary'}
                  >
                    {record.status === 'in_office' ? 'В офисе' : 'Удаленно'}
                  </Badge>
                  
                  <div className="text-right">
                    <p className="font-medium">{calculateWorkTime(record.checkIn, record.checkOut)}</p>
                    <p className="text-sm text-muted-foreground">Время работы</p>
                  </div>
                </div>
              </div>
            ))}
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