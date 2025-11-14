/**
 * Генератор брендированных PDF документов для шаблонов аудита
 * Использует pdfmake через глобальный объект window (загружается через CDN)
 */

// Типы для глобального pdfmake
declare global {
  interface Window {
    pdfMake: any;
  }
}

// Цвета брендинга Russell Bedford
const BRAND_COLORS = {
  primary: '#1a365d',      // Темно-синий
  secondary: '#2c5282',     // Синий
  accent: '#3182ce',        // Светло-синий
  text: '#1a202c',          // Темный текст
  lightText: '#718096',     // Светлый текст
  border: '#e2e8f0'         // Светлая граница
};

/**
 * Ожидает загрузки pdfmake из CDN
 */
function waitForPdfMake(maxAttempts = 50, interval = 100): Promise<any> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    const checkPdfMake = () => {
      if (typeof window !== 'undefined' && window.pdfMake) {
        resolve(window.pdfMake);
        return;
      }
      
      attempts++;
      if (attempts >= maxAttempts) {
        reject(new Error('PDFMake не загрузился. Убедитесь, что скрипты загружены.'));
        return;
      }
      
      setTimeout(checkPdfMake, interval);
    };
    
    checkPdfMake();
  });
}

/**
 * Генерирует брендированный PDF для шаблона аудита
 */
export async function generateBrandedPDF(template: {
  name: string;
  description: string;
  category: string;
  requiredRole: string;
  fileType: string;
  isRequired: boolean;
  fileName: string;
}): Promise<void> {
  // Ждем загрузки pdfmake
  let pdfMake: any;
  try {
    pdfMake = await waitForPdfMake();
  } catch (error) {
    console.error('Ошибка загрузки PDFMake:', error);
    alert('PDFMake не загружен. Пожалуйста, обновите страницу и подождите загрузки скриптов.');
    return;
  }

  const docDefinition: any = {
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 60],
    defaultStyle: {
      font: 'Roboto',
      fontSize: 10,
      color: BRAND_COLORS.text
    },
    header: {
      margin: [40, 20, 40, 0],
      columns: [
        {
          width: '*',
          stack: [
            {
              text: 'RB A+Partners',
              fontSize: 20,
              bold: true,
              color: '#ffffff',
              margin: [0, 0, 0, 5]
            },
            {
              text: 'Russell Bedford Network',
              fontSize: 9,
              color: '#ffffff',
              opacity: 0.9
            }
          ]
        },
        {
          width: 'auto',
          text: `Дата: ${new Date().toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          })}`,
          fontSize: 9,
          color: '#ffffff',
          alignment: 'right',
          margin: [0, 0, 0, 0]
        }
      ],
      background: [
        {
          canvas: [
            {
              type: 'rect',
              x: 0,
              y: 0,
              w: 595, // A4 width in points
              h: 50,
              color: BRAND_COLORS.primary
            }
          ]
        }
      ]
    },
    content: [
      // Заголовок шаблона
      {
        text: template.name,
        fontSize: 18,
        bold: true,
        color: BRAND_COLORS.primary,
        margin: [0, 0, 0, 10]
      },
      // Линия под заголовком
      {
        canvas: [
          {
            type: 'line',
            x1: 0,
            y1: 0,
            x2: 515,
            y2: 0,
            lineWidth: 1,
            lineColor: BRAND_COLORS.accent
          }
        ],
        margin: [0, 0, 0, 15]
      },
      // Описание
      {
        text: template.description,
        fontSize: 11,
        margin: [0, 0, 0, 20],
        lineHeight: 1.5
      },
      // Информация о шаблоне
      {
        text: 'Информация о шаблоне',
        fontSize: 12,
        bold: true,
        color: BRAND_COLORS.primary,
        margin: [0, 0, 0, 10]
      },
      {
        columns: [
          {
            width: 'auto',
            text: [
              { text: 'Категория: ', bold: true },
              { text: getCategoryLabel(template.category) }
            ],
            margin: [0, 0, 0, 7]
          }
        ]
      },
      {
        columns: [
          {
            width: 'auto',
            text: [
              { text: 'Роль исполнителя: ', bold: true },
              { text: getRoleLabel(template.requiredRole) }
            ],
            margin: [0, 0, 0, 7]
          }
        ]
      },
      {
        columns: [
          {
            width: 'auto',
            text: [
              { text: 'Тип файла: ', bold: true },
              { text: template.fileType.toUpperCase() }
            ],
            margin: [0, 0, 0, 7]
          }
        ]
      },
      {
        columns: [
          {
            width: 'auto',
            text: [
              { text: 'Обязательный: ', bold: true },
              { text: template.isRequired ? 'Да' : 'Нет' }
            ],
            margin: [0, 0, 0, 15]
          }
        ]
      },
      // Содержимое шаблона
      {
        text: 'Содержимое шаблона',
        fontSize: 12,
        bold: true,
        color: BRAND_COLORS.primary,
        margin: [0, 10, 0, 10]
      },
      {
        text: generateTemplateContent(template),
        fontSize: 10,
        lineHeight: 1.6,
        margin: [0, 0, 0, 20]
      }
    ],
    footer: function(currentPage: number, pageCount: number) {
      return {
        margin: [40, 10, 40, 0],
        columns: [
          {
            text: `RB A+Partners | Шаблон аудита | Страница ${currentPage} из ${pageCount}`,
            fontSize: 8,
            color: BRAND_COLORS.lightText,
            alignment: 'left'
          },
          {
            text: `© ${new Date().getFullYear()} Russell Bedford International`,
            fontSize: 8,
            color: BRAND_COLORS.lightText,
            alignment: 'right'
          }
        ],
        canvas: [
          {
            type: 'line',
            x1: 0,
            y1: 0,
            x2: 515,
            y2: 0,
            lineWidth: 0.3,
            lineColor: BRAND_COLORS.border
          }
        ]
      };
    },
    styles: {
      header: {
        fontSize: 18,
        bold: true,
        color: BRAND_COLORS.primary
      },
      subheader: {
        fontSize: 14,
        bold: true,
        margin: [0, 10, 0, 5]
      },
      quote: {
        italics: true
      },
      small: {
        fontSize: 8
      }
    }
  };

  // Создаем и скачиваем PDF
  const fileName = template.fileName.replace(/\.(doc|docx|xls|xlsx)$/i, '.pdf');
  
  try {
    const pdfDocGenerator = pdfMake.createPdf(docDefinition);
    pdfDocGenerator.download(fileName);
  } catch (error) {
    console.error('Ошибка генерации PDF:', error);
    alert('Ошибка при создании PDF. Пожалуйста, попробуйте еще раз.');
    throw error;
  }
}

/**
 * Получает читаемое название категории
 */
function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    'general': 'Общие рабочие файлы',
    'planning': 'Планирование',
    'risk-assessment': 'Оценка рисков',
    'controls': 'Контроли',
    'substantive': 'Субстантивные процедуры',
    'completion': 'Завершение'
  };
  return labels[category] || category;
}

/**
 * Получает читаемое название роли
 */
function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    'partner': 'Партнер',
    'manager': 'Менеджер проекта',
    'senior_auditor': 'Старший аудитор',
    'assistant': 'Ассистент',
    'tax_specialist': 'Налоговый специалист'
  };
  return labels[role] || role;
}

/**
 * Генерирует содержимое шаблона в зависимости от категории
 */
function generateTemplateContent(template: {
  name: string;
  category: string;
  description: string;
}): string {
  const baseContent = `Данный шаблон предназначен для использования в процессе аудита финансовой отчетности в соответствии с методологией Russell Bedford.

${template.description}

Шаблон содержит структурированные разделы для заполнения в ходе аудиторских процедур.`;

  // Добавляем специфичное содержимое в зависимости от категории
  let specificContent = '';

  switch (template.category) {
    case 'general':
      specificContent = `

РАЗДЕЛЫ ШАБЛОНА:
1. Общая информация о проекте
2. Содержание документации
3. Список ключевых процессов
4. Сводка запросов и ответов
5. Чек-листы проверки`;
      break;

    case 'planning':
      specificContent = `

РАЗДЕЛЫ ШАБЛОНА:
1. Планирование аудита
2. Оценка существенности
3. Распределение ресурсов
4. График выполнения работ
5. Предварительная оценка рисков`;
      break;

    case 'risk-assessment':
      specificContent = `

РАЗДЕЛЫ ШАБЛОНА:
1. Идентификация рисков
2. Оценка вероятности и воздействия
3. Матрица рисков
4. Меры реагирования на риски
5. Связь рисков с утверждениями`;
      break;

    case 'controls':
      specificContent = `

РАЗДЕЛЫ ШАБЛОНА:
1. Описание системы внутреннего контроля
2. Тестирование контролей
3. Выявленные недостатки
4. Оценка эффективности
5. Рекомендации по улучшению`;
      break;

    case 'substantive':
      specificContent = `

РАЗДЕЛЫ ШАБЛОНА:
1. Аналитические процедуры
2. Тесты деталей
3. Внешние подтверждения
4. Выявленные искажения
5. Выводы по утверждениям`;
      break;

    case 'completion':
      specificContent = `

РАЗДЕЛЫ ШАБЛОНА:
1. Финальный обзор документации
2. Анализ неисправленных искажений
3. Заключительные аналитические процедуры
4. Письменные представления руководства
5. Подготовка к формированию заключения`;
      break;

    default:
      specificContent = `

РАЗДЕЛЫ ШАБЛОНА:
1. Введение
2. Основные разделы
3. Заключение
4. Приложения`;
  }

  return baseContent + specificContent;
}
