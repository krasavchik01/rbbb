import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProjectTemplate, ProjectStage, ProcedureElement, ELEMENT_TYPE_ICONS } from '@/types/methodology';
import { CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';

export interface SelectedProcedure {
  stageId: string;
  elementId: string;
  responsibleRole: 'assistant' | 'senior_auditor' | 'manager' | 'partner';
  responsibleUserId?: string;
}

interface MethodologySelectorProps {
  template: ProjectTemplate;
  projectId: string;
  employees: any[];
  onSave: (selectedProcedures: SelectedProcedure[]) => void;
  onCancel?: () => void;
  initialSelection?: SelectedProcedure[];
}

export function MethodologySelector({ 
  template, 
  projectId, 
  employees,
  onSave, 
  onCancel,
  initialSelection = [] 
}: MethodologySelectorProps) {
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());
  const [selectedProcedures, setSelectedProcedures] = useState<Map<string, SelectedProcedure>>(
    new Map(initialSelection.map(sp => [`${sp.stageId}-${sp.elementId}`, sp]))
  );
  const [assignments, setAssignments] = useState<Map<string, { role: string; userId?: string }>>(
    new Map(initialSelection.map(sp => [`${sp.stageId}-${sp.elementId}`, { role: sp.responsibleRole, userId: sp.responsibleUserId }]))
  );

  // Автоматически раскрываем все этапы при первой загрузке
  useEffect(() => {
    if (expandedStages.size === 0) {
      setExpandedStages(new Set(template.stages.map(s => s.id)));
    }
  }, [template.stages]);

  // Фильтруем сотрудников по ролям
  const getEmployeesByRole = (role: 'assistant' | 'senior_auditor' | 'manager' | 'partner') => {
    const roleMap: Record<string, string[]> = {
      assistant: ['assistant_1', 'assistant_2', 'assistant_3', 'assistant'],
      senior_auditor: ['supervisor_1', 'supervisor_2', 'supervisor_3', 'supervisor'],
      manager: ['manager_1', 'manager_2', 'manager_3', 'manager', 'pm'],
      partner: ['partner']
    };
    
    const rolePatterns = roleMap[role] || [];
    return employees.filter(emp => {
      const empRole = emp.role?.toLowerCase() || '';
      return rolePatterns.some(pattern => empRole.includes(pattern.toLowerCase()));
    });
  };

  const toggleStage = (stageId: string) => {
    setExpandedStages(prev => {
      const next = new Set(prev);
      if (next.has(stageId)) {
        next.delete(stageId);
      } else {
        next.add(stageId);
      }
      return next;
    });
  };

  const getDefaultRoleForElement = (element: ProcedureElement): 'assistant' | 'senior_auditor' | 'manager' | 'partner' => {
    // Используем defaultRole из элемента методологии, если указан
    if (element.defaultRole) {
      const role = element.defaultRole as 'assistant' | 'senior_auditor' | 'manager' | 'partner';
      if (['assistant', 'senior_auditor', 'manager', 'partner'].includes(role)) {
        return role;
      }
    }
    
    // Используем requiredRole для signature элементов
    if (element.type === 'signature' && element.requiredRole === 'partner') {
      return 'partner';
    }
    
    // Логика по умолчанию на основе типа элемента
    switch (element.type) {
      case 'file':
        return 'assistant';
      case 'question':
      case 'procedure':
        return 'senior_auditor';
      default:
        return 'assistant';
    }
  };

  const toggleProcedure = (stageId: string, element: ProcedureElement) => {
    const key = `${stageId}-${element.id}`;
    setSelectedProcedures(prev => {
      const next = new Map(prev);
      const assignmentsNext = new Map(assignments);
      
      if (next.has(key)) {
        next.delete(key);
        assignmentsNext.delete(key);
      } else {
        // При выборе процедуры автоматически назначаем роль по умолчанию из элемента
        const defaultRole = getDefaultRoleForElement(element);
        next.set(key, {
          stageId,
          elementId: element.id,
          responsibleRole: defaultRole
        });
        assignmentsNext.set(key, { role: defaultRole });
      }
      
      setAssignments(assignmentsNext);
      return next;
    });
  };

  const updateResponsible = (key: string, role: 'assistant' | 'senior_auditor' | 'manager' | 'partner', userId?: string) => {
    setSelectedProcedures(prev => {
      const next = new Map(prev);
      const procedure = next.get(key);
      if (procedure) {
        next.set(key, { ...procedure, responsibleRole: role, responsibleUserId: userId });
      }
      return next;
    });
    setAssignments(prev => {
      const next = new Map(prev);
      next.set(key, { role, userId });
      return next;
    });
  };

  const handleSave = () => {
    const procedures = Array.from(selectedProcedures.values());
    onSave(procedures);
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      assistant: 'Ассистент',
      senior_auditor: 'Старший аудитор',
      manager: 'Менеджер',
      partner: 'Партнёр'
    };
    return labels[role] || role;
  };

  const selectedCount = selectedProcedures.size;
  const totalCount = template.stages.reduce((sum, stage) => sum + stage.elements.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Выбор процедур и распределение ответственности</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Выберите необходимые процедуры для проекта и назначьте ответственных
          </p>
        </div>
        <Badge variant="outline" className="text-base px-3 py-1">
          Выбрано: {selectedCount} / {totalCount}
        </Badge>
      </div>

      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
        {template.stages.map((stage) => {
          const isExpanded = expandedStages.has(stage.id);
          const stageProcedures = Array.from(selectedProcedures.values()).filter(sp => sp.stageId === stage.id);
          const stageTotal = stage.elements.length;
          
          return (
            <Card key={stage.id} className="p-4">
              <div 
                className="flex items-center justify-between cursor-pointer"
                onClick={() => toggleStage(stage.id)}
              >
                <div className="flex items-center gap-3 flex-1">
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge 
                        style={{ backgroundColor: stage.color || '#3b82f6' }}
                        className="text-white"
                      >
                        Этап {stage.order}
                      </Badge>
                      <h4 className="font-semibold">{stage.name}</h4>
                    </div>
                    {stage.description && (
                      <p className="text-sm text-muted-foreground mt-1">{stage.description}</p>
                    )}
                  </div>
                  <Badge variant="secondary" className="ml-2">
                    {stageProcedures.length} / {stageTotal}
                  </Badge>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-4 space-y-3 pl-8 border-l-2" style={{ borderColor: stage.color || '#3b82f6' }}>
                  {stage.elements.map((element) => {
                    const key = `${stage.id}-${element.id}`;
                    const isSelected = selectedProcedures.has(key);
                    const assignment = assignments.get(key);
                    const roleEmployees = assignment?.role ? getEmployeesByRole(assignment.role as any) : [];
                    
                    return (
                      <div key={element.id} className="border rounded-lg p-3 hover:bg-secondary/50 transition-colors">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            id={key}
                            checked={isSelected}
                            onCheckedChange={() => toggleProcedure(stage.id, element)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <Label 
                              htmlFor={key}
                              className="cursor-pointer flex items-center gap-2"
                            >
                              <span className="text-lg">{ELEMENT_TYPE_ICONS[element.type] || '📋'}</span>
                              <span className="font-medium">{element.title}</span>
                              {element.required && (
                                <Badge variant="outline" className="text-xs">Обязательно</Badge>
                              )}
                            </Label>
                            
                            {element.description && (
                              <p className="text-sm text-muted-foreground mt-1 ml-7">
                                {element.description}
                              </p>
                            )}

                            {isSelected && (
                              <div className="mt-3 ml-7 space-y-2 p-3 bg-primary/5 rounded-lg border">
                                <div className="flex items-center gap-3 flex-wrap">
                                  <Label className="text-sm font-medium">Ответственный:</Label>
                                  <Select
                                    value={assignment?.role || 'assistant'}
                                    onValueChange={(value: any) => updateResponsible(key, value)}
                                  >
                                    <SelectTrigger className="w-[180px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="assistant">Ассистент</SelectItem>
                                      <SelectItem value="senior_auditor">Старший аудитор</SelectItem>
                                      <SelectItem value="manager">Менеджер</SelectItem>
                                      <SelectItem value="partner">Партнёр</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                {/* Выбор конкретного сотрудника */}
                                {assignment?.role && roleEmployees.length > 0 && (
                                  <div className="flex items-center gap-3 flex-wrap">
                                    <Label className="text-sm font-medium">Сотрудник:</Label>
                                    <Select
                                      value={assignment?.userId || 'unassigned'}
                                      onValueChange={(userId) => {
                                        // Если выбрано "unassigned", убираем userId
                                        const finalUserId = userId === 'unassigned' ? undefined : userId;
                                        updateResponsible(key, assignment.role as any, finalUserId);
                                      }}
                                    >
                                      <SelectTrigger className="w-[250px]">
                                        <SelectValue placeholder="Выберите сотрудника" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="unassigned">Не назначен</SelectItem>
                                        {roleEmployees.map(emp => {
                                          // Убеждаемся что id не пустой
                                          const empId = emp.id || emp.employeeId || `emp-${Math.random()}`;
                                          return (
                                            <SelectItem key={empId} value={empId}>
                                              {emp.name || 'Без имени'} ({getRoleLabel(assignment.role)})
                                            </SelectItem>
                                          );
                                        })}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}
                                
                                {assignment?.role && roleEmployees.length === 0 && (
                                  <div className="text-xs text-muted-foreground">
                                    Нет доступных сотрудников для роли "{getRoleLabel(assignment.role)}"
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Отмена
          </Button>
        )}
        <Button 
          variant="outline" 
          onClick={() => {
            // Сброс выбора
            setSelectedProcedures(new Map());
            setAssignments(new Map());
          }}
        >
          Сбросить
        </Button>
        <Button onClick={handleSave} className="btn-gradient" disabled={selectedCount === 0}>
          <CheckCircle2 className="w-4 h-4 mr-2" />
          Сохранить выбор ({selectedCount})
        </Button>
      </div>
    </div>
  );
}


