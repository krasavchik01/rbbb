/**
 * Утилиты для импорта и экспорта проектов в Excel
 */

import * as XLSX from 'xlsx';

// Интерфейс для проекта (упрощенный для Excel)
export interface ProjectExcelRow {
  '№': number;
  'Название проекта': string;
  'Клиент': string;
  'Договор №': string;
  'Дата договора': string;
  'Сумма (без НДС)': number;
  'Наша компания': string;
  'Консорциум?': string;
  'Доли консорциума': string;
  'Статус': string;
  'Прогресс %': number;
  'Дата создания': string;
  'Создал': string;
}

/**
 * Экспорт проектов в Excel
 */
export function exportProjectsToExcel(projects: any[], filename: string = 'projects.xlsx') {
  const excelData: ProjectExcelRow[] = projects.map((project, index) => ({
    '№': index + 1,
    'Название проекта': project.name || '',
    'Клиент': project.client?.name || '',
    'Договор №': project.contract?.number || '',
    'Дата договора': project.contract?.date || '',
    'Сумма (без НДС)': project.contract?.amountWithoutVAT || 0,
    'Наша компания': project.companyName || '',
    'Консорциум?': project.isConsortium ? 'Да' : 'Нет',
    'Доли консорциума': project.isConsortium && project.consortiumMembers
      ? project.consortiumMembers.map((m: any) => `${m.companyName}: ${m.sharePercentage}%`).join('; ')
      : '',
    'Статус': getStatusLabel(project.status),
    'Прогресс %': project.completionPercent || 0,
    'Дата создания': project.createdAt ? new Date(project.createdAt).toLocaleDateString('ru-RU') : '',
    'Создал': project.createdByName || '',
  }));

  // Создаем workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(excelData);

  // Настраиваем ширину колонок
  const columnWidths = [
    { wch: 5 },  // №
    { wch: 30 }, // Название проекта
    { wch: 25 }, // Клиент
    { wch: 15 }, // Договор №
    { wch: 12 }, // Дата договора
    { wch: 15 }, // Сумма
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
 * Скачать шаблон для импорта
 */
export function downloadImportTemplate() {
  const templateData: Partial<ProjectExcelRow>[] = [
    {
      '№': 1,
      'Название проекта': 'Пример проекта',
      'Клиент': 'ТОО "Клиент"',
      'Договор №': '123/2025',
      'Дата договора': '10.01.2025',
      'Сумма (без НДС)': 5000000,
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
      'Договор №': '124/2025',
      'Дата договора': '11.01.2025',
      'Сумма (без НДС)': 10000000,
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
    { wch: 15 }, // Договор №
    { wch: 12 }, // Дата договора
    { wch: 15 }, // Сумма
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
export function importProjectsFromExcel(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: ProjectExcelRow[] = XLSX.utils.sheet_to_json(firstSheet);

        // Преобразуем строки Excel в объекты проектов
        const projects = rows.map((row, index) => {
          const isConsortium = row['Консорциум?']?.toLowerCase() === 'да';
          
          // Парсим доли консорциума
          let consortiumMembers = undefined;
          if (isConsortium && row['Доли консорциума']) {
            const parts = row['Доли консорциума'].split(';').map(s => s.trim());
            consortiumMembers = parts.map(part => {
              const [companyName, shareStr] = part.split(':').map(s => s.trim());
              const sharePercentage = parseFloat(shareStr.replace('%', ''));
              return {
                companyId: `company-${companyName}`,
                companyName,
                sharePercentage,
                shareAmount: (row['Сумма (без НДС)'] * sharePercentage) / 100,
              };
            });
          }

          return {
            id: `proj_import_${Date.now()}_${index}`,
            name: row['Название проекта'],
            type: 'audit' as const,
            
            isConsortium,
            companyId: isConsortium ? undefined : 'comp-rb-a',
            companyName: row['Наша компания'],
            consortiumMembers,
            
            status: 'new' as const,
            completionPercent: row['Прогресс %'] || 0,
            
            client: {
              name: row['Клиент'],
              contacts: [],
            },
            
            contract: {
              number: row['Договор №'],
              date: row['Дата договора'],
              subject: row['Название проекта'],
              serviceStartDate: new Date().toISOString().split('T')[0],
              serviceEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              amountWithoutVAT: row['Сумма (без НДС)'],
            },
            
            team: [],
            tasks: [],
            kpiRatings: [],
            
            finances: {
              amountWithoutVAT: row['Сумма (без НДС)'],
              preExpensePercent: 30,
              preExpenseAmount: row['Сумма (без НДС)'] * 0.3,
              contractors: [],
              totalContractorsAmount: 0,
              bonusBase: row['Сумма (без НДС)'] * 0.7,
              bonusPercent: 50,
              totalBonusAmount: row['Сумма (без НДС)'] * 0.7 * 0.5,
              teamBonuses: {},
              totalPaidBonuses: 0,
              totalCosts: row['Сумма (без НДС)'] * 0.3,
              grossProfit: row['Сумма (без НДС)'] * 0.7,
              profitMargin: 70,
              
              consortiumFinances: consortiumMembers,
            },
            
            financeChangeLogs: [],
            
            createdBy: 'import',
            createdByName: 'Импорт из Excel',
            createdAt: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        });

        resolve(projects);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Ошибка чтения файла'));
    reader.readAsBinaryString(file);
  });
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

