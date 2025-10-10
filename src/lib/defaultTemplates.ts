/**
 * Предустановленные шаблоны методологий
 * МСА (Международные стандарты аудита)
 * МСФО (Международные стандарты финансовой отчетности)
 * Оценка (International Valuation Standards)
 * Налоговый консалтинг
 */

export interface TemplateField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'dropdown' | 'user';
  required: boolean;
  options?: string[]; // Для dropdown
}

export interface ProcedureElement {
  id: string;
  type: 'header' | 'qa' | 'procedure' | 'file_upload' | 'digital_signature';
  title: string;
  content?: string;
  required: boolean;
  roleBinding?: string; // Роль, которая должна выполнить
}

export interface WorkStage {
  id: string;
  name: string;
  order: number;
  procedures: ProcedureElement[];
}

export interface Template {
  id: string;
  name: string;
  description: string;
  category: 'audit' | 'consulting' | 'valuation' | 'tax';
  customFields: TemplateField[];
  workStages: WorkStage[];
  defaultApprovalRole: string;
  createdAt: string;
}

// 🔹 МСА - АУДИТ ФИНАНСОВОЙ ОТЧЕТНОСТИ
export const MSA_AUDIT_TEMPLATE: Template = {
  id: 'msa-audit-2024',
  name: 'МСА: Аудит финансовой отчетности',
  description: 'Полный цикл аудита по Международным стандартам аудита (ISA)',
  category: 'audit',
  customFields: [
    { id: 'period', name: 'Отчетный период', type: 'text', required: true },
    { id: 'standards', name: 'Применяемые стандарты', type: 'dropdown', required: true, options: ['МСФО', 'НСФО РК', 'US GAAP'] },
    { id: 'materiality', name: 'Уровень существенности (тг)', type: 'number', required: true },
    { id: 'risk_assessment', name: 'Оценка рисков', type: 'dropdown', required: true, options: ['Низкий', 'Средний', 'Высокий'] },
  ],
  workStages: [
    {
      id: 'stage-1',
      name: '1. Планирование и оценка рисков',
      order: 1,
      procedures: [
        { id: 'proc-1-1', type: 'header', title: 'Понимание деятельности клиента', content: '', required: true },
        { id: 'proc-1-2', type: 'qa', title: 'Анализ отрасли и бизнес-модели', content: 'Опишите основные риски отрасли', required: true, roleBinding: 'supervisor_1' },
        { id: 'proc-1-3', type: 'procedure', title: 'Оценка систем внутреннего контроля', content: 'Оценить эффективность СВК', required: true, roleBinding: 'supervisor_1' },
        { id: 'proc-1-4', type: 'file_upload', title: 'Загрузка аудиторского плана', content: '', required: true, roleBinding: 'partner' },
        { id: 'proc-1-5', type: 'digital_signature', title: 'Утверждение плана аудита', content: '', required: true, roleBinding: 'partner' },
      ],
    },
    {
      id: 'stage-2',
      name: '2. Тестирование контролей',
      order: 2,
      procedures: [
        { id: 'proc-2-1', type: 'header', title: 'Тесты контролей по циклам', content: '', required: true },
        { id: 'proc-2-2', type: 'procedure', title: 'Цикл продаж и дебиторской задолженности', content: 'Выполнить тесты контролей', required: true, roleBinding: 'assistant_1' },
        { id: 'proc-2-3', type: 'procedure', title: 'Цикл закупок и кредиторской задолженности', content: 'Выполнить тесты контролей', required: true, roleBinding: 'assistant_1' },
        { id: 'proc-2-4', type: 'procedure', title: 'Цикл зарплаты и персонала', content: 'Выполнить тесты контролей', required: true, roleBinding: 'assistant_2' },
        { id: 'proc-2-5', type: 'file_upload', title: 'Загрузка рабочих документов', content: '', required: true, roleBinding: 'assistant_1' },
        { id: 'proc-2-6', type: 'digital_signature', title: 'Проверка супервайзером', content: '', required: true, roleBinding: 'supervisor_1' },
      ],
    },
    {
      id: 'stage-3',
      name: '3. Процедуры по существу',
      order: 3,
      procedures: [
        { id: 'proc-3-1', type: 'header', title: 'Детальное тестирование статей ФО', content: '', required: true },
        { id: 'proc-3-2', type: 'procedure', title: 'Тестирование активов', content: 'Проверка ОС, НМА, запасов, дебиторки', required: true, roleBinding: 'assistant_1' },
        { id: 'proc-3-3', type: 'procedure', title: 'Тестирование обязательств', content: 'Проверка займов, кредиторки, резервов', required: true, roleBinding: 'assistant_2' },
        { id: 'proc-3-4', type: 'procedure', title: 'Тестирование капитала', content: 'Проверка УК, нераспред. прибыли', required: true, roleBinding: 'assistant_1' },
        { id: 'proc-3-5', type: 'procedure', title: 'Тестирование доходов и расходов', content: 'Аналитические процедуры, детальные тесты', required: true, roleBinding: 'assistant_2' },
        { id: 'proc-3-6', type: 'file_upload', title: 'Загрузка рабочих файлов', content: '', required: true, roleBinding: 'assistant_1' },
        { id: 'proc-3-7', type: 'digital_signature', title: 'Проверка супервайзером', content: '', required: true, roleBinding: 'supervisor_1' },
      ],
    },
    {
      id: 'stage-4',
      name: '4. Завершение и отчет',
      order: 4,
      procedures: [
        { id: 'proc-4-1', type: 'header', title: 'Завершающие процедуры', content: '', required: true },
        { id: 'proc-4-2', type: 'procedure', title: 'Анализ последующих событий', content: 'События после отчетной даты', required: true, roleBinding: 'supervisor_1' },
        { id: 'proc-4-3', type: 'procedure', title: 'Оценка непрерывности деятельности', content: 'Going concern assessment', required: true, roleBinding: 'partner' },
        { id: 'proc-4-4', type: 'qa', title: 'Оценка выявленных искажений', content: 'Существенны ли искажения?', required: true, roleBinding: 'partner' },
        { id: 'proc-4-5', type: 'file_upload', title: 'Проект аудиторского заключения', content: '', required: true, roleBinding: 'partner' },
        { id: 'proc-4-6', type: 'digital_signature', title: 'Подписание отчета партнером', content: '', required: true, roleBinding: 'partner' },
      ],
    },
  ],
  defaultApprovalRole: 'partner',
  createdAt: new Date().toISOString(),
};

// 🔹 МСФО - ТРАНСФОРМАЦИЯ ОТЧЕТНОСТИ
export const IFRS_TRANSFORMATION_TEMPLATE: Template = {
  id: 'ifrs-transformation-2024',
  name: 'МСФО: Трансформация отчетности',
  description: 'Преобразование национальной отчетности в формат МСФО',
  category: 'consulting',
  customFields: [
    { id: 'period', name: 'Отчетный период', type: 'text', required: true },
    { id: 'from_standard', name: 'Исходный стандарт', type: 'dropdown', required: true, options: ['НСФО РК', 'RAS', 'US GAAP'] },
    { id: 'complexity', name: 'Сложность', type: 'dropdown', required: true, options: ['Простая', 'Средняя', 'Сложная'] },
  ],
  workStages: [
    {
      id: 'stage-1',
      name: '1. Подготовка и анализ',
      order: 1,
      procedures: [
        { id: 'proc-1-1', type: 'header', title: 'Сбор исходных данных', content: '', required: true },
        { id: 'proc-1-2', type: 'file_upload', title: 'Загрузка отчетности НСФО', content: '', required: true, roleBinding: 'assistant_1' },
        { id: 'proc-1-3', type: 'procedure', title: 'Анализ учетной политики', content: 'Выявление отличий от МСФО', required: true, roleBinding: 'supervisor_1' },
        { id: 'proc-1-4', type: 'digital_signature', title: 'Утверждение перечня корректировок', content: '', required: true, roleBinding: 'partner' },
      ],
    },
    {
      id: 'stage-2',
      name: '2. Корректировки МСФО',
      order: 2,
      procedures: [
        { id: 'proc-2-1', type: 'header', title: 'Подготовка корректирующих проводок', content: '', required: true },
        { id: 'proc-2-2', type: 'procedure', title: 'МСФО 16: Аренда', content: 'Расчет обязательства по аренде', required: true, roleBinding: 'assistant_1' },
        { id: 'proc-2-3', type: 'procedure', title: 'МСФО 9: Финансовые инструменты', content: 'Реклассификация и оценка', required: true, roleBinding: 'assistant_2' },
        { id: 'proc-2-4', type: 'procedure', title: 'МСФО 15: Выручка', content: 'Пересчет выручки по 5 шагам', required: true, roleBinding: 'assistant_1' },
        { id: 'proc-2-5', type: 'file_upload', title: 'Таблица корректировок', content: '', required: true, roleBinding: 'supervisor_1' },
        { id: 'proc-2-6', type: 'digital_signature', title: 'Проверка супервайзером', content: '', required: true, roleBinding: 'supervisor_1' },
      ],
    },
    {
      id: 'stage-3',
      name: '3. Формирование отчетности',
      order: 3,
      procedures: [
        { id: 'proc-3-1', type: 'header', title: 'Подготовка форм МСФО', content: '', required: true },
        { id: 'proc-3-2', type: 'procedure', title: 'Отчет о финансовом положении', content: 'Формирование баланса', required: true, roleBinding: 'assistant_1' },
        { id: 'proc-3-3', type: 'procedure', title: 'Отчет о прибылях и убытках', content: 'ОПУ и ОСД', required: true, roleBinding: 'assistant_1' },
        { id: 'proc-3-4', type: 'procedure', title: 'Отчет о движении денежных средств', content: 'ОДДС (прямой/косвенный)', required: true, roleBinding: 'assistant_2' },
        { id: 'proc-3-5', type: 'procedure', title: 'Примечания к отчетности', content: 'Раскрытия по стандартам', required: true, roleBinding: 'supervisor_1' },
        { id: 'proc-3-6', type: 'file_upload', title: 'Полный комплект МСФО', content: '', required: true, roleBinding: 'partner' },
        { id: 'proc-3-7', type: 'digital_signature', title: 'Утверждение партнером', content: '', required: true, roleBinding: 'partner' },
      ],
    },
  ],
  defaultApprovalRole: 'partner',
  createdAt: new Date().toISOString(),
};

// 🔹 ОЦЕНКА БИЗНЕСА (IVS)
export const VALUATION_TEMPLATE: Template = {
  id: 'business-valuation-2024',
  name: 'Оценка бизнеса (IVS)',
  description: 'Оценка стоимости бизнеса по Международным стандартам оценки',
  category: 'valuation',
  customFields: [
    { id: 'valuation_date', name: 'Дата оценки', type: 'date', required: true },
    { id: 'valuation_purpose', name: 'Цель оценки', type: 'dropdown', required: true, options: ['Сделка M&A', 'Кредитование', 'Судебный спор', 'Налоги'] },
    { id: 'approach', name: 'Подход к оценке', type: 'dropdown', required: true, options: ['Доходный', 'Сравнительный', 'Затратный', 'Комбинированный'] },
  ],
  workStages: [
    {
      id: 'stage-1',
      name: '1. Сбор и анализ информации',
      order: 1,
      procedures: [
        { id: 'proc-1-1', type: 'header', title: 'Понимание объекта оценки', content: '', required: true },
        { id: 'proc-1-2', type: 'file_upload', title: 'Финансовая отчетность (3 года)', content: '', required: true, roleBinding: 'assistant_1' },
        { id: 'proc-1-3', type: 'procedure', title: 'Анализ отрасли и рынка', content: 'Тренды, конкуренты, макро-факторы', required: true, roleBinding: 'supervisor_1' },
        { id: 'proc-1-4', type: 'procedure', title: 'Финансовый анализ компании', content: 'Рентабельность, ликвидность, EBITDA', required: true, roleBinding: 'assistant_1' },
        { id: 'proc-1-5', type: 'digital_signature', title: 'Утверждение допущений', content: '', required: true, roleBinding: 'partner' },
      ],
    },
    {
      id: 'stage-2',
      name: '2. Применение подходов к оценке',
      order: 2,
      procedures: [
        { id: 'proc-2-1', type: 'header', title: 'Расчет стоимости', content: '', required: true },
        { id: 'proc-2-2', type: 'procedure', title: 'Доходный подход (DCF)', content: 'Дисконтирование денежных потоков', required: true, roleBinding: 'supervisor_1' },
        { id: 'proc-2-3', type: 'procedure', title: 'Сравнительный подход', content: 'Мультипликаторы, аналоги', required: true, roleBinding: 'assistant_1' },
        { id: 'proc-2-4', type: 'procedure', title: 'Затратный подход (при необходимости)', content: 'Оценка чистых активов', required: true, roleBinding: 'assistant_1' },
        { id: 'proc-2-5', type: 'qa', title: 'Согласование результатов', content: 'Взвешивание подходов', required: true, roleBinding: 'partner' },
        { id: 'proc-2-6', type: 'file_upload', title: 'Расчетные таблицы', content: '', required: true, roleBinding: 'supervisor_1' },
      ],
    },
    {
      id: 'stage-3',
      name: '3. Подготовка отчета',
      order: 3,
      procedures: [
        { id: 'proc-3-1', type: 'header', title: 'Оформление отчета об оценке', content: '', required: true },
        { id: 'proc-3-2', type: 'procedure', title: 'Описание объекта и методологии', content: 'Вводная часть отчета', required: true, roleBinding: 'supervisor_1' },
        { id: 'proc-3-3', type: 'procedure', title: 'Представление расчетов', content: 'Детализация оценки', required: true, roleBinding: 'supervisor_1' },
        { id: 'proc-3-4', type: 'procedure', title: 'Заключение о стоимости', content: 'Итоговая оценка и ограничения', required: true, roleBinding: 'partner' },
        { id: 'proc-3-5', type: 'file_upload', title: 'Финальный отчет об оценке', content: '', required: true, roleBinding: 'partner' },
        { id: 'proc-3-6', type: 'digital_signature', title: 'Подпись оценщика', content: '', required: true, roleBinding: 'partner' },
      ],
    },
  ],
  defaultApprovalRole: 'partner',
  createdAt: new Date().toISOString(),
};

// 🔹 НАЛОГОВЫЙ КОНСАЛТИНГ
export const TAX_CONSULTING_TEMPLATE: Template = {
  id: 'tax-consulting-2024',
  name: 'Налоговый консалтинг',
  description: 'Налоговое планирование и оптимизация',
  category: 'tax',
  customFields: [
    { id: 'tax_period', name: 'Налоговый период', type: 'text', required: true },
    { id: 'tax_type', name: 'Вид налога', type: 'dropdown', required: true, options: ['КПН', 'НДС', 'ИПН', 'СН', 'Комплексный'] },
    { id: 'optimization_goal', name: 'Цель оптимизации', type: 'text', required: true },
  ],
  workStages: [
    {
      id: 'stage-1',
      name: '1. Налоговый аудит',
      order: 1,
      procedures: [
        { id: 'proc-1-1', type: 'header', title: 'Анализ текущей налоговой позиции', content: '', required: true },
        { id: 'proc-1-2', type: 'file_upload', title: 'Налоговые декларации', content: '', required: true, roleBinding: 'tax_specialist' },
        { id: 'proc-1-3', type: 'procedure', title: 'Выявление налоговых рисков', content: 'Проверка на соответствие НК РК', required: true, roleBinding: 'tax_specialist' },
        { id: 'proc-1-4', type: 'qa', title: 'Оценка вероятности доначислений', content: 'Риск-карта', required: true, roleBinding: 'supervisor_1' },
        { id: 'proc-1-5', type: 'digital_signature', title: 'Утверждение плана работ', content: '', required: true, roleBinding: 'partner' },
      ],
    },
    {
      id: 'stage-2',
      name: '2. Разработка стратегии оптимизации',
      order: 2,
      procedures: [
        { id: 'proc-2-1', type: 'header', title: 'Подготовка рекомендаций', content: '', required: true },
        { id: 'proc-2-2', type: 'procedure', title: 'Анализ договорной структуры', content: 'Оптимизация контрактов', required: true, roleBinding: 'tax_specialist' },
        { id: 'proc-2-3', type: 'procedure', title: 'Применение льгот и преференций', content: 'Поиск доступных льгот', required: true, roleBinding: 'tax_specialist' },
        { id: 'proc-2-4', type: 'procedure', title: 'Трансфертное ценообразование', content: 'TP-документация', required: true, roleBinding: 'supervisor_1' },
        { id: 'proc-2-5', type: 'file_upload', title: 'План налоговой оптимизации', content: '', required: true, roleBinding: 'partner' },
        { id: 'proc-2-6', type: 'digital_signature', title: 'Утверждение стратегии', content: '', required: true, roleBinding: 'partner' },
      ],
    },
    {
      id: 'stage-3',
      name: '3. Реализация и сопровождение',
      order: 3,
      procedures: [
        { id: 'proc-3-1', type: 'header', title: 'Внедрение рекомендаций', content: '', required: true },
        { id: 'proc-3-2', type: 'procedure', title: 'Подготовка изменений в учетную политику', content: 'Корректировка УП', required: true, roleBinding: 'tax_specialist' },
        { id: 'proc-3-3', type: 'procedure', title: 'Разработка внутренних регламентов', content: 'Инструкции для бухгалтерии', required: true, roleBinding: 'supervisor_1' },
        { id: 'proc-3-4', type: 'file_upload', title: 'Итоговый отчет и рекомендации', content: '', required: true, roleBinding: 'partner' },
        { id: 'proc-3-5', type: 'digital_signature', title: 'Передача клиенту', content: '', required: true, roleBinding: 'partner' },
      ],
    },
  ],
  defaultApprovalRole: 'partner',
  createdAt: new Date().toISOString(),
};

// 📦 ЭКСПОРТ ВСЕХ ШАБЛОНОВ
export const DEFAULT_TEMPLATES: Template[] = [
  MSA_AUDIT_TEMPLATE,
  IFRS_TRANSFORMATION_TEMPLATE,
  VALUATION_TEMPLATE,
  TAX_CONSULTING_TEMPLATE,
];

// Функция инициализации шаблонов при первом запуске
export function initializeDefaultTemplates() {
  const existingTemplates = localStorage.getItem('templates');
  
  if (!existingTemplates || JSON.parse(existingTemplates).length === 0) {
    localStorage.setItem('templates', JSON.stringify(DEFAULT_TEMPLATES));
    console.log('✅ Предустановленные шаблоны методологий загружены:', DEFAULT_TEMPLATES.length);
    return DEFAULT_TEMPLATES;
  }
  
  return JSON.parse(existingTemplates);
}

