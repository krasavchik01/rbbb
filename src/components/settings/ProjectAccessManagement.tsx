import { useEffect, useMemo, useState } from 'react';
import { Eye, RotateCcw, Save, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DEFAULT_PROJECT_ACCESS_CONTROL,
  BONUS_VISIBILITY_ROLES,
  PROJECT_VISIBILITY_SECTIONS,
  normalizeProjectAccessControl,
  setProjectRoleVisibility,
  type ProjectAccessControl,
  type ProjectVisibilitySection,
} from '@/lib/projectAccessControl';
import { ROLE_LABELS, USER_ROLES, type UserRole } from '@/types/roles';

interface ProjectAccessManagementProps {
  value: ProjectAccessControl;
  saving?: boolean;
  onSave: (value: ProjectAccessControl) => Promise<void>;
}

export function ProjectAccessManagement({ value, saving = false, onSave }: ProjectAccessManagementProps) {
  const [draft, setDraft] = useState<ProjectAccessControl>(() => normalizeProjectAccessControl(value));
  const normalizedValue = useMemo(() => normalizeProjectAccessControl(value), [value]);

  useEffect(() => {
    setDraft(normalizedValue);
  }, [normalizedValue]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(normalizedValue);

  const toggle = (role: UserRole, section: ProjectVisibilitySection, visible: boolean) => {
    setDraft((current) => setProjectRoleVisibility(current, role, section, visible));
  };

  const applySafeDefaults = () => {
    setDraft(normalizeProjectAccessControl(DEFAULT_PROJECT_ACCESS_CONTROL));
  };

  return (
    <section className="space-y-4" aria-label="Управление видимостью единого свода" data-testid="project-access-management">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Кто что видит в едином своде
          </h3>
          <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">
            Каждая галочка действует для всей роли. По умолчанию бонусы видят только CEO и администратор,
            а менять суммы может только CEO.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={applySafeDefaults} disabled={saving}>
            <RotateCcw className="mr-1.5 h-4 w-4" />Безопасные настройки
          </Button>
          <Button type="button" size="sm" onClick={() => void onSave(draft)} disabled={!dirty || saving} data-testid="save-project-access">
            <Save className="mr-1.5 h-4 w-4" />{saving ? 'Сохраняю…' : 'Сохранить доступы'}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        {USER_ROLES.map((role) => (
          <div key={role} className="min-w-0 rounded-lg border bg-card p-3" data-role={role}>
            <div className="mb-3 flex min-w-0 items-center gap-2">
              <Eye className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 break-words text-sm font-semibold">{ROLE_LABELS[role]}</div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {PROJECT_VISIBILITY_SECTIONS.map((section) => {
                const checked = draft[section.key].includes(role);
                const locked = section.key === 'bonuses' && !BONUS_VISIBILITY_ROLES.includes(role);
                return (
                  <label
                    key={section.key}
                    className={`flex min-w-0 items-start gap-2 rounded-md border bg-background px-3 py-2 transition-colors ${locked ? 'cursor-not-allowed opacity-55' : 'cursor-pointer hover:bg-accent/40'}`}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={locked || saving}
                      onCheckedChange={(next) => toggle(role, section.key, next === true)}
                      aria-label={`${ROLE_LABELS[role]}: ${section.label}`}
                    />
                    <span className="min-w-0">
                      <span className="block break-words text-sm font-medium">{section.label}</span>
                      <span className="mt-0.5 block break-words text-[11px] leading-4 text-muted-foreground">{section.description}</span>
                      {locked && <span className="mt-0.5 block text-[10px] font-medium text-amber-700 dark:text-amber-300">Защищено: только CEO и администратор</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
        Снятая галочка полностью убирает соответствующий блок из интерфейса роли и из её Excel-выгрузки.
        Доступ к самим проектам по компаниям настраивается ниже отдельно.
      </div>
    </section>
  );
}
