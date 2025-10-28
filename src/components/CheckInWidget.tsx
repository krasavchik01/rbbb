import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface AttendanceRecord {
  id: string;
  employeeId: string;
  checkIn: string;
  checkOut?: string;
  location: string;
  status: 'in_office' | 'remote' | 'client';
  date: string;
}

export function CheckInWidget() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<string>('');
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);

  // Загружаем записи посещений из localStorage
  useEffect(() => {
    const records = JSON.parse(localStorage.getItem('attendanceRecords') || '[]');
    setAttendanceRecords(records);
    
    // Находим запись на сегодня
    const today = new Date().toDateString();
    const todayRec = records.find((r: AttendanceRecord) => 
      new Date(r.date).toDateString() === today && r.employeeId === user?.id
    );
    setTodayRecord(todayRec);
  }, [user?.id]);

  // Получаем геолокацию
  const getCurrentLocation = async (): Promise<string> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve('Геолокация недоступна');
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          
          // Простая проверка на офис (можно настроить координаты)
          const officeLat = 43.2220; // Примерные координаты Алматы
          const officeLng = 76.8512;
          const distance = Math.sqrt(
            Math.pow(latitude - officeLat, 2) + Math.pow(longitude - officeLng, 2)
          );
          
          if (distance < 0.01) { // ~1км от офиса
            resolve('В офисе');
          } else {
            resolve('Удаленно');
          }
        },
        () => resolve('Геолокация недоступна'),
        { timeout: 5000 }
      );
    });
  };

  // Отметка прихода
  const handleCheckIn = async () => {
    if (!user) return;
    
    setIsCheckingIn(true);
    try {
      const location = await getCurrentLocation();
      setCurrentLocation(location);
      
      const now = new Date();
      const newRecord: AttendanceRecord = {
        id: Date.now().toString(),
        employeeId: user.id,
        checkIn: now.toISOString(),
        location,
        status: location === 'В офисе' ? 'in_office' : 'remote',
        date: now.toDateString()
      };

      const updatedRecords = [...attendanceRecords, newRecord];
      setAttendanceRecords(updatedRecords);
      setTodayRecord(newRecord);
      localStorage.setItem('attendanceRecords', JSON.stringify(updatedRecords));

      toast({
        title: "✅ Приход отмечен",
        description: `Время: ${now.toLocaleTimeString('ru-RU')}\nМестоположение: ${location}`,
      });
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось отметить приход",
        variant: "destructive",
      });
    } finally {
      setIsCheckingIn(false);
    }
  };

  // Отметка ухода
  const handleCheckOut = async () => {
    if (!user || !todayRecord) return;
    
    setIsCheckingOut(true);
    try {
      const now = new Date();
      const updatedRecord = { ...todayRecord, checkOut: now.toISOString() };
      
      const updatedRecords = attendanceRecords.map(r => 
        r.id === todayRecord.id ? updatedRecord : r
      );
      
      setAttendanceRecords(updatedRecords);
      setTodayRecord(updatedRecord);
      localStorage.setItem('attendanceRecords', JSON.stringify(updatedRecords));

      toast({
        title: "✅ Уход отмечен",
        description: `Время: ${now.toLocaleTimeString('ru-RU')}`,
      });
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось отметить уход",
        variant: "destructive",
      });
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Показываем только для сотрудников (не для CEO)
  if (!user || user.role === 'ceo') {
    return null;
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Отметка посещений</h3>
        <Badge variant="outline" className="flex items-center space-x-1">
          <MapPin className="h-3 w-3" />
          <span>{currentLocation || 'Определяется...'}</span>
        </Badge>
      </div>

      {todayRecord ? (
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-success" />
            <span className="text-sm">Приход: {new Date(todayRecord.checkIn).toLocaleTimeString('ru-RU')}</span>
          </div>
          
          {todayRecord.checkOut ? (
            <div className="flex items-center space-x-2">
              <XCircle className="h-5 w-5 text-destructive" />
              <span className="text-sm">Уход: {new Date(todayRecord.checkOut).toLocaleTimeString('ru-RU')}</span>
            </div>
          ) : (
            <Button 
              onClick={handleCheckOut}
              disabled={isCheckingOut}
              variant="outline"
              className="w-full"
            >
              {isCheckingOut ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                  Отмечаем уход...
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4 mr-2" />
                  Отметить уход
                </>
              )}
            </Button>
          )}
        </div>
      ) : (
        <Button 
          onClick={handleCheckIn}
          disabled={isCheckingIn}
          className="w-full"
        >
          {isCheckingIn ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Отмечаем приход...
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Отметить приход
            </>
          )}
        </Button>
      )}
    </Card>
  );
}