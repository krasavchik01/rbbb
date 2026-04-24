import React, { useState } from 'react';
import { Users, Search, X, ChevronRight, UserPlus } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/types/roles";
import { UserRole } from "@/types/roles";

export interface TeamMemberSlot {
  key: string;
  label: string;
  color?: string;
  roles?: string[]; // Recommended roles, but not restrictive
}

interface TeamAssignmentProps {
  employees: any[];
  teamSlots: Record<string, string | null>;
  onChange: (slots: Record<string, string | null>) => void;
  slots: TeamMemberSlot[];
  onAddNewEmployee?: (slotKey: string) => void;
  selectedSlots?: Record<string, boolean>;
  onToggleSlot?: (slotKey: string, checked: boolean) => void;
  disabledSlots?: string[];
}

export const TeamAssignment: React.FC<TeamAssignmentProps> = ({
  employees = [],
  teamSlots,
  onChange,
  slots,
  onAddNewEmployee,
  selectedSlots,
  onToggleSlot,
  disabledSlots = []
}) => {
  const [openSlotDropdown, setOpenSlotDropdown] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSelect = (slotKey: string, empId: string | null) => {
    onChange({ ...teamSlots, [slotKey]: empId });
    setOpenSlotDropdown(null);
    setSearchQuery('');
  };

  return (
    <div className="space-y-3">
      {slots.map((slot) => {
        const assignedEmpId = teamSlots[slot.key];
        const assignedEmp = assignedEmpId ? employees.find(e => e.id === assignedEmpId) : null;
        const isOpen = openSlotDropdown === slot.key;

        // Фильтрация: Показываем ВСЕХ сотрудников (согласно требованию), 
        // но можем подсвечивать тех, кто подходит по роли в будущем если нужно.
        const q = searchQuery.toLowerCase();
        const filteredEmps = employees
          .filter(emp => {
            // Исключаем уже назначенных в ДРУГИЕ слоты
            const usedIds = Object.values(teamSlots).filter(Boolean) as string[];
            if (usedIds.includes(emp.id) && emp.id !== assignedEmpId) return false;

            if (!q) return true;
            const nameMatch = emp.name.toLowerCase().includes(q);
            const roleLabel = (ROLE_LABELS[emp.role as UserRole] || emp.role || '').toLowerCase();
            return nameMatch || roleLabel.includes(q);
          })
          .sort((a, b) => {
            // Приоритет 1: Совпадение по рекомендованной роли слота (если есть)
            if (!q && slot.roles?.length) {
              const aMatches = slot.roles.includes(a.role);
              const bMatches = slot.roles.includes(b.role);
              if (aMatches && !bMatches) return -1;
              if (!aMatches && bMatches) return 1;
            }
            return a.name.localeCompare(b.name);
          });

        return (
          <div key={slot.key} className="relative space-y-2">
            {onToggleSlot && (
              <div className="flex items-center gap-2 px-1">
                <input
                  type="checkbox"
                  id={`slot-${slot.key}`}
                  checked={selectedSlots?.[slot.key] || false}
                  disabled={disabledSlots.includes(slot.key)}
                  onChange={(e) => onToggleSlot(slot.key, e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label htmlFor={`slot-${slot.key}`} className="text-sm font-medium cursor-pointer">
                  Использовать роль {slot.label}
                </label>
              </div>
            )}
            
            {(!onToggleSlot || selectedSlots?.[slot.key]) && (
              <>
                <div
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    assignedEmp
                      ? 'border-primary/30 bg-primary/5 hover:border-primary/50'
                      : 'border-dashed border-border hover:border-primary/40 hover:bg-muted/30'
                  }`}
                  onClick={() => {
                    if (isOpen) {
                      setOpenSlotDropdown(null);
                      setSearchQuery('');
                    } else {
                      setOpenSlotDropdown(slot.key);
                      setSearchQuery('');
                    }
                  }}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${slot.color || 'bg-muted text-muted-foreground'}`}>
                    {assignedEmp
                      ? assignedEmp.name.split(' ').slice(0, 2).map((p: any) => p[0]).join('').toUpperCase()
                      : slot.label[0]}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{slot.label}</div>
                    {assignedEmp ? (
                      <div className="font-semibold text-sm truncate">{assignedEmp.name}</div>
                    ) : (
                      <div className="text-sm text-muted-foreground/60">Нажмите чтобы выбрать...</div>
                    )}
                  </div>
                  {assignedEmp && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-red-100 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelect(slot.key, null);
                      }}
                    >
                      <X className="w-4 h-4 text-red-500" />
                    </Button>
                  )}
                  <ChevronRight className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                </div>

                {isOpen && (
                  <div className="mt-1 border rounded-xl bg-card shadow-lg overflow-hidden z-20 relative">
                    <div className="p-2 border-b">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                        <Input
                          placeholder="Поиск по имени или роли..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-8 h-8 text-sm"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>

                    <div className="max-h-60 overflow-y-auto">
                      {filteredEmps.length === 0 && (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          Сотрудники не найдены
                        </div>
                      )}
                      {filteredEmps.map((emp) => (
                        <div
                          key={emp.id}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-primary/5 cursor-pointer transition-colors border-b last:border-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelect(slot.key, emp.id);
                          }}
                        >
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                            {emp.name.split(' ').slice(0, 2).map((p: any) => p[0]).join('').toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <div className="text-sm font-medium truncate">{emp.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {ROLE_LABELS[emp.role as UserRole] || emp.role}
                            </div>
                          </div>
                          {slot.roles?.includes(emp.role) && (
                            <Badge variant="secondary" className="text-[10px] h-4">Рекомендован</Badge>
                          )}
                        </div>
                      ))}
                    </div>

                    {onAddNewEmployee && (
                      <div className="p-2 border-t bg-muted/30">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full justify-start text-xs h-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddNewEmployee(slot.key);
                          }}
                        >
                          <UserPlus className="w-3.5 h-3.5 mr-2" />
                          Добавить нового сотрудника
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};
