/**
 * Типы данных для системы методологий и шаблонов проектов
 */

// Типы полей для паспорта проекта
export type FieldType = 'text' | 'number' | 'date' | 'select' | 'user' | 'textarea';

export interface CustomField {
  id: string;
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[]; // Для select
  defaultValue?: string | number;
  placeholder?: string;
  helpText?: string;
  order: number;
}

// Типы процедурных элементов
export type ProcedureElementType = 
  | 'header'           // Заголовок
  | 'question'         // Вопрос-Ответ
  | 'procedure'        // Процедура с описанием и комментариями
  | 'file'             // Загрузка файла
  | 'signature';       // Цифровая подпись

export interface ProcedureElement {
  id: string;
  type: ProcedureElementType;
  title: string;
  description?: string;
  required: boolean;
  order: number;
  
  // Для типа 'question'
  question?: string;
  
  // Для типа 'signature'
  requiredRole?: string; // Роль, которая должна утвердить
  
  // Дополнительные настройки
  config?: {
    multipleFiles?: boolean; // Для file
    maxFileSize?: number;    // В MB
    allowedFileTypes?: string[];
  };
}

// Этап проекта с процедурами
export interface ProjectStage {
  id: string;
  name: string;
  description?: string;
  order: number;
  elements: ProcedureElement[];
  color?: string; // Для визуального отличия
}

// Роли для маршрутизации
export type UserRole = 'admin' | 'partner' | 'manager' | 'assistant' | 'accountant' | 'methodologist';

// Настройки маршрутизации
export interface RoutingSettings {
  defaultApprovalRole?: UserRole;
  notifyOnCreation?: boolean;
  autoAssignTo?: UserRole;
  allowedRoles?: UserRole[]; // Кто может создавать проекты по этому шаблону
}

// Шаблон проекта (Методология)
export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: string; // Финансовый аудит, IT-аудит, Оценка и т.д.
  
  // Паспорт проекта (Вкладка 1)
  customFields: CustomField[];
  
  // Рабочие процедуры (Вкладка 2)
  stages: ProjectStage[];
  
  // Настройки и маршрутизация (Вкладка 3)
  routingSettings: RoutingSettings;
  
  // Метаданные
  created_at: string;
  updated_at: string;
  created_by: string;
  version: number;
  isActive: boolean;
  
  // Статистика использования
  usageCount?: number;
}

// Данные заполненного проекта на основе шаблона
export interface ProjectData {
  projectId: string;
  templateId: string;
  templateVersion: number;
  
  // Данные паспорта
  passportData: Record<string, any>;
  
  // Данные процедур
  stagesData: {
    [stageId: string]: {
      [elementId: string]: ElementData;
    };
  };
  
  // Статус выполнения
  completionStatus: {
    totalElements: number;
    completedElements: number;
    percentage: number;
  };
  
  // История изменений
  history: ChangeRecord[];
}

// Данные элемента процедуры
export interface ElementData {
  elementId: string;
  completed: boolean;
  completedAt?: string;
  completedBy?: string;
  
  // Для question
  answer?: string;
  
  // Для procedure
  workDescription?: string;
  comments?: string;
  
  // Для file
  files?: FileAttachment[];
  
  // Для signature
  signedBy?: string;
  signedAt?: string;
  signatureData?: string;
}

export interface FileAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface ChangeRecord {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  elementId?: string;
  stageId?: string;
  changes?: any;
}

// Категории проектов (направления бизнеса)
export const PROJECT_CATEGORIES = [
  'Финансовый аудит',
  'IT-аудит',
  'Налоговое консультирование',
  'Оценка недвижимости',
  'Оценка бизнеса',
  'Due Diligence',
  'Трансформация отчетности',
  'Аутсорсинг бухгалтерии',
  'Прочее'
] as const;

export type ProjectCategory = typeof PROJECT_CATEGORIES[number];

// Роли с описанием
export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Администратор',
  partner: 'Партнёр',
  manager: 'Руководитель проекта',
  assistant: 'Ассистент',
  accountant: 'Бухгалтер',
  methodologist: 'Руководитель по методологии'
};

// Типы полей с описанием
export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Текст (одна строка)',
  textarea: 'Текст (многострочный)',
  number: 'Число',
  date: 'Дата',
  select: 'Выпадающий список',
  user: 'Пользователь (сотрудник)'
};

// Типы элементов с описанием
export const ELEMENT_TYPE_LABELS: Record<ProcedureElementType, string> = {
  header: 'Заголовок',
  question: 'Вопрос-Ответ',
  procedure: 'Процедура',
  file: 'Загрузка файла',
  signature: 'Цифровая подпись'
};

// Иконки для типов элементов
export const ELEMENT_TYPE_ICONS: Record<ProcedureElementType, string> = {
  header: '📋',
  question: '❓',
  procedure: '✅',
  file: '📎',
  signature: '✍️'
};

// Цвета для этапов
export const STAGE_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

