/**
 * Компонент для управления шаблонами аудита
 * Позволяет просматривать, скачивать и создавать файлы на основе шаблонов
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, 
  Download, 
  FileCheck, 
  Search,
  Filter,
  CheckCircle2,
  Circle,
  User,
  Calendar
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { 
  ALL_AUDIT_TEMPLATES, 
  AuditTemplate, 
  TemplateCategory,
  getTemplatesByStage,
  getTemplatesByElement,
  getTemplatesByCategory,
  getTemplatesByRole
} from '@/lib/auditTemplates';
import { useAuth } from '@/contexts/AuthContext';
import { generateBrandedPDF } from '@/lib/pdfGenerator';

interface TemplateManagerProps {
  projectId: string;
  stageId?: string;
  elementId?: string;
  onTemplateSelect?: (template: AuditTemplate) => void;
}

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  general: 'Общие файлы',
  planning: 'Планирование',
  'risk-assessment': 'Оценка рисков',
  controls: 'Контроли',
  substantive: 'Субстантивные процедуры',
  completion: 'Завершение'
};

const ROLE_LABELS: Record<string, string> = {
  partner: 'Партнёр',
  manager: 'Менеджер',
  senior_auditor: 'Старший аудитор',
  assistant: 'Ассистент',
  tax_specialist: 'Налоговый специалист'
};

const CATEGORY_COLORS: Record<TemplateCategory, string> = {
  general: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  planning: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'risk-assessment': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  controls: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  substantive: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  completion: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200'
};

export function TemplateManager({ 
  projectId, 
  stageId, 
  elementId,
  onTemplateSelect 
}: TemplateManagerProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all');
  const [selectedRole, setSelectedRole] = useState<string | 'all'>('all');

  // Фильтрация шаблонов
  let filteredTemplates = ALL_AUDIT_TEMPLATES;

  // Фильтр по этапу
  if (stageId) {
    filteredTemplates = getTemplatesByStage(stageId);
  }

  // Фильтр по элементу
  if (elementId) {
    filteredTemplates = getTemplatesByElement(elementId);
  }

  // Фильтр по категории
  if (selectedCategory !== 'all') {
    filteredTemplates = filteredTemplates.filter(t => t.category === selectedCategory);
  }

  // Фильтр по роли
  if (selectedRole !== 'all') {
    filteredTemplates = filteredTemplates.filter(t => t.requiredRole === selectedRole);
  }

  // Поиск
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filteredTemplates = filteredTemplates.filter(t => 
      t.name.toLowerCase().includes(query) ||
      t.description.toLowerCase().includes(query) ||
      t.fileName.toLowerCase().includes(query)
    );
  }

  // Группировка по категориям
  const templatesByCategory = filteredTemplates.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<TemplateCategory, AuditTemplate[]>);

  const handleDownloadTemplate = async (template: AuditTemplate) => {
    console.log('Скачивание шаблона:', template);
    
    // Если есть Google Drive ID, создаем ссылку для скачивания
    if (template.googleDriveId) {
      const downloadUrl = `https://drive.google.com/uc?export=download&id=${template.googleDriveId}`;
      window.open(downloadUrl, '_blank');
      return;
    }
    
    try {
      // Генерируем брендированный PDF
      await generateBrandedPDF({
        name: template.name,
        description: template.description,
        category: template.category,
        requiredRole: template.requiredRole,
        fileType: template.fileType,
        isRequired: template.isRequired,
        fileName: template.fileName
      });
    } catch (error) {
      console.error('Ошибка при генерации PDF:', error);
    }
  };

  const handleCreateFromTemplate = (template: AuditTemplate) => {
    if (onTemplateSelect) {
      onTemplateSelect(template);
    }
    // TODO: Создать файл на основе шаблона в проекте
    console.log('Создание файла из шаблона:', template);
  };

  return (
    <div className="space-y-4">
      {/* Заголовок и поиск */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Шаблоны аудита
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {filteredTemplates.length} шаблонов доступно
          </p>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:flex-initial">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Поиск шаблонов..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-full md:w-[300px]"
            />
          </div>
        </div>
      </div>

      {/* Фильтры */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Категория:</span>
        </div>
        <Button
          variant={selectedCategory === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedCategory('all')}
        >
          Все
        </Button>
        {(Object.keys(CATEGORY_LABELS) as TemplateCategory[]).map(category => (
          <Button
            key={category}
            variant={selectedCategory === category ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(category)}
          >
            {CATEGORY_LABELS[category]}
          </Button>
        ))}
        
        <div className="flex items-center gap-2 ml-4">
          <User className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Роль:</span>
        </div>
        <Button
          variant={selectedRole === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedRole('all')}
        >
          Все
        </Button>
        {Object.keys(ROLE_LABELS).map(role => (
          <Button
            key={role}
            variant={selectedRole === role ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedRole(role)}
          >
            {ROLE_LABELS[role]}
          </Button>
        ))}
      </div>

      {/* Список шаблонов */}
      {filteredTemplates.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            Шаблоны не найдены. Попробуйте изменить фильтры или поисковый запрос.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map(template => (
            <Card key={template.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="font-semibold text-sm mb-1">{template.name}</h4>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {template.description}
                  </p>
                </div>
                {template.isRequired && (
                  <Badge variant="destructive" className="ml-2 flex-shrink-0">
                    Обязательный
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                <Badge 
                  variant="outline" 
                  className={CATEGORY_COLORS[template.category]}
                >
                  {CATEGORY_LABELS[template.category]}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {ROLE_LABELS[template.requiredRole]}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {template.fileType.toUpperCase()}
                </Badge>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleDownloadTemplate(template)}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Скачать
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleCreateFromTemplate(template)}
                >
                  <FileCheck className="w-4 h-4 mr-1" />
                  Создать
                </Button>
              </div>

              {template.fileName && (
                <p className="text-xs text-muted-foreground mt-2 truncate" title={template.fileName}>
                  📄 {template.fileName}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

