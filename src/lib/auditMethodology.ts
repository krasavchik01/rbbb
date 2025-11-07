/**
 * Методология аудита Russell Bedford
 * 7 этапов аудиторского процесса
 */

import { ProjectTemplate, ProjectStage, ProcedureElement } from '@/types/methodology';

export const RUSSELL_BEDFORD_AUDIT_METHODOLOGY: ProjectTemplate = {
  id: 'rb-audit-methodology-v1',
  name: 'Методология аудита Russell Bedford',
  description: 'Полная методология проведения аудита финансовой отчётности по стандартам Russell Bedford с риск-ориентированным подходом',
  category: 'Финансовый аудит',
  
  customFields: [
    {
      id: 'cf-client-name',
      name: 'client_name',
      label: 'Наименование клиента',
      type: 'text',
      required: true,
      placeholder: 'ТОО "Компания"',
      order: 1
    },
    {
      id: 'cf-reporting-period',
      name: 'reporting_period',
      label: 'Отчётный период',
      type: 'text',
      required: true,
      placeholder: '2024',
      order: 2
    },
    {
      id: 'cf-reporting-standard',
      name: 'reporting_standard',
      label: 'Стандарт отчётности',
      type: 'select',
      required: true,
      options: ['МСФО', 'РСБУ', 'US GAAP'],
      order: 3
    },
    {
      id: 'cf-partner',
      name: 'partner',
      label: 'Партнёр по проекту',
      type: 'user',
      required: true,
      order: 4
    },
    {
      id: 'cf-materiality',
      name: 'materiality',
      label: 'Уровень существенности',
      type: 'number',
      required: false,
      placeholder: '5000000',
      order: 5
    }
  ],
  
  stages: [
    {
      id: 'stage-1',
      name: 'Принятие и продолжение отношений с клиентом',
      description: 'Оценить возможность принятия или продолжения аудиторского задания',
      order: 1,
      color: '#3b82f6',
      elements: [
        {
          id: 'el-1-1',
          type: 'header',
          title: '1. Проверка независимости',
          required: false,
          order: 1
        },
        {
          id: 'el-1-2',
          type: 'procedure',
          title: 'Проверка независимости всех участников команды и фирмы',
          description: 'Проверьте всех участников команды на отсутствие конфликтов интересов',
          required: true,
          order: 2
        },
        {
          id: 'el-1-3',
          type: 'question',
          title: 'Оценка рисков клиента',
          question: 'Оцените финансовое положение, репутацию и отраслевые факторы клиента',
          required: true,
          order: 3
        },
        {
          id: 'el-1-4',
          type: 'procedure',
          title: 'Оценка компетенций и ресурсов для задания',
          description: 'Оцените наличие необходимых компетенций и ресурсов для выполнения задания',
          required: true,
          order: 4
        },
        {
          id: 'el-1-5',
          type: 'file',
          title: 'Письмо-обязательство',
          required: true,
          order: 5,
          config: {
            allowedFileTypes: ['.pdf', '.docx'],
            maxFileSize: 10
          }
        },
        {
          id: 'el-1-6',
          type: 'signature',
          title: 'Утверждение партнёром',
          required: true,
          requiredRole: 'partner',
          order: 6
        }
      ]
    },
    {
      id: 'stage-2',
      name: 'Планирование аудита',
      description: 'Разработать стратегию аудита, определить объём, сроки и ресурсы',
      order: 2,
      color: '#10b981',
      elements: [
        {
          id: 'el-2-1',
          type: 'header',
          title: '2. Анализ бизнеса клиента',
          required: false,
          order: 1
        },
        {
          id: 'el-2-2',
          type: 'procedure',
          title: 'Сбор информации о бизнесе, целях, стратегиях и внешней среде',
          description: 'Проведите анализ отрасли, рынка и специфики бизнеса клиента',
          required: true,
          order: 2
        },
        {
          id: 'el-2-3',
          type: 'question',
          title: 'Предварительная оценка существенности',
          question: 'Какой уровень существенности установлен для данного аудита?',
          required: true,
          order: 3
        },
        {
          id: 'el-2-4',
          type: 'procedure',
          title: 'Планирование состава команды и распределение задач',
          description: 'Определите состав команды, распределите задачи и установите сроки',
          required: true,
          order: 4
        },
        {
          id: 'el-2-5',
          type: 'procedure',
          title: 'Интеграция с оценкой внутреннего контроля',
          description: 'Учтите предыдущий опыт с клиентом для продолжения',
          required: false,
          order: 5
        }
      ]
    },
    {
      id: 'stage-3',
      name: 'Оценка рисков и разработка стратегии',
      description: 'Выявить и оценить риски существенных искажений',
      order: 3,
      color: '#f59e0b',
      elements: [
        {
          id: 'el-3-1',
          type: 'header',
          title: '3. Идентификация рисков',
          required: false,
          order: 1
        },
        {
          id: 'el-3-2',
          type: 'procedure',
          title: 'Анализ внешних и внутренних факторов',
          description: 'Проанализируйте отрасль, регуляторные условия, цели и стратегии клиента',
          required: true,
          order: 2
        },
        {
          id: 'el-3-3',
          type: 'question',
          title: 'Риски мошенничества и связанных сторон',
          question: 'Выявлены ли риски мошенничества или связанных сторон?',
          required: true,
          order: 3
        },
        {
          id: 'el-3-4',
          type: 'procedure',
          title: 'Разработка мер реагирования на риски',
          description: 'Разработайте стратегию аудита с мерами реагирования на выявленные риски',
          required: true,
          order: 4
        },
        {
          id: 'el-3-5',
          type: 'procedure',
          title: 'Использование аналитических процедур',
          description: 'Выполните аналитические процедуры для предварительного выявления аномалий',
          required: false,
          order: 5
        },
        {
          id: 'el-3-6',
          type: 'signature',
          title: 'Утверждение стратегии партнёром',
          required: true,
          requiredRole: 'partner',
          order: 6
        }
      ]
    },
    {
      id: 'stage-4',
      name: 'Изучение и тестирование системы внутреннего контроля',
      description: 'Получить понимание системы внутреннего контроля и оценить её эффективность',
      order: 4,
      color: '#8b5cf6',
      elements: [
        {
          id: 'el-4-1',
          type: 'header',
          title: '4. Описание системы внутреннего контроля',
          required: false,
          order: 1
        },
        {
          id: 'el-4-2',
          type: 'procedure',
          title: 'Описание ключевых компонентов контроля',
          description: 'Опишите контрольную среду, процессы оценки рисков, информационные системы',
          required: true,
          order: 2
        },
        {
          id: 'el-4-3',
          type: 'procedure',
          title: 'Проведение сквозных проверок процессов',
          description: 'Проведите сквозные проверки для подтверждения понимания на практике',
          required: true,
          order: 3
        },
        {
          id: 'el-4-4',
          type: 'procedure',
          title: 'Тестирование операционной эффективности контролей',
          description: 'Выполните выборочные тесты, запросы и наблюдения',
          required: true,
          order: 4
        },
        {
          id: 'el-4-5',
          type: 'question',
          title: 'Анализ выявленных недостатков',
          question: 'Опишите выявленные недостатки и их влияние на риски существенных искажений',
          required: true,
          order: 5
        },
        {
          id: 'el-4-6',
          type: 'procedure',
          title: 'Корректировка стратегии аудита',
          description: 'Скорректируйте стратегию аудита и план процедур на основе результатов',
          required: false,
          order: 6
        }
      ]
    },
    {
      id: 'stage-5',
      name: 'Проведение субстантивных процедур',
      description: 'Собрать достаточные аудиторские доказательства',
      order: 5,
      color: '#ef4444',
      elements: [
        {
          id: 'el-5-1',
          type: 'header',
          title: '5. Аналитические процедуры',
          required: false,
          order: 1
        },
        {
          id: 'el-5-2',
          type: 'procedure',
          title: 'Выполнение аналитических процедур',
          description: 'Выполните аналитические процедуры для выявления необычных отклонений',
          required: true,
          order: 2
        },
        {
          id: 'el-5-3',
          type: 'procedure',
          title: 'Тесты деталей',
          description: 'Проведите внешние подтверждения, выборочные проверки, пересчёты и инспекции',
          required: true,
          order: 3
        },
        {
          id: 'el-5-4',
          type: 'question',
          title: 'Тестирование бухгалтерских оценок',
          question: 'Проверены ли бухгалтерские оценки, раскрытия информации и специальные области?',
          required: true,
          order: 4
        },
        {
          id: 'el-5-5',
          type: 'procedure',
          title: 'Анализ выявленных искажений',
          description: 'Проанализируйте выявленные искажения и их проекцию на генеральную совокупность',
          required: true,
          order: 5
        },
        {
          id: 'el-5-6',
          type: 'file',
          title: 'Рабочие файлы с доказательствами',
          required: true,
          order: 6,
          config: {
            multipleFiles: true,
            allowedFileTypes: ['.pdf', '.xlsx', '.docx'],
            maxFileSize: 50
          }
        }
      ]
    },
    {
      id: 'stage-6',
      name: 'Завершение аудита и обзор выполненных процедур',
      description: 'Подтвердить полноту и качество всех выполненных процедур',
      order: 6,
      color: '#06b6d4',
      elements: [
        {
          id: 'el-6-1',
          type: 'header',
          title: '6. Финальный обзор',
          required: false,
          order: 1
        },
        {
          id: 'el-6-2',
          type: 'procedure',
          title: 'Обзор аудиторской документации',
          description: 'Проведите финальный обзор документации на предмет полноты и точности',
          required: true,
          order: 2
        },
        {
          id: 'el-6-3',
          type: 'question',
          title: 'Анализ неисправленных искажений',
          question: 'Оцените совокупное влияние неисправленных искажений на финансовую отчётность',
          required: true,
          order: 3
        },
        {
          id: 'el-6-4',
          type: 'procedure',
          title: 'Получение письменных представлений от руководства',
          description: 'Получите письменные представления от руководства клиента',
          required: true,
          order: 4
        },
        {
          id: 'el-6-5',
          type: 'procedure',
          title: 'Проведение заключительных аналитических процедур',
          description: 'Проведите заключительные аналитические процедуры для подтверждения соответствия',
          required: false,
          order: 5
        },
        {
          id: 'el-6-6',
          type: 'signature',
          title: 'Контроль качества партнёром',
          required: true,
          requiredRole: 'partner',
          order: 6
        }
      ]
    },
    {
      id: 'stage-7',
      name: 'Подготовка аудиторского заключения и архивирование',
      description: 'Сформировать аудиторское мнение и обеспечить хранение документации',
      order: 7,
      color: '#84cc16',
      elements: [
        {
          id: 'el-7-1',
          type: 'header',
          title: '7. Формирование заключения',
          required: false,
          order: 1
        },
        {
          id: 'el-7-2',
          type: 'question',
          title: 'Тип аудиторского мнения',
          question: 'Какой тип мнения будет сформирован? (безоговорочное, с оговоркой, отрицательное)',
          required: true,
          order: 2
        },
        {
          id: 'el-7-3',
          type: 'file',
          title: 'Аудиторское заключение',
          required: true,
          order: 3,
          config: {
            allowedFileTypes: ['.pdf', '.docx'],
            maxFileSize: 10
          }
        },
        {
          id: 'el-7-4',
          type: 'procedure',
          title: 'Коммуникация результатов с руководством клиента',
          description: 'Коммуникация результатов с руководством клиента и аудиторским комитетом',
          required: true,
          order: 4
        },
        {
          id: 'el-7-5',
          type: 'procedure',
          title: 'Архивирование аудиторских файлов',
          description: 'Обеспечьте надлежащее архивирование всех файлов с учётом сроков хранения',
          required: true,
          order: 5
        },
        {
          id: 'el-7-6',
          type: 'signature',
          title: 'Подписание заключения партнёром',
          required: true,
          requiredRole: 'partner',
          order: 6
        }
      ]
    }
  ],
  
  routingSettings: {
    defaultApprovalRole: 'partner',
    notifyOnCreation: true,
    allowedRoles: ['partner', 'manager'] as const
  },
  
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  created_by: 'system',
  version: 1,
  isActive: true,
  usageCount: 0
};

