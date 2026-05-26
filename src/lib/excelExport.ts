/**
 * Утилиты для импорта и экспорта проектов в Excel
 */

import type * as XLSXNs from 'xlsx';
import { supabaseDataStore } from '@/lib/supabaseDataStore';

// xlsx грузим динамически — это самый тяжёлый пакет в проекте (~425 KB).
// Без этого xlsx-chunk подтягивался вместе со страницей /projects, даже когда
// пользователь не нажимал «Экспорт» или «Импорт».
async function loadXlsx(): Promise<typeof XLSXNs> {
  return await import('xlsx');
}

// Интерфейс для проекта (упрощенный для Excel)
export interface ProjectExcelRow {
  '№': number;
  'Название проекта': string;
  'Клиент': string;
  // Новые поля
  'Наименование'?: string;           // Название клиента/компании (может отличаться от "Клиент")
  'Сайт компании'?: string;          // URL сайта клиента
  'Деятельность'?: string;            // Тип деятельности
  'Город'?: string;                  // Город/адрес
  'Номер договора'?: string;          // Альтернатива "Договор №"
  'Договор №': string;
  'Дата договора': string;
  'Предмет'?: string;                 // Описание проекта/предмет договора
  'Контакты'?: string;                // Многострочное поле с ФИО, телефонами, email
  'Срок оказания услуг'?: string;     // Дата окончания
  'Сумма'?: number | string;                   // Альтернатива "Сумма (без НДС)" или "Сумма с учетом НДС"
  'Сумма (без НДС)'?: number | string;
  'Сумма с учетом НДС'?: number | string;      // Поддержка варианта с НДС
  'Валюта': string;
  'Наша компания': string;
  'Консорциум?': string;
  'Доли консорциума': string;
  'Статус': string;
  'Прогресс %': number;
  'Дата создания': string;
  'Создал': string;
}

/**
 * Форматирование контактов в многострочную строку для Excel
 */
function formatContactsForExcel(contacts: any[]): string {
  if (!contacts || contacts.length === 0) return '';
  
  return contacts.map(contact => {
    const parts: string[] = [];
    if (contact.name) parts.push(contact.name);
    if (contact.position || contact.role) {
      const role = contact.position || contact.role;
      parts.push(`- ${role}`);
    }
    if (contact.phone) {
      if (contact.phone2) {
        parts.push(contact.phone);
        parts.push(`Рабочий телефон ${contact.phone2}`);
      } else {
        parts.push(contact.phone);
      }
    }
    if (contact.phone2 && !contact.phone) {
      parts.push(`Рабочий телефон ${contact.phone2}`);
    }
    if (contact.email) {
      parts.push(`Email: ${contact.email}`);
    }
    return parts.join('\n');
  }).join('\n');
}

/**
 * Экспорт проектов в Excel
 */
export async function exportProjectsToExcel(projects: any[], filename: string = 'projects.xlsx') {
  const XLSX = await loadXlsx();
  const excelData: ProjectExcelRow[] = projects.map((project, index) => {
    const clientName = project.client?.name || project.clientName || '';
    const contractNumber = project.contract?.number || project.contractNumber || '';
    const contractDate = project.contract?.date || project.contractDate || '';
    const amount = project.contract?.amountWithoutVAT || project.amountWithoutVAT || project.amount || 0;
    const contacts = project.client?.contacts || project.contacts || [];
    
    return {
      '№': index + 1,
      'Название проекта': project.name || clientName || '',
      'Клиент': clientName,
      // Новые поля
      'Наименование': clientName, // Используем то же значение для обратной совместимости
      'Сайт компании': project.client?.website || project.clientWebsite || '',
      'Деятельность': project.client?.activity || project.clientActivity || '',
      'Город': project.client?.city || project.clientCity || project.client?.address || '',
      'Договор №': contractNumber,
      'Номер договора': contractNumber, // Дублируем для обратной совместимости
      'Дата договора': contractDate,
      'Предмет': project.contract?.subject || project.contractSubject || project.description || project.name || '',
      'Контакты': formatContactsForExcel(contacts),
      'Срок оказания услуг': project.contract?.serviceEndDate || project.serviceTerm || '',
      'Сумма (без НДС)': amount,
      'Сумма': amount, // Дублируем для обратной совместимости
      'Валюта': project.currency || 'KZT',
      'Наша компания': project.companyName || project.ourCompany || '',
      'Консорциум?': project.isConsortium ? 'Да' : 'Нет',
      'Доли консорциума': project.isConsortium && project.consortiumMembers
        ? project.consortiumMembers.map((m: any) => `${m.companyName}: ${m.sharePercentage}%`).join('; ')
        : '',
      'Статус': getStatusLabel(project.status),
      'Прогресс %': project.completionPercent || project.completion || 0,
      'Дата создания': project.createdAt || project.created_at ? new Date(project.createdAt || project.created_at).toLocaleDateString('ru-RU') : '',
      'Создал': project.createdByName || project.createdBy || '',
    };
  });

  // Создаем workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(excelData);

  // Настраиваем ширину колонок
  const columnWidths = [
    { wch: 5 },  // №
    { wch: 30 }, // Название проекта
    { wch: 25 }, // Клиент
    { wch: 25 }, // Наименование
    { wch: 25 }, // Сайт компании
    { wch: 20 }, // Деятельность
    { wch: 15 }, // Город
    { wch: 15 }, // Номер договора
    { wch: 15 }, // Договор №
    { wch: 12 }, // Дата договора
    { wch: 40 }, // Предмет
    { wch: 40 }, // Контакты
    { wch: 15 }, // Срок оказания услуг
    { wch: 15 }, // Сумма
    { wch: 15 }, // Сумма (без НДС)
    { wch: 8 },  // Валюта
    { wch: 25 }, // Наша компания
    { wch: 12 }, // Консорциум?
    { wch: 40 }, // Доли консорциума
    { wch: 15 }, // Статус
    { wch: 10 }, // Прогресс %
    { wch: 12 }, // Дата создания
    { wch: 20 }, // Создал
  ];
  ws['!cols'] = columnWidths;

  // Добавляем лист в книгу
  XLSX.utils.book_append_sheet(wb, ws, 'Проекты');

  // Скачиваем файл
  XLSX.writeFile(wb, filename);
}

/**
 * Конвертация Excel серийного номера даты в ISO строку (YYYY-MM-DD)
 */
function excelDateToISO(excelDate: any): string | null {
  if (!excelDate) return null;
  
  // Если это уже строка в формате даты
  if (typeof excelDate === 'string') {
    // Пробуем разные форматы
    const dateFormats = [
      /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
      /^\d{2}\.\d{2}\.\d{4}$/, // DD.MM.YYYY
      /^\d{2}\/\d{2}\/\d{4}$/, // DD/MM/YYYY
      /^\d{4}\/\d{2}\/\d{2}$/, // YYYY/MM/DD
    ];
    
    for (const format of dateFormats) {
      if (format.test(excelDate)) {
        // Парсим DD.MM.YYYY или DD/MM/YYYY
        const parts = excelDate.split(/[.\/]/);
        if (parts.length === 3) {
          let day, month, year;
          if (parts[0].length === 4) {
            // YYYY-MM-DD или YYYY/MM/DD
            year = parts[0];
            month = parts[1].padStart(2, '0');
            day = parts[2].padStart(2, '0');
          } else {
            // DD.MM.YYYY или DD/MM/YYYY
            day = parts[0].padStart(2, '0');
            month = parts[1].padStart(2, '0');
            year = parts[2];
          }
          return `${year}-${month}-${day}`;
        }
        // Если уже YYYY-MM-DD
        if (parts.length === 3 && parts[0].length === 4) {
          return excelDate;
        }
      }
    }
    
    // Если не распознали формат, возвращаем null
    return null;
  }
  
  // Если это число (Excel серийный номер)
  if (typeof excelDate === 'number') {
    // Excel считает от 1 января 1900 года, но есть баг: считает 1900 високосным
    // Реальная разница: Excel epoch - 1 января 1900 (без учета бага)
    // JavaScript epoch - 1 января 1970
    // Разница: 70 лет * 365.25 дней = 25567.5, но из-за бага Excel добавляем 1
    // Точнее: (new Date(1900, 0, 1) - new Date(1899, 11, 30)).getTime() / (1000 * 60 * 60 * 24) = 1
    // Правильная формула: Excel date - 25569 (количество дней между 1899-12-30 и 1970-01-01)
    // Excel серийный номер - это дни от 1 января 1900 (но считает от 0 января 1900 из-за бага)
    // Правильная формула: (excelDate - 1) * 86400000 + excelEpoch.getTime()
    // Но проще использовать стандартную формулу
    const excelEpochDays = 25569; // Дни между 1899-12-30 и 1970-01-01
    const millisecondsPerDay = 86400000;
    const jsDate = new Date((excelDate - excelEpochDays) * millisecondsPerDay);
    
    // Проверяем валидность даты
    if (isNaN(jsDate.getTime())) {
      return null;
    }
    
    // Форматируем в YYYY-MM-DD
    const year = jsDate.getFullYear();
    const month = String(jsDate.getMonth() + 1).padStart(2, '0');
    const day = String(jsDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  return null;
}

/**
 * Парсинг контактов из многострочного текста
 */
function parseContacts(contactsText: string): Array<{
  name: string;
  role?: string;
  phone?: string;
  phone2?: string;
  email?: string;
}> {
  if (!contactsText || !contactsText.trim()) return [];
  
  const contacts: Array<{
    name: string;
    role?: string;
    phone?: string;
    phone2?: string;
    email?: string;
  }> = [];
  
  // Разбиваем по строкам
  const lines = contactsText.split('\n').map(l => l.trim()).filter(l => l);
  
  let currentContact: any = {};
  
  for (const line of lines) {
    // Email
    if (line.toLowerCase().startsWith('email:')) {
      const email = line.substring(6).trim();
      if (email) {
        if (currentContact.name) {
          currentContact.email = email;
          contacts.push({ ...currentContact });
          currentContact = {};
        }
      }
      continue;
    }
    
    // Рабочий телефон
    if (line.toLowerCase().includes('рабочий телефон')) {
      const phone = line.replace(/рабочий телефон/gi, '').trim();
      if (phone) {
        if (currentContact.name) {
          currentContact.phone2 = phone;
        }
      }
      continue;
    }
    
    // Email (без префикса)
    const emailMatch = line.match(/^[\w\.-]+@[\w\.-]+\.\w+$/i);
    if (emailMatch) {
      if (currentContact.name) {
        currentContact.email = emailMatch[0];
        contacts.push({ ...currentContact });
        currentContact = {};
      }
      continue;
    }
    
    // Телефон (8xxx, +7xxx, формат с пробелами/дефисами)
    const phoneMatch = line.match(/([8\+]\s?7?\s?[\d\s\-\(\)]{10,})/);
    if (phoneMatch) {
      const phone = phoneMatch[0].replace(/\s/g, ' ').trim();
      if (currentContact.name) {
        if (!currentContact.phone) {
          currentContact.phone = phone;
        } else {
          currentContact.phone2 = phone;
        }
      }
      continue;
    }
    
    // ФИО - Должность
    const nameRoleMatch = line.match(/^(.+?)\s*-\s*(.+)$/);
    if (nameRoleMatch) {
      // Завершаем предыдущий контакт, если есть
      if (currentContact.name) {
        contacts.push({ ...currentContact });
      }
      currentContact = {
        name: nameRoleMatch[1].trim(),
        role: nameRoleMatch[2].trim(),
      };
      continue;
    }
    
    // Просто ФИО (если это новая строка и нет других паттернов)
    if (!currentContact.name && line.length > 2 && !line.match(/^\d/)) {
      currentContact.name = line;
      continue;
    }
  }
  
  // Добавляем последний контакт
  if (currentContact.name) {
    contacts.push(currentContact);
  }
  
  return contacts;
}

/**
 * Скачать шаблон для импорта
 */
export async function downloadImportTemplate() {
  const XLSX = await loadXlsx();
  const templateData: Partial<ProjectExcelRow>[] = [
    {
      '№': 1,
      'Название проекта': 'Пример проекта',
      'Клиент': 'ТОО "Клиент"',
      'Наименование': 'ТОО "Клиент"',
      'Сайт компании': 'https://example.kz',
      'Деятельность': 'Аудит',
      'Город': 'Алматы',
      'Договор №': '123/2025',
      'Номер договора': '123/2025',
      'Дата договора': '10.01.2025',
      'Предмет': 'Аудит финансовой отчетности за 2024 год',
      'Контакты': 'ПОСОХИНА ТАТЬЯНА СТАНИСЛАВОВНА - Директор ДБУ\n8 701 615 95 53\nВасильева Людмила\nРабочий телефон 87292564890\n+7 701 335 0742\nEmail: lvasileva@maek.kz',
      'Срок оказания услуг': '31.12.2025',
      'Сумма (без НДС)': 5000000,
      'Сумма': 5000000,
      'Валюта': 'KZT',
      'Наша компания': 'RB A+Partners',
      'Консорциум?': 'Нет',
      'Доли консорциума': '',
      'Статус': 'Новый',
      'Прогресс %': 0,
    },
    {
      '№': 2,
      'Название проекта': 'Пример консорциума',
      'Клиент': 'АО "Компания"',
      'Наименование': 'АО "Компания"',
      'Сайт компании': 'https://company.kz',
      'Деятельность': 'IT-аудит',
      'Город': 'Астана',
      'Договор №': '124/2025',
      'Номер договора': '124/2025',
      'Дата договора': '11.01.2025',
      'Предмет': 'IT-аудит информационной безопасности',
      'Контакты': 'ИВАНОВ ИВАН ИВАНОВИЧ - Главный директор\n8 777 123 4567\nEmail: ivanov@company.kz',
      'Срок оказания услуг': '30.11.2025',
      'Сумма (без НДС)': 10000000,
      'Сумма': 10000000,
      'Валюта': 'USD',
      'Наша компания': 'Консорциум',
      'Консорциум?': 'Да',
      'Доли консорциума': 'RB A+Partners: 60%; PARKERRUSSELL: 40%',
      'Статус': 'Новый',
      'Прогресс %': 0,
    },
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(templateData as any);

  // Настраиваем ширину колонок
  const columnWidths = [
    { wch: 5 },  // №
    { wch: 30 }, // Название проекта
    { wch: 25 }, // Клиент
    { wch: 25 }, // Наименование
    { wch: 25 }, // Сайт компании
    { wch: 20 }, // Деятельность
    { wch: 15 }, // Город
    { wch: 15 }, // Номер договора
    { wch: 15 }, // Договор №
    { wch: 12 }, // Дата договора
    { wch: 40 }, // Предмет
    { wch: 40 }, // Контакты
    { wch: 15 }, // Срок оказания услуг
    { wch: 15 }, // Сумма
    { wch: 15 }, // Сумма (без НДС)
    { wch: 8 },  // Валюта
    { wch: 25 }, // Наша компания
    { wch: 12 }, // Консорциум?
    { wch: 40 }, // Доли консорциума
    { wch: 15 }, // Статус
    { wch: 10 }, // Прогресс %
  ];
  ws['!cols'] = columnWidths;

  XLSX.utils.book_append_sheet(wb, ws, 'Шаблон импорта');
  XLSX.writeFile(wb, 'template_import_projects.xlsx');
}

/**
 * Импорт проектов из Excel
 */
export async function importProjectsFromExcel(file: File): Promise<{ projects: any[]; errors: Array<{ row: number; message: string }> }> {
  const XLSX = await loadXlsx();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: ProjectExcelRow[] = XLSX.utils.sheet_to_json(firstSheet);

        const projects: any[] = [];
        const errors: Array<{ row: number; message: string }> = [];

        // Преобразуем строки Excel в объекты проектов
        rows.forEach((row, index) => {
          try {
            const rowNumber = index + 2; // Excel строки начинаются с 2 (заголовок = 1)
            
            // Валидация обязательных полей
            const clientName = row['Наименование'] || row['Клиент'] || '';
            const contractNumber = row['Номер договора'] || row['Договор №'] || '';
            
            if (!clientName) {
              errors.push({ row: rowNumber, message: `Строка ${rowNumber}: отсутствует обязательное поле 'Наименование' или 'Клиент'` });
              return;
            }
            
            if (!contractNumber) {
              errors.push({ row: rowNumber, message: `Строка ${rowNumber}: отсутствует обязательное поле 'Номер договора' или 'Договор №'` });
              return;
            }
            
            const isConsortium = row['Консорциум?']?.toLowerCase() === 'да';
            
            // Парсим доли консорциума
            let consortiumMembers = undefined;
            if (isConsortium && row['Доли консорциума']) {
              const parts = row['Доли консорциума'].split(';').map(s => s.trim());
              consortiumMembers = parts.map(part => {
                const [companyName, shareStr] = part.split(':').map(s => s.trim());
                const sharePercentage = parseFloat(shareStr.replace('%', ''));
                // Нормализуем сумму для консорциума
                const amountRawConsortium = row['Сумма'] || row['Сумма (без НДС)'] || row['Сумма с учетом НДС'] || 0;
                let amountConsortium = 0;
                if (typeof amountRawConsortium === 'number') {
                  amountConsortium = amountRawConsortium;
                } else if (typeof amountRawConsortium === 'string' && amountRawConsortium.trim()) {
                  const cleaned = amountRawConsortium.replace(/[\s,]/g, '');
                  const parsed = parseFloat(cleaned);
                  amountConsortium = isNaN(parsed) ? 0 : parsed;
                } else if (amountRawConsortium) {
                  amountConsortium = Number(amountRawConsortium) || 0;
                }
                const amount = amountConsortium;
                return {
                  companyId: `company-${companyName}`,
                  companyName,
                  sharePercentage,
                  shareAmount: (amount * sharePercentage) / 100,
                };
              });
            }

            // Парсим контакты
            const contactsText = row['Контакты'] || '';
            const parsedContacts = parseContacts(contactsText);

            // Получаем сумму - ПРИОРИТЕТ: сумма с НДС, потом без НДС
            // Если есть сумма с НДС - вычисляем без НДС делением на 1.12
            
            // Функция для проверки что значение не пустое и валидное
            const isValidAmount = (val: any): boolean => {
              if (!val) return false;
              if (typeof val === 'string' && val.trim() === '') return false;
              if (typeof val === 'number' && (isNaN(val) || val === 0)) return false;
              return true;
            };
            
            const amountWithVATRaw = (row['Сумма с учетом НДС'] && isValidAmount(row['Сумма с учетом НДС'])) ? row['Сумма с учетом НДС'] :
                                     (row['Сумма с НДС'] && isValidAmount(row['Сумма с НДС'])) ? row['Сумма с НДС'] :
                                     (row['Сумма с учетом ндс'] && isValidAmount(row['Сумма с учетом ндс'])) ? row['Сумма с учетом ндс'] :
                                     (row['Сумма с ндс'] && isValidAmount(row['Сумма с ндс'])) ? row['Сумма с ндс'] :
                                     null;
            
            const amountWithoutVATRaw = (row['Сумма без учета НДС'] && isValidAmount(row['Сумма без учета НДС'])) ? row['Сумма без учета НДС'] :
                                        (row['Сумма'] && isValidAmount(row['Сумма'])) ? row['Сумма'] : 
                                        (row['Сумма (без НДС)'] && isValidAmount(row['Сумма (без НДС)'])) ? row['Сумма (без НДС)'] :
                                        null;
            
            // Приоритет: если есть сумма С НДС - используем её, иначе без НДС
            let amountRaw = amountWithVATRaw || amountWithoutVATRaw || 0;
            let isAmountWithVAT = !!amountWithVATRaw; // Флаг что это сумма С НДС
            
            // Логирование для отладки
            console.log(`💰 Парсинг суммы для проекта ${row['Наименование'] || row['Клиент']}:`, {
              'Сумма без учета НДС': row['Сумма без учета НДС'],
              'Сумма': row['Сумма'],
              'Сумма (без НДС)': row['Сумма (без НДС)'],
              'Сумма с учетом НДС': row['Сумма с учетом НДС'],
              'Сумма с НДС': row['Сумма с НДС'],
              'isAmountWithVAT': isAmountWithVAT,
              'amountRaw': amountRaw,
              'тип': typeof amountRaw
            });
            
            // Нормализуем: убираем пробелы, запятые, приводим к числу
            let parsedAmount = 0;
            if (typeof amountRaw === 'number' && !isNaN(amountRaw) && isFinite(amountRaw)) {
              parsedAmount = amountRaw;
            } else if (typeof amountRaw === 'string' && amountRaw.trim()) {
              // Убираем все нецифровые символы кроме точки и минуса
              // Сначала убираем пробелы и запятые (разделители тысяч)
              let cleaned = amountRaw.trim()
                .replace(/\s/g, '') // Убираем все пробелы
                .replace(/,/g, ''); // Убираем запятые, заменяем на точки для десятичных
              
              // Если есть точка, проверяем - это разделитель тысяч или десятичная часть
              // Если после точки 3 цифры и больше нечего - это разделитель тысяч
              if (cleaned.includes('.')) {
                const parts = cleaned.split('.');
                if (parts.length === 2 && parts[1].length === 3 && !cleaned.includes(',')) {
                  // Разделитель тысяч - убираем точку
                  cleaned = cleaned.replace(/\./g, '');
                }
              }
              
              // Убираем все, кроме цифр, точки и минуса
              cleaned = cleaned.replace(/[^\d.-]/g, '');
              
              const parsed = parseFloat(cleaned.replace(',', '.'));
              if (!isNaN(parsed) && isFinite(parsed) && parsed > 0) {
                parsedAmount = parsed;
              } else {
                console.warn('⚠️ Не удалось распарсить сумму:', amountRaw, '→ очищено:', cleaned, '→ результат:', parsed);
              }
            } else if (amountRaw) {
              const num = Number(amountRaw);
              if (!isNaN(num) && isFinite(num) && num > 0) {
                parsedAmount = num;
              }
            }
            
            // Если исходная сумма была С НДС - вычисляем без НДС
            let amountWithoutVAT = parsedAmount;
            let amountWithVAT = parsedAmount;
            
            if (isAmountWithVAT && parsedAmount > 0) {
              // Исходная сумма с НДС - вычисляем без НДС (делим на 1.12)
              amountWithoutVAT = parsedAmount / 1.12;
              amountWithVAT = parsedAmount;
              console.log(`✅ Сумма С НДС распознана: ${amountWithVAT.toLocaleString('ru-RU')}, без НДС: ${amountWithoutVAT.toLocaleString('ru-RU')} для ${row['Наименование'] || row['Клиент']}`);
            } else if (parsedAmount > 0) {
              // Исходная сумма без НДС - вычисляем с НДС (умножаем на 1.12)
              amountWithoutVAT = parsedAmount;
              amountWithVAT = parsedAmount * 1.12;
              console.log(`✅ Сумма БЕЗ НДС распознана: ${amountWithoutVAT.toLocaleString('ru-RU')}, с НДС: ${amountWithVAT.toLocaleString('ru-RU')} для ${row['Наименование'] || row['Клиент']}`);
            }

            // Получаем предмет договора
            const contractSubject = row['Предмет'] || row['Название проекта'] || '';

            // Получаем и конвертируем даты из Excel
            const contractDateRaw = row['Дата договора'] || '';
            const serviceEndDateRaw = row['Срок оказания услуг'] || contractDateRaw || '';
            
            // Конвертируем Excel даты в ISO формат
            const contractDateISO = excelDateToISO(contractDateRaw) || new Date().toISOString().split('T')[0];
            const serviceEndDateISO = excelDateToISO(serviceEndDateRaw) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const serviceStartDateISO = new Date().toISOString().split('T')[0]; // Начало = сегодня

            const project = {
              id: `proj_import_${Date.now()}_${index}`,
              name: row['Название проекта'] || clientName,
              clientName: clientName,
              type: 'audit' as const,
              
              isConsortium,
              companyId: isConsortium ? undefined : 'comp-rb-a',
              companyName: row['Наша компания'] || '',
              ourCompany: row['Наша компания'] || '',
              consortiumMembers,
              
              // status удален - он будет в notes
              completionPercent: row['Прогресс %'] || 0,
              
              // Валюта
              currency: row['Валюта'] || 'KZT',
              amountWithoutVAT: amountWithoutVAT,
              amount: amountWithoutVAT,
              
              // Новые поля клиента
              clientWebsite: row['Сайт компании'] || '',
              clientActivity: row['Деятельность'] || '',
              clientCity: row['Город'] || '',
              
              client: {
                name: clientName,
                website: row['Сайт компании'] || '',
                activity: row['Деятельность'] || '',
                city: row['Город'] || '',
                contacts: parsedContacts,
              },
              
              contractNumber: contractNumber,
              contractDate: contractDateISO,
              contractSubject: contractSubject,
              serviceTerm: serviceEndDateISO,
              
              contract: {
                number: contractNumber,
                date: contractDateISO,
                subject: contractSubject,
                serviceStartDate: serviceStartDateISO,
                serviceEndDate: serviceEndDateISO,
                amountWithoutVAT: amountWithoutVAT,
              },
              
              team: [],
              tasks: [],
              kpiRatings: [],
              
              finances: {
                amountWithoutVAT: amountWithoutVAT, // Без НДС (рассчитанная)
                amountWithVAT: amountWithVAT, // С НДС (из Excel или рассчитанная)
                preExpensePercent: 30,
                preExpenseAmount: amountWithoutVAT * 0.3,
                contractors: [],
                totalContractorsAmount: 0,
                bonusBase: amountWithoutVAT * 0.7,
                bonusPercent: 10,
                totalBonusAmount: amountWithoutVAT * 0.7 * 0.1,
                teamBonuses: {},
                totalPaidBonuses: 0,
                totalCosts: amountWithoutVAT * 0.3,
                grossProfit: amountWithoutVAT * 0.7,
                profitMargin: 70,
                
                consortiumFinances: consortiumMembers,
              },
              
              // Сохраняем суммы на верхнем уровне для быстрого доступа
              amountWithVAT: amountWithVAT,
              
              financeChangeLogs: [],
              
              createdBy: 'import',
              createdByName: 'Импорт из Excel',
              createdAt: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              
              // Импортированные проекты должны быть на утверждении
              status: 'new', // В notes.status ставим 'new' для утверждения
            };

            // Логирование суммы для отладки
            if (import.meta.env.DEV) {
              console.log(`📊 Импорт проекта ${project.name}:`, {
                amountRaw,
                amountWithoutVAT,
                amountWithVAT,
                finances: project.finances?.amountWithoutVAT,
                contract: project.contract?.amountWithoutVAT
              });
            }
            
            projects.push(project);
          } catch (error: any) {
            errors.push({ row: index + 2, message: `Строка ${index + 2}: ${error?.message || 'Неизвестная ошибка'}` });
          }
        });

        resolve({ projects, errors });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Ошибка чтения файла'));
    reader.readAsBinaryString(file);
  });
}

/**
 * Сохранить импортированные проекты в Supabase
 */
export async function saveImportedProjects(projects: any[]): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const project of projects) {
    try {
      await supabaseDataStore.createProject(project);
      success++;
      console.log('✅ Imported project:', project.name);
    } catch (error) {
      console.error('❌ Failed to import project:', project.name, error);
      failed++;
    }
  }

  return { success, failed };
}

// Вспомогательная функция для получения названия статуса
function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    'new': 'Новый',
    'approval': 'На утверждении',
    'planning': 'Планирование',
    'in_progress': 'В работе',
    'review': 'На проверке',
    'completed': 'Завершен',
    'cancelled': 'Отменен',
  };
  return labels[status] || status;
}

