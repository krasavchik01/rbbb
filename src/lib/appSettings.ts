// Настройки приложения, хранящиеся в localStorage
// Эти настройки управляются администратором

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

const SETTINGS_KEY = 'rb_app_settings';

export function getAppSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Мержим с дефолтными настройками на случай новых полей
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (error) {
    console.error('Ошибка чтения настроек:', error);
  }
  return DEFAULT_SETTINGS;
}

export function saveAppSettings(settings: Partial<AppSettings>): void {
  try {
    const current = getAppSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    // Dispatch event для реактивного обновления
    window.dispatchEvent(new CustomEvent('appSettingsChanged', { detail: updated }));
  } catch (error) {
    console.error('Ошибка сохранения настроек:', error);
  }
}

export function updateOfficeLocation(location: Partial<AppSettings['officeLocation']>): void {
  const current = getAppSettings();
  saveAppSettings({
    officeLocation: { ...current.officeLocation, ...location }
  });
}

// Проверка находится ли пользователь в радиусе офиса
export function isWithinOfficeRadius(userLat: number, userLng: number): boolean {
  const settings = getAppSettings();
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

export function useAppSettings(): [AppSettings, (settings: Partial<AppSettings>) => void] {
  const [settings, setSettings] = useState<AppSettings>(getAppSettings());

  useEffect(() => {
    const handleChange = (e: CustomEvent<AppSettings>) => {
      setSettings(e.detail);
    };

    window.addEventListener('appSettingsChanged', handleChange as EventListener);
    return () => window.removeEventListener('appSettingsChanged', handleChange as EventListener);
  }, []);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    saveAppSettings(newSettings);
  };

  return [settings, updateSettings];
}
