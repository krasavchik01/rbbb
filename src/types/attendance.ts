/**
 * Типы данных для системы посещаемости (приход/уход)
 */

export interface Location {
  lat: number;
  lng: number;
  accuracy: number;
  denied?: boolean;
}

export interface Office {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  radius: number; // метров
}

export type LocationType = 'office' | 'remote' | 'client' | 'trip';
export type AttendanceStatus = 'present' | 'late' | 'absent' | 'vacation' | 'sick_leave';

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  employee_name?: string;
  date: string; // YYYY-MM-DD
  check_in?: string; // HH:MM:SS
  check_in_location?: Location;
  check_out?: string; // HH:MM:SS
  check_out_location?: Location;
  location_type?: LocationType;
  office_id?: string;
  work_duration?: number; // минуты
  status: AttendanceStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface AttendanceStats {
  total_employees: number;
  present: number;
  late: number;
  absent: number;
  remote: number;
  on_leave: number;
}

// Офисы компании
export const COMPANY_OFFICES: Office[] = [
  {
    id: 'office-almaty',
    name: 'Офис Алматы',
    address: 'ул. Абая, 150, Алматы',
    lat: 43.238293,
    lng: 76.945465,
    radius: 100 // метров
  },
  {
    id: 'office-astana',
    name: 'Офис Астана',
    address: 'пр. Кабанбай батыра, 15, Астана',
    lat: 51.128207,
    lng: 71.430411,
    radius: 100
  }
];

// Вспомогательные функции
export const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371e3; // Радиус Земли в метрах
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Расстояние в метрах
};

export const detectOffice = (lat: number, lng: number): Office | null => {
  if (!lat || !lng) return null;

  for (const office of COMPANY_OFFICES) {
    const distance = calculateDistance(lat, lng, office.lat, office.lng);
    if (distance <= office.radius) {
      return office;
    }
  }
  return null;
};

export const getLocationEmoji = (type?: LocationType): string => {
  switch (type) {
    case 'office': return '🏢';
    case 'remote': return '🏠';
    case 'client': return '🚗';
    case 'trip': return '✈️';
    default: return '📍';
  }
};

export const getStatusColor = (status: AttendanceStatus): string => {
  switch (status) {
    case 'present': return 'text-success';
    case 'late': return 'text-warning';
    case 'absent': return 'text-destructive';
    case 'vacation': return 'text-blue-500';
    case 'sick_leave': return 'text-purple-500';
    default: return 'text-muted-foreground';
  }
};

export const calculateWorkDuration = (checkIn: string, checkOut: string): number => {
  if (!checkIn || !checkOut) return 0;
  
  const [inH, inM] = checkIn.split(':').map(Number);
  const [outH, outM] = checkOut.split(':').map(Number);
  
  const inMinutes = inH * 60 + inM;
  const outMinutes = outH * 60 + outM;
  
  return outMinutes - inMinutes;
};

export const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}ч ${mins}мин`;
};




