/**
 * Константы для модуля МСУК-1 Compliance Manager
 */

import type { MSUKClient } from '@/types/msuk';

/**
 * Демо-клиенты для быстрого старта
 */
export const DEMO_CLIENTS: Omit<MSUKClient, 'id' | 'documents'>[] = [
  {
    name: 'ТОО "МАЭК"',
    inn: '7710000000',
    country: 'KZ',
    industry: 'Энергетика',
    publicCompany: true,
    litigation: false,
    conflictOfInterest: false,
    employees: '3421',
    revenue: '76000',
  },
  {
    name: 'ПАО "Газпром"',
    inn: '7704192801',
    country: 'RU',
    industry: 'Энергетика',
    publicCompany: true,
    litigation: true,
    conflictOfInterest: false,
    employees: '415000',
    revenue: '10500000',
  },
  {
    name: 'ООО "Альфа-Банк"',
    inn: '7700020830',
    country: 'RU',
    industry: 'Финансовые услуги',
    publicCompany: true,
    litigation: true,
    conflictOfInterest: true,
    employees: '5000',
    revenue: '250000',
  },
  {
    name: 'ООО "TechCore Solutions"',
    inn: '7708123456',
    country: 'RU',
    industry: 'Информационные технологии',
    publicCompany: false,
    litigation: false,
    conflictOfInterest: false,
    employees: '250',
    revenue: '500',
  },
  {
    name: 'ОАО "Торговая сеть"',
    inn: '7701987654',
    country: 'RU',
    industry: 'Розница',
    publicCompany: false,
    litigation: false,
    conflictOfInterest: true,
    employees: '2500',
    revenue: '5000',
  },
  {
    name: 'ООО "СОГД Страховая"',
    inn: '7702445566',
    country: 'RU',
    industry: 'Страхование',
    publicCompany: true,
    litigation: false,
    conflictOfInterest: false,
    employees: '800',
    revenue: '2000',
  },
];

