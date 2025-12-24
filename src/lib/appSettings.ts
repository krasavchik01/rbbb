// Настройки приложения, хранящиеся в Supabase
// Эти настройки управляются администратором и применяются глобально для всех пользователей

import { supabase } from '@/integrations/supabase/client';

export interface AppSettings {
  // Показывать ли демо-пользователей на странице входа
  showDemoUsers: boolean;
  // Координаты офиса для геолокации
  officeLocation: {
    enabled: boolean;
    latitude: number;
    longitude: number;
    radiusMeters: number; // Радиус в метрах для проверки присутствия
    address: string;
  };
  // Режим работы приложения
  maintenanceMode: boolean;
  maintenanceMessage: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  showDemoUsers: true, // По умолчанию показываем демо для тестирования
  officeLocation: {
    enabled: false,
    latitude: 43.238949, // Алматы, Казахстан (примерные координаты)
    longitude: 76.945465,
    radiusMeters: 100,
    address: ''
  },
  maintenanceMode: false,
  maintenanceMessage: ''
};

const SETTINGS_KEY = 'rb_app_settings'; // Используется для кеша

// Кешируем настройки локально для быстрого доступа
let cachedSettings: AppSettings | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5000; // 5 секунд кеш

export async function getAppSettings(): Promise<AppSettings> {
  // Возвращаем кеш если он свежий
  if (cachedSettings && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedSettings;
  }

  try {
    // Читаем из Supabase
    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .limit(1)
      .single();

    if (error) {
      console.error('Ошибка чтения настроек из Supabase:', error);
      // Fallback на localStorage
      return getLocalSettings();
    }

    if (data) {
      const settings: AppSettings = {
        showDemoUsers: data.show_demo_users ?? DEFAULT_SETTINGS.showDemoUsers,
        officeLocation: {
          enabled: data.office_location_enabled ?? DEFAULT_SETTINGS.officeLocation.enabled,
          latitude: Number(data.office_latitude) ?? DEFAULT_SETTINGS.officeLocation.latitude,
          longitude: Number(data.office_longitude) ?? DEFAULT_SETTINGS.officeLocation.longitude,
          radiusMeters: data.office_radius_meters ?? DEFAULT_SETTINGS.officeLocation.radiusMeters,
          address: data.office_address ?? DEFAULT_SETTINGS.officeLocation.address
        },
        maintenanceMode: data.maintenance_mode ?? DEFAULT_SETTINGS.maintenanceMode,
        maintenanceMessage: data.maintenance_message ?? DEFAULT_SETTINGS.maintenanceMessage
      };

      // Обновляем кеш
      cachedSettings = settings;
      cacheTimestamp = Date.now();

      // Сохраняем в localStorage как fallback
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      } catch (e) {
        console.warn('Не удалось сохранить в localStorage:', e);
      }

      return settings;
    }
  } catch (error) {
    console.error('Ошибка при получении настроек:', error);
  }

  // Fallback на localStorage или дефолтные настройки
  return getLocalSettings();
}

// Fallback: чтение из localStorage
function getLocalSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (error) {
    console.error('Ошибка чтения из localStorage:', error);
  }
  return DEFAULT_SETTINGS;
}

export async function saveAppSettings(settings: Partial<AppSettings>): Promise<void> {
  try {
    const current = await getAppSettings();
    const updated = { ...current, ...settings };

    // Сохраняем в Supabase
    const { error } = await supabase
      .from('app_settings')
      .update({
        show_demo_users: updated.showDemoUsers,
        office_location_enabled: updated.officeLocation.enabled,
        office_latitude: updated.officeLocation.latitude,
        office_longitude: updated.officeLocation.longitude,
        office_radius_meters: updated.officeLocation.radiusMeters,
        office_address: updated.officeLocation.address,
        maintenance_mode: updated.maintenanceMode,
        maintenance_message: updated.maintenanceMessage
      })
      .eq('id', (await supabase.from('app_settings').select('id').limit(1).single()).data?.id || '');

    if (error) {
      console.error('Ошибка сохранения в Supabase:', error);
      throw error;
    }

    // Инвалидируем кеш
    cachedSettings = updated;
    cacheTimestamp = Date.now();

    // Сохраняем в localStorage как fallback
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Не удалось сохранить в localStorage:', e);
    }

    // Dispatch event для реактивного обновления
    window.dispatchEvent(new CustomEvent('appSettingsChanged', { detail: updated }));
  } catch (error) {
    console.error('Ошибка сохранения настроек:', error);
    throw error;
  }
}

export async function updateOfficeLocation(location: Partial<AppSettings['officeLocation']>): Promise<void> {
  const current = await getAppSettings();
  await saveAppSettings({
    officeLocation: { ...current.officeLocation, ...location }
  });
}

// Проверка находится ли пользователь в радиусе офиса
// ВАЖНО: использует кешированные настройки для синхронной работы
export function isWithinOfficeRadius(userLat: number, userLng: number): boolean {
  // Используем кеш или fallback на localStorage
  const settings = cachedSettings || getLocalSettings();

  if (!settings.officeLocation.enabled) return true; // Если проверка отключена - всегда true

  const { latitude, longitude, radiusMeters } = settings.officeLocation;

  // Формула Хаверсина для расчета расстояния между двумя точками
  const R = 6371000; // Радиус Земли в метрах
  const dLat = toRad(userLat - latitude);
  const dLon = toRad(userLng - longitude);
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(latitude)) * Math.cos(toRad(userLat)) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;

  return distance <= radiusMeters;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Хук для использования настроек в React компонентах
import { useState, useEffect } from 'react';

export function useAppSettings(): [AppSettings, (settings: Partial<AppSettings>) => Promise<void>] {
  const [settings, setSettings] = useState<AppSettings>(cachedSettings || DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Загружаем настройки при монтировании
    const loadSettings = async () => {
      try {
        const loaded = await getAppSettings();
        setSettings(loaded);
      } catch (error) {
        console.error('Ошибка загрузки настроек:', error);
        setSettings(getLocalSettings());
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();

    // Подписываемся на изменения
    const handleChange = (e: CustomEvent<AppSettings>) => {
      setSettings(e.detail);
    };

    window.addEventListener('appSettingsChanged', handleChange as EventListener);
    return () => window.removeEventListener('appSettingsChanged', handleChange as EventListener);
  }, []);

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    await saveAppSettings(newSettings);
  };

  return [settings, updateSettings];
}
