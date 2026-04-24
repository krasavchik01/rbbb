import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useAppSettings, isWithinOfficeRadius } from '@/lib/appSettings';
import { supabase } from '@/integrations/supabase/client';

interface TodayRecord {
  id: string;
  checkIn: string;
  checkOut?: string;
  location: string;
}

export function CheckInWidget() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [appSettings] = useAppSettings();
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<string>('');
  const [todayRecord, setTodayRecord] = useState<TodayRecord | null>(null);

  // Загружаем запись на сегодня из Supabase
  useEffect(() => {
    if (!user?.id) return;

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    supabase
      .from('attendance')
      .select('id, check_in, check_out, location_type')
      .eq('employee_id', user.id)
      .eq('date', today)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setTodayRecord({
            id: data.id,
            checkIn: data.check_in || '',
            checkOut: data.check_out || undefined,
            location: data.location_type === 'office' ? 'В офисе' : 'Удалённо',
          });
          setCurrentLocation(data.location_type === 'office' ? 'В офисе' : 'Удалённо');
        }
      });
  }, [user?.id]);

  // Получаем геолокацию
  const getCurrentLocation = async (): Promise<{ location: string; locationType: string; coords: { lat: number; lng: number } }> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ location: 'Геолокация недоступна', locationType: 'remote', coords: { lat: 0, lng: 0 } });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          if (appSettings.officeLocation.enabled) {
            const inOffice = isWithinOfficeRadius(latitude, longitude);
            resolve({
              location: inOffice ? 'В офисе' : 'Удалённо',
              locationType: inOffice ? 'office' : 'remote',
              coords: { lat: latitude, lng: longitude },
            });
          } else {
            resolve({ location: 'Удалённо', locationType: 'remote', coords: { lat: latitude, lng: longitude } });
          }
        },
        () => resolve({ location: 'Геолокация недоступна', locationType: 'remote', coords: { lat: 0, lng: 0 } }),
        { timeout: 5000 }
      );
    });
  };

  // Отметка прихода
  const handleCheckIn = async () => {
    if (!user) return;

    setIsCheckingIn(true);
    try {
      const { location, locationType, coords } = await getCurrentLocation();
      setCurrentLocation(location);

      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().split(' ')[0]; // HH:MM:SS

      const { data, error } = await supabase
        .from('attendance')
        .upsert(
          {
            employee_id: user.id,
            date: today,
            check_in: timeStr,
            check_in_lat: coords.lat || null,
            check_in_lng: coords.lng || null,
            location_type: locationType,
            status: 'present',
          },
          { onConflict: 'employee_id,date' }
        )
        .select('id')
        .single();

      if (error) throw error;

      setTodayRecord({
        id: data.id,
        checkIn: timeStr,
        location,
      });

      toast({
        title: "Приход отмечен",
        description: `Время: ${now.toLocaleTimeString('ru-RU')}\nМестоположение: ${location}`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Не удалось отметить приход";
      toast({
        title: "Ошибка",
        description: errorMessage,
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
      const timeStr = now.toTimeString().split(' ')[0];

      // Рассчитываем продолжительность работы в минутах
      let workDuration: number | null = null;
      if (todayRecord.checkIn) {
        const [h1, m1] = todayRecord.checkIn.split(':').map(Number);
        const [h2, m2] = timeStr.split(':').map(Number);
        workDuration = (h2 * 60 + m2) - (h1 * 60 + m1);
      }

      const { error } = await supabase
        .from('attendance')
        .update({
          check_out: timeStr,
          work_duration: workDuration,
        })
        .eq('id', todayRecord.id);

      if (error) throw error;

      setTodayRecord({ ...todayRecord, checkOut: timeStr });

      toast({
        title: "Уход отмечен",
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

  // Показываем только для сотрудников (не для CEO и замдиректора)
  if (!user || user.role === 'ceo' || user.role === 'deputy_director') {
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
            <span className="text-sm">Приход: {todayRecord.checkIn}</span>
          </div>

          {todayRecord.checkOut ? (
            <div className="flex items-center space-x-2">
              <XCircle className="h-5 w-5 text-destructive" />
              <span className="text-sm">Уход: {todayRecord.checkOut}</span>
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
