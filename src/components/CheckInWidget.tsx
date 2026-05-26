import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  ChevronDown,
  Building2,
  Briefcase,
  Home,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useAppSettings, isWithinOfficeRadius } from '@/lib/appSettings';
import { supabase } from '@/integrations/supabase/client';

type LocationType = 'office' | 'client' | 'remote';

const LOCATION_LABELS: Record<LocationType, string> = {
  office: 'В офисе',
  client: 'На проекте',
  remote: 'Удалённо',
};

// employee_id в таблице attendance — UUID. Демо-юзеры (id вида "ceo_1", "partner_1")
// валидно не вставятся — Postgres вернёт 22P02 invalid input syntax for type uuid.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
          const locationLabel = LOCATION_LABELS[(data.location_type || 'remote') as LocationType] || 'Удалённо';
          setTodayRecord({
            id: data.id,
            checkIn: data.check_in || '',
            checkOut: data.check_out || undefined,
            location: locationLabel,
          });
          setCurrentLocation(locationLabel);
        }
      });
  }, [user?.id]);

  // Получаем координаты пользователя (без определения типа локации)
  const getCoords = async (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ lat: 0, lng: 0 });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
        () => resolve({ lat: 0, lng: 0 }),
        { timeout: 5000 },
      );
    });
  };

  // Автоопределение локации: в офисе или удалённо (по радиусу).
  // Полностью defensive — если appSettings битый, считаем remote.
  const detectLocation = (coords: { lat: number; lng: number }): LocationType => {
    try {
      if (!appSettings?.officeLocation?.enabled) return 'remote';
      if (!coords.lat && !coords.lng) return 'remote';
      return isWithinOfficeRadius(coords.lat, coords.lng) ? 'office' : 'remote';
    } catch (e) {
      console.warn('detectLocation failed, falling back to remote:', e);
      return 'remote';
    }
  };

  // Отметка прихода. Если передан explicit — используем его, иначе автоопределение.
  const handleCheckIn = async (explicit?: LocationType) => {
    if (!user) return;

    // Демо-юзеры с id типа "ceo_1" не пройдут вставку в attendance.employee_id (UUID).
    if (!UUID_RE.test(user.id)) {
      toast({
        title: 'Демо-аккаунт',
        description: 'У этого аккаунта нестандартный ID — отметка прихода доступна только реальным сотрудникам из БД.',
        variant: 'destructive',
      });
      return;
    }

    setIsCheckingIn(true);
    try {
      const coords = await getCoords();
      const locationType: LocationType = explicit ?? detectLocation(coords);
      const locationLabel = LOCATION_LABELS[locationType];
      setCurrentLocation(locationLabel);

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
        location: locationLabel,
      });

      toast({
        title: 'Приход отмечен',
        description: `Время: ${now.toLocaleTimeString('ru-RU')}\nМестоположение: ${locationLabel}`,
      });
    } catch (error: any) {
      // Supabase возвращает { code, details, hint, message } — это НЕ инстанс Error,
      // поэтому раньше пользователь видел только generic "Не удалось отметить приход".
      console.error('check-in failed:', error);
      const msg =
        error?.message ||
        (typeof error === 'string' ? error : null) ||
        (error?.code ? `Supabase: ${error.code}` : 'Не удалось отметить приход');
      const hint = error?.hint ? `\nПодсказка: ${error.hint}` : '';
      const details = error?.details ? `\n${error.details}` : '';
      toast({
        title: 'Ошибка отметки прихода',
        description: `${msg}${details}${hint}`,
        variant: 'destructive',
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
        title: 'Уход отмечен',
        description: `Время: ${now.toLocaleTimeString('ru-RU')}`,
      });
    } catch (error: any) {
      console.error('check-out failed:', error);
      const msg = error?.message || (error?.code ? `Supabase: ${error.code}` : 'Не удалось отметить уход');
      toast({
        title: 'Ошибка отметки ухода',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Виджет должен быть доступен всем сотрудникам, включая руководство и партнёров.
  // Без user — скрываем.
  if (!user) {
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
        // Split-кнопка: основная часть — авто-определение, правая — ручной выбор локации
        <div className="flex w-full">
          <Button
            onClick={() => handleCheckIn()}
            disabled={isCheckingIn}
            className="flex-1 rounded-r-none"
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                disabled={isCheckingIn}
                aria-label="Выбрать тип локации"
                className="rounded-l-none border-l border-primary-foreground/20 px-3"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Указать вручную</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleCheckIn('office')}>
                <Building2 className="h-4 w-4 mr-2 text-green-600" />
                В офисе
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCheckIn('client')}>
                <Briefcase className="h-4 w-4 mr-2 text-blue-600" />
                На проекте
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCheckIn('remote')}>
                <Home className="h-4 w-4 mr-2 text-purple-600" />
                Удалённо
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </Card>
  );
}
