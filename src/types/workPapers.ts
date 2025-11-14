/**
 * Типы для системы рабочих документов аудита
 */

export type WorkPaperStatus = 
  | 'not_started' 
  | 'in_progress' 
  | 'awaiting_review' 
  | 'completed' 
  | 'rejected';

export type AssigneeRole = 
  | 'assistant' 
  | 'supervisor' 
  | 'manager' 
  | 'partner' 
  | 'tax';

export interface Methodology {
  id: string;
  name: string;
  description?: string;
  version: string;
  category?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  is_active: boolean;
}

export interface MethodologySection {
  id: string;
  methodology_id: string;
  code: string; // 'A', 'B', 'J', 'K'
  name: string;
  description?: string;
  parent_id?: string;
  order_index: number;
  created_at: string;
}

export interface WorkPaperTemplate {
  id: string;
  section_id: string;
  code: string; // 'J-1', 'J-30', 'A1'
  name: string;
  description?: string;
  purpose?: string;
  procedures_template?: string[]; // массив процедур
  structure_definition: StructureDefinition; // JSON структура
  default_assignee_role?: AssigneeRole;
  is_required: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface WorkPaper {
  id: string;
  project_id: string;
  template_id: string;
  code: string;
  name: string;
  status: WorkPaperStatus;
  data: Record<string, any>; // JSON данные
  review_history: ReviewEntry[];
  assigned_to?: string;
  reviewer_id?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  
  // Расширенные поля (загружаются через JOIN)
  template?: WorkPaperTemplate;
  assigned_user?: {
    id: string;
    name: string;
    email: string;
  };
  reviewer?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface ReviewEntry {
  id: string;
  reviewer_id: string;
  reviewer_name?: string;
  timestamp: string;
  comment?: string;
  status: 'approved' | 'rejected' | 'commented';
  changes?: Record<string, any>; // что было изменено
}

/**
 * Структура документа для динамического рендеринга
 */
export type StructureElement = 
  | HeaderElement
  | StaticTextElement
  | TableElement
  | RichTextElement
  | FileUploadElement
  | NumberInputElement
  | DateInputElement
  | CheckboxElement
  | StaticChecklistElement
  | ReferenceElement;

export interface BaseStructureElement {
  type: string;
  id?: string;
  label?: string;
}

export interface HeaderElement extends BaseStructureElement {
  type: 'header';
  label: string;
  level?: 1 | 2 | 3 | 4;
}

export interface StaticTextElement extends BaseStructureElement {
  type: 'static_text';
  content?: string;
  content_from?: string; // ссылка на поле из шаблона (например, 'purpose')
}

export interface TableElement extends BaseStructureElement {
  type: 'table';
  id: string;
  columns: TableColumn[];
  default_rows?: number;
  allow_add_rows?: boolean;
  allow_delete_rows?: boolean;
}

export interface TableColumn {
  key: string;
  label: string;
  type: 'text' | 'number' | 'currency' | 'date' | 'checkbox' | 'file_upload' | 'reference';
  required?: boolean;
  width?: string;
  format?: string; // для чисел и дат
  reference_to?: string; // для типа 'reference': путь к другому документу
}

export interface RichTextElement extends BaseStructureElement {
  type: 'rich_text';
  id: string;
  placeholder?: string;
  required?: boolean;
}

export interface FileUploadElement extends BaseStructureElement {
  type: 'file_upload';
  id: string;
  multiple?: boolean;
  accept?: string; // 'image/*', '.pdf', etc.
  max_size_mb?: number;
}

export interface NumberInputElement extends BaseStructureElement {
  type: 'number';
  id: string;
  label: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  format?: 'integer' | 'decimal' | 'currency' | 'percentage';
  required?: boolean;
}

export interface DateInputElement extends BaseStructureElement {
  type: 'date';
  id: string;
  label: string;
  required?: boolean;
}

export interface CheckboxElement extends BaseStructureElement {
  type: 'checkbox';
  id: string;
  label: string;
  default_checked?: boolean;
}

export interface StaticChecklistElement extends BaseStructureElement {
  type: 'static_checklist';
  content_from?: 'procedures_template'; // берет из шаблона
  items?: string[]; // или явно указанные элементы
}

export interface ReferenceElement extends BaseStructureElement {
  type: 'reference';
  id: string;
  label: string;
  reference_path: string; // например, 'J-5.rollforward_table.total_additions'
  read_only?: boolean;
}

export type StructureDefinition = StructureElement[];

/**
 * Данные документа (хранятся в work_papers.data)
 */
export interface WorkPaperData {
  [elementId: string]: any;
  
  // Примеры:
  // 'conclusion_text': 'Текст вывода...',
  // 'additions_table': [
  //   { id: 1, type: 'Purchase', supplier: 'ABC Corp', invoice_amount: 100000, ... }
  // ],
  // 'total_amount': 500000
}

/**
 * Утилиты для работы со структурой
 */
export function findElementById(
  structure: StructureDefinition, 
  id: string
): StructureElement | undefined {
  return structure.find(el => el.id === id);
}

export function findTableElement(
  structure: StructureDefinition,
  tableId: string
): TableElement | undefined {
  const element = findElementById(structure, tableId);
  return element?.type === 'table' ? element : undefined;
}

/**
 * Парсинг перекрестных ссылок
 * Формат: {{J-5.rollforward_table.total_additions}}
 */
export interface ParsedReference {
  workPaperCode: string; // 'J-5'
  path: string[]; // ['rollforward_table', 'total_additions']
  fullPath: string; // 'J-5.rollforward_table.total_additions'
}

export function parseReference(reference: string): ParsedReference | null {
  const match = reference.match(/\{\{([^}]+)\}\}/);
  if (!match) return null;
  
  const fullPath = match[1].trim();
  const parts = fullPath.split('.');
  
  if (parts.length < 2) return null;
  
  return {
    workPaperCode: parts[0],
    path: parts.slice(1),
    fullPath
  };
}

export function extractReferences(text: string): ParsedReference[] {
  const references: ParsedReference[] = [];
  const regex = /\{\{([^}]+)\}\}/g;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    const parsed = parseReference(match[0]);
    if (parsed) {
      references.push(parsed);
    }
  }
  
  return references;
}

