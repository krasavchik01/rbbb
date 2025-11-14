/**
 * Компонент для динамического рендеринга рабочих документов
 * Читает structure_definition из шаблона и рендерит соответствующие элементы
 */

import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { 
  Save, 
  Send, 
  CheckCircle2, 
  XCircle, 
  MessageSquare,
  FileText,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  WorkPaper,
  WorkPaperTemplate,
  StructureDefinition,
  StructureElement,
  TableElement,
  WorkPaperStatus,
  parseReference,
  extractReferences
} from '@/types/workPapers';
import { supabaseDataStore } from '@/lib/supabaseDataStore';

interface WorkPaperViewerProps {
  workPaper: WorkPaper;
  template: WorkPaperTemplate;
  onStatusChange?: (status: WorkPaperStatus) => void;
  onSave?: (data: Record<string, any>) => void;
  readOnly?: boolean;
  showReviewActions?: boolean;
}

export function WorkPaperViewer({
  workPaper,
  template,
  onStatusChange,
  onSave,
  readOnly = false,
  showReviewActions = false
}: WorkPaperViewerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<Record<string, any>>(workPaper.data || {});
  const [isSaving, setIsSaving] = useState(false);
  const [reviewComment, setReviewComment] = useState('');

  // Проверяем права доступа
  const canEdit = !readOnly && (
    workPaper.assigned_to === user?.id ||
    user?.role === 'ceo' ||
    user?.role === 'deputy_director' ||
    user?.role === 'partner'
  );

  const canReview = showReviewActions && (
    workPaper.reviewer_id === user?.id ||
    user?.role === 'ceo' ||
    user?.role === 'deputy_director' ||
    user?.role === 'partner' ||
    user?.role === 'manager_1' ||
    user?.role === 'manager_2' ||
    user?.role === 'manager_3'
  );

  // Сохранение данных
  const handleSave = async () => {
    if (!canEdit) return;

    setIsSaving(true);
    try {
      // Обновляем документ в Supabase
      await supabaseDataStore.updateWorkPaper(workPaper.id, {
        data,
        status: workPaper.status === 'not_started' ? 'in_progress' : workPaper.status,
        started_at: workPaper.started_at || new Date().toISOString()
      });

      if (onSave) {
        onSave(data);
      }

      toast({
        title: 'Сохранено',
        description: 'Изменения успешно сохранены',
      });
    } catch (error: any) {
      console.error('Ошибка сохранения:', error);
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось сохранить изменения',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Отправка на проверку
  const handleSubmitForReview = async () => {
    if (!canEdit) return;

    try {
      await supabaseDataStore.updateWorkPaper(workPaper.id, {
        status: 'awaiting_review'
      });

      if (onStatusChange) {
        onStatusChange('awaiting_review');
      }

      toast({
        title: 'Отправлено на проверку',
        description: 'Документ отправлен ревьюеру',
      });
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось отправить на проверку',
        variant: 'destructive',
      });
    }
  };

  // Утверждение/отклонение
  const handleReview = async (approved: boolean) => {
    if (!canReview) return;

    try {
      const reviewEntry = {
        id: crypto.randomUUID(),
        reviewer_id: user?.id || '',
        reviewer_name: user?.name || '',
        timestamp: new Date().toISOString(),
        comment: reviewComment || undefined,
        status: approved ? 'approved' as const : 'rejected' as const
      };

      const reviewHistory = [...(workPaper.review_history || []), reviewEntry];

      await supabaseDataStore.updateWorkPaper(workPaper.id, {
        status: approved ? 'completed' : 'rejected',
        review_history: reviewHistory,
        completed_at: approved ? new Date().toISOString() : undefined
      });

      if (onStatusChange) {
        onStatusChange(approved ? 'completed' : 'rejected');
      }

      toast({
        title: approved ? 'Утверждено' : 'Отклонено',
        description: reviewComment || (approved ? 'Документ утвержден' : 'Документ отклонен'),
      });

      setReviewComment('');
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось выполнить действие',
        variant: 'destructive',
      });
    }
  };

  // Рендеринг элементов структуры
  const renderElement = (element: StructureElement, index: number) => {
    switch (element.type) {
      case 'header':
        const HeaderTag = `h${element.level || 2}` as keyof JSX.IntrinsicElements;
        return (
          <HeaderTag key={index} className="font-semibold mt-6 mb-4 first:mt-0">
            {element.label}
          </HeaderTag>
        );

      case 'static_text':
        const content = element.content || 
          (element.content_from === 'purpose' ? template.purpose : '');
        return (
          <p key={index} className="text-muted-foreground mb-4">
            {content}
          </p>
        );

      case 'table':
        return renderTable(element as TableElement, index);

      case 'rich_text':
        return (
          <div key={index} className="mb-4">
            <Label htmlFor={element.id}>{element.label}</Label>
            <Textarea
              id={element.id}
              value={data[element.id] || ''}
              onChange={(e) => {
                if (canEdit) {
                  setData({ ...data, [element.id]: e.target.value });
                }
              }}
              placeholder={element.placeholder}
              required={element.required}
              disabled={!canEdit}
              rows={6}
              className="mt-1"
            />
          </div>
        );

      case 'number':
        return (
          <div key={index} className="mb-4">
            <Label htmlFor={element.id}>{element.label}</Label>
            <Input
              id={element.id}
              type="number"
              value={data[element.id] || ''}
              onChange={(e) => {
                if (canEdit) {
                  const value = element.format === 'integer' 
                    ? parseInt(e.target.value) 
                    : parseFloat(e.target.value);
                  setData({ ...data, [element.id]: value });
                }
              }}
              placeholder={element.placeholder}
              required={element.required}
              disabled={!canEdit}
              min={element.min}
              max={element.max}
              step={element.step || (element.format === 'integer' ? 1 : 0.01)}
              className="mt-1"
            />
          </div>
        );

      case 'date':
        return (
          <div key={index} className="mb-4">
            <Label htmlFor={element.id}>{element.label}</Label>
            <Input
              id={element.id}
              type="date"
              value={data[element.id] || ''}
              onChange={(e) => {
                if (canEdit) {
                  setData({ ...data, [element.id]: e.target.value });
                }
              }}
              required={element.required}
              disabled={!canEdit}
              className="mt-1"
            />
          </div>
        );

      case 'checkbox':
        return (
          <div key={index} className="mb-4 flex items-center space-x-2">
            <Checkbox
              id={element.id}
              checked={data[element.id] || element.default_checked || false}
              onCheckedChange={(checked) => {
                if (canEdit) {
                  setData({ ...data, [element.id]: checked });
                }
              }}
              disabled={!canEdit}
            />
            <Label htmlFor={element.id} className="cursor-pointer">
              {element.label}
            </Label>
          </div>
        );

      case 'static_checklist':
        const items = element.items || 
          (element.content_from === 'procedures_template' ? template.procedures_template : []);
        return (
          <div key={index} className="mb-4 space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center space-x-2">
                <Checkbox
                  checked={data[`${element.id}_${idx}`] || false}
                  onCheckedChange={(checked) => {
                    if (canEdit) {
                      setData({ ...data, [`${element.id}_${idx}`]: checked });
                    }
                  }}
                  disabled={!canEdit}
                />
                <Label className="text-sm">{item}</Label>
              </div>
            ))}
          </div>
        );

      case 'file_upload':
        return (
          <div key={index} className="mb-4">
            <Label>{element.label}</Label>
            <div className="mt-1 border-2 border-dashed rounded-lg p-4 text-center">
              <FileText className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {canEdit ? 'Нажмите для загрузки файла' : 'Файлы загружены'}
              </p>
              {/* TODO: Интеграция с ProjectFileManager */}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Рендеринг таблицы
  const renderTable = (element: TableElement, index: number) => {
    const tableData = data[element.id] || [];
    
    const handleAddRow = () => {
      if (!canEdit) return;
      const newRow: Record<string, any> = { id: tableData.length + 1 };
      element.columns.forEach(col => {
        if (col.type === 'checkbox') {
          newRow[col.key] = false;
        } else {
          newRow[col.key] = '';
        }
      });
      setData({ ...data, [element.id]: [...tableData, newRow] });
    };

    const handleDeleteRow = (rowIndex: number) => {
      if (!canEdit) return;
      const newData = tableData.filter((_: any, idx: number) => idx !== rowIndex);
      setData({ ...data, [element.id]: newData });
    };

    const handleCellChange = (rowIndex: number, columnKey: string, value: any) => {
      if (!canEdit) return;
      const newData = [...tableData];
      newData[rowIndex] = { ...newData[rowIndex], [columnKey]: value };
      setData({ ...data, [element.id]: newData });
    };

    return (
      <div key={index} className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-base font-semibold">{element.label}</Label>
          {canEdit && (
            <div className="flex gap-2">
              {element.allow_add_rows !== false && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddRow}
                >
                  + Добавить строку
                </Button>
              )}
            </div>
          )}
        </div>
        
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                {element.columns.map((col) => (
                  <TableHead key={col.key} style={{ width: col.width }}>
                    {col.label}
                    {col.required && <span className="text-red-500 ml-1">*</span>}
                  </TableHead>
                ))}
                {canEdit && element.allow_delete_rows !== false && (
                  <TableHead className="w-12"></TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={element.columns.length + (canEdit ? 1 : 0)} className="text-center text-muted-foreground py-8">
                    Нет данных. {canEdit && 'Нажмите "Добавить строку" для начала работы.'}
                  </TableCell>
                </TableRow>
              ) : (
                tableData.map((row: any, rowIndex: number) => (
                  <TableRow key={rowIndex}>
                    {element.columns.map((col) => (
                      <TableCell key={col.key}>
                        {renderTableCell(
                          col,
                          row[col.key],
                          (value) => handleCellChange(rowIndex, col.key, value),
                          canEdit
                        )}
                      </TableCell>
                    ))}
                    {canEdit && element.allow_delete_rows !== false && (
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteRow(rowIndex)}
                        >
                          <XCircle className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  // Рендеринг ячейки таблицы
  const renderTableCell = (
    column: TableElement['columns'][0],
    value: any,
    onChange: (value: any) => void,
    editable: boolean
  ) => {
    switch (column.type) {
      case 'text':
        return (
          <Input
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={!editable}
            className="border-0 p-0 h-auto"
          />
        );

      case 'number':
      case 'currency':
        return (
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            disabled={!editable}
            className="border-0 p-0 h-auto"
            step={column.type === 'currency' ? 0.01 : 1}
          />
        );

      case 'date':
        return (
          <Input
            type="date"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={!editable}
            className="border-0 p-0 h-auto"
          />
        );

      case 'checkbox':
        return (
          <Checkbox
            checked={value || false}
            onCheckedChange={onChange}
            disabled={!editable}
          />
        );

      case 'reference':
        // TODO: Реализовать перекрестные ссылки
        return (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{value || '—'}</span>
            <ExternalLink className="w-4 h-4 text-muted-foreground" />
          </div>
        );

      default:
        return <span>{value || '—'}</span>;
    }
  };

  const structure = template.structure_definition || [];

  return (
    <div className="space-y-6">
      {/* Заголовок документа */}
      <Card className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold mb-2">{workPaper.name}</h2>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Код: {workPaper.code}</Badge>
              <Badge 
                variant={
                  workPaper.status === 'completed' ? 'default' :
                  workPaper.status === 'awaiting_review' ? 'secondary' :
                  workPaper.status === 'in_progress' ? 'default' :
                  'outline'
                }
              >
                {workPaper.status === 'not_started' ? 'Не начат' :
                 workPaper.status === 'in_progress' ? 'В работе' :
                 workPaper.status === 'awaiting_review' ? 'На проверке' :
                 workPaper.status === 'completed' ? 'Завершен' :
                 'Отклонен'}
              </Badge>
            </div>
          </div>
        </div>

        {template.purpose && (
          <div className="bg-muted/50 p-4 rounded-lg mb-4">
            <p className="text-sm font-medium mb-1">Цель документа:</p>
            <p className="text-sm text-muted-foreground">{template.purpose}</p>
          </div>
        )}
      </Card>

      {/* Основное содержимое */}
      <Card className="p-6">
        {structure.map((element, index) => renderElement(element, index))}
      </Card>

      {/* История ревью */}
      {workPaper.review_history && workPaper.review_history.length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">История проверок</h3>
          <div className="space-y-3">
            {workPaper.review_history.map((entry) => (
              <div key={entry.id} className="border-l-2 pl-4 py-2">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={entry.status === 'approved' ? 'default' : 'destructive'}>
                    {entry.status === 'approved' ? 'Утверждено' : 
                     entry.status === 'rejected' ? 'Отклонено' : 'Комментарий'}
                  </Badge>
                  <span className="text-sm font-medium">{entry.reviewer_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleString('ru-RU')}
                  </span>
                </div>
                {entry.comment && (
                  <p className="text-sm text-muted-foreground">{entry.comment}</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Панель действий */}
      <Card className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-2">
            {canEdit && (
              <>
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  variant="default"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? 'Сохранение...' : 'Сохранить'}
                </Button>
                {workPaper.status === 'in_progress' && (
                  <Button
                    onClick={handleSubmitForReview}
                    variant="outline"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Отправить на проверку
                  </Button>
                )}
              </>
            )}
          </div>

          {canReview && workPaper.status === 'awaiting_review' && (
            <div className="flex gap-2">
              <Textarea
                placeholder="Комментарий к проверке..."
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                className="w-64"
                rows={2}
              />
              <Button
                onClick={() => handleReview(true)}
                variant="default"
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Утвердить
              </Button>
              <Button
                onClick={() => handleReview(false)}
                variant="destructive"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Отклонить
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

