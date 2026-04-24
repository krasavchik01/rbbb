import { useState, useEffect, useMemo } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  closestCenter,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Building2,
  Search,
  GripVertical,
  CheckCircle,
  User,
  Shield,
  ShieldOff,
  Users,
  ArrowRight,
  X,
} from 'lucide-react';
import { useAppSettings } from '@/lib/appSettings';
import { useEmployees } from '@/hooks/useSupabaseData';
import {
  getUserCompanyAccessMap,
  setUserAllowedCompanyIds,
  removeUserCompanyAccess,
} from '@/lib/userCompanyAccess';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

// ─── Draggable Company Card ───────────────────────────────────────────────────

function DraggableCompanyCard({
  company,
  inAssigned,
  isOverlay = false,
}: {
  company: { id: string; name: string; fullName?: string };
  inAssigned: boolean;
  isOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: company.id,
    data: { company, inAssigned },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging && !isOverlay ? 0.3 : 1,
    touchAction: 'none',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all cursor-grab active:cursor-grabbing select-none ${
        isOverlay
          ? 'shadow-xl bg-background border-primary scale-105'
          : inAssigned
          ? 'bg-primary/5 border-primary/20 hover:border-primary/40'
          : 'bg-muted/30 border-border hover:border-primary/30'
      }`}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Building2 className="w-3.5 h-3.5 text-primary" />
      </div>
      <span className="text-sm font-medium truncate flex-1">{company.name}</span>
      {inAssigned && <CheckCircle className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
    </div>
  );
}

// ─── Drop Zone ────────────────────────────────────────────────────────────────

function DropZone({
  id,
  label,
  count,
  children,
  isActive,
  variant,
}: {
  id: string;
  label: string;
  count: number;
  children: React.ReactNode;
  isActive: boolean;
  variant: 'available' | 'assigned';
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-2xl border-2 transition-all duration-200 ${
        isOver
          ? variant === 'assigned'
            ? 'border-primary bg-primary/5'
            : 'border-orange-400 bg-orange-500/5'
          : isActive
          ? 'border-dashed border-primary/40'
          : 'border-dashed border-border'
      }`}
    >
      <div className="flex items-center justify-between p-3 pb-2">
        <div className="flex items-center gap-2">
          {variant === 'assigned' ? (
            <Shield className="w-4 h-4 text-primary" />
          ) : (
            <Building2 className="w-4 h-4 text-muted-foreground" />
          )}
          <span className="font-semibold text-sm">{label}</span>
        </div>
        <Badge
          variant={variant === 'assigned' ? 'default' : 'secondary'}
          className="text-xs"
        >
          {count}
        </Badge>
      </div>
      <div className="flex-1 p-3 pt-1 space-y-1.5 min-h-[180px]">
        {count === 0 ? (
          <div className="h-full flex items-center justify-center py-8">
            <p className="text-xs text-muted-foreground/50 text-center">
              {variant === 'assigned'
                ? 'Перетащите сюда компании'
                : 'Все компании назначены'}
            </p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function UserCompanyAssignment() {
  const { toast } = useToast();
  const { updateUser, user: currentUser } = useAuth();
  const [appSettings] = useAppSettings();
  const { employees = [] } = useEmployees();

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [accessMap, setAccessMap] = useState<Record<string, string[]>>({});
  const [userSearch, setUserSearch] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Загружаем карту доступа из Supabase при монтировании
  useEffect(() => {
    getUserCompanyAccessMap().then(map => {
      setAccessMap(map);
    });
  }, []);

  const companies = appSettings.companies || [];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  // Список пользователей из сотрудников (исключаем admin)
  const userList = useMemo(() => {
    return employees
      .filter((e: any) => e.role !== 'admin' && e.name)
      .sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
  }, [employees]);

  const filteredUsers = useMemo(() => {
    if (!userSearch) return userList;
    const q = userSearch.toLowerCase();
    return userList.filter(
      (e: any) =>
        (e.name || '').toLowerCase().includes(q) ||
        (e.email || '').toLowerCase().includes(q)
    );
  }, [userList, userSearch]);

  // Компании для выбранного пользователя
  const assignedIds: string[] = selectedUserId
    ? (accessMap[selectedUserId] ?? [])
    : [];

  const assignedCompanies = companies.filter((c: any) => assignedIds.includes(c.id));
  const availableCompanies = companies.filter((c: any) => !assignedIds.includes(c.id));

  const isRestricted = selectedUserId ? selectedUserId in accessMap : false;

  // DnD handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setIsDragging(true);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    setIsDragging(false);
    if (!selectedUserId) return;

    const { active, over } = event;
    if (!over) return;

    const companyId = active.id as string;
    const fromAssigned = (active.data.current as any)?.inAssigned;
    const toAssigned = over.id === 'assigned';
    const toAvailable = over.id === 'available';

    let newIds = [...assignedIds];

    if (!fromAssigned && toAssigned) {
      // available → assigned
      if (!newIds.includes(companyId)) newIds.push(companyId);
    } else if (fromAssigned && toAvailable) {
      // assigned → available
      newIds = newIds.filter((id) => id !== companyId);
    }

    const newMap = { ...accessMap, [selectedUserId]: newIds };
    setAccessMap(newMap);
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setIsDragging(false);
  };

  const activeCompany = activeId ? companies.find((c: any) => c.id === activeId) : null;
  const activeIsAssigned = activeId ? assignedIds.includes(activeId) : false;

  // Save
  const handleSave = async () => {
    if (!selectedUserId) return;
    const ids = accessMap[selectedUserId] ?? [];
    if (ids.length === 0) {
      // Если список пуст — снимаем ограничение
      await removeUserCompanyAccess(selectedUserId);
      const newMap = { ...accessMap };
      delete newMap[selectedUserId];
      setAccessMap(newMap);
    } else {
      await setUserAllowedCompanyIds(selectedUserId, ids);
    }
    // Обновляем текущего пользователя если он изменил сам себя
    if (currentUser?.id === selectedUserId) {
      updateUser({ allowedCompanyIds: ids.length > 0 ? ids : null });
    }
    toast({ title: 'Сохранено', description: 'Доступ к компаниям обновлён' });
  };

  // Remove restriction
  const handleRemoveRestriction = async () => {
    if (!selectedUserId) return;
    await removeUserCompanyAccess(selectedUserId);
    const newMap = { ...accessMap };
    delete newMap[selectedUserId];
    setAccessMap(newMap);
    if (currentUser?.id === selectedUserId) {
      updateUser({ allowedCompanyIds: null });
    }
    toast({ title: 'Ограничения сняты', description: 'Пользователь видит все проекты' });
  };

  const selectedEmployee = selectedUserId
    ? (employees as any[]).find((e: any) => e.id === selectedUserId)
    : null;

  return (
    <div className="space-y-4">
      {/* Hint */}
      <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
        <ArrowRight className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-blue-700 dark:text-blue-300">
          Выберите пользователя и перетащите компании в зону «Доступные». Пользователь будет
          видеть только проекты этих компаний. Без ограничений — видит всё.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Users list */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Поиск сотрудника..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="pl-8 text-sm bg-muted/40 border-0 focus-visible:ring-1"
            />
          </div>
          <div className="space-y-1 max-h-[420px] overflow-y-auto pr-1">
            {filteredUsers.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Нет сотрудников
              </p>
            )}
            {filteredUsers.map((emp: any) => {
              const isSelected = selectedUserId === emp.id;
              const hasRestriction = emp.id in accessMap;
              const restrictedCount = accessMap[emp.id]?.length ?? 0;
              return (
                <button
                  key={emp.id}
                  onClick={() => setSelectedUserId(emp.id)}
                  className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl text-left transition-all ${
                    isSelected
                      ? 'bg-primary/10 border border-primary/30'
                      : 'hover:bg-muted/50 border border-transparent'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                    {(emp.name || 'N')[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{emp.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{emp.role}</p>
                  </div>
                  {hasRestriction ? (
                    <Badge variant="secondary" className="text-xs bg-orange-500/15 text-orange-600 flex-shrink-0">
                      {restrictedCount}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs flex-shrink-0 opacity-50">
                      Все
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* DnD area */}
        <div className="lg:col-span-2">
          {!selectedUserId ? (
            <div className="h-full flex items-center justify-center py-16 border-2 border-dashed border-border rounded-2xl">
              <div className="text-center">
                <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Выберите сотрудника слева</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* User header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    {(selectedEmployee?.name || 'N')[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{selectedEmployee?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {isRestricted
                        ? `Ограничен: ${assignedIds.length} компани${assignedIds.length === 1 ? 'я' : assignedIds.length < 5 ? 'и' : 'й'}`
                        : 'Без ограничений — видит все проекты'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isRestricted && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs gap-1.5 text-orange-600 border-orange-300 hover:bg-orange-50"
                      onClick={handleRemoveRestriction}
                    >
                      <ShieldOff className="w-3.5 h-3.5" />
                      Снять
                    </Button>
                  )}
                  <Button size="sm" className="text-xs gap-1.5" onClick={handleSave}>
                    <Shield className="w-3.5 h-3.5" />
                    Сохранить
                  </Button>
                </div>
              </div>

              {/* DnD columns */}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
              >
                <div className="grid grid-cols-2 gap-3">
                  <DropZone
                    id="available"
                    label="Доступные"
                    count={availableCompanies.length}
                    isActive={isDragging}
                    variant="available"
                  >
                    {availableCompanies.map((c: any) => (
                      <DraggableCompanyCard
                        key={c.id}
                        company={c}
                        inAssigned={false}
                      />
                    ))}
                  </DropZone>

                  <DropZone
                    id="assigned"
                    label="Назначено"
                    count={assignedCompanies.length}
                    isActive={isDragging}
                    variant="assigned"
                  >
                    {assignedCompanies.map((c: any) => (
                      <DraggableCompanyCard
                        key={c.id}
                        company={c}
                        inAssigned={true}
                      />
                    ))}
                  </DropZone>
                </div>

                <DragOverlay dropAnimation={null}>
                  {activeCompany && (
                    <DraggableCompanyCard
                      company={activeCompany}
                      inAssigned={activeIsAssigned}
                      isOverlay
                    />
                  )}
                </DragOverlay>
              </DndContext>

              <p className="text-xs text-muted-foreground text-center">
                Перетащите компанию в колонку «Назначено» — пользователь увидит только её проекты
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
