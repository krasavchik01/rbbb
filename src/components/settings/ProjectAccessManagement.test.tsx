import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ProjectAccessManagement } from './ProjectAccessManagement';
import {
  DEFAULT_PROJECT_ACCESS_CONTROL,
  PROJECT_VISIBILITY_SECTIONS,
  setProjectRoleVisibility,
} from '@/lib/projectAccessControl';
import { ROLE_LABELS, USER_ROLES } from '@/types/roles';

function renderAccessManagement(
  value = DEFAULT_PROJECT_ACCESS_CONTROL,
  saving = false,
): string {
  return renderToStaticMarkup(
    <ProjectAccessManagement value={value} saving={saving} onSave={vi.fn()} />,
  );
}

function openingTagFor(html: string, marker: string): string {
  const markerIndex = html.indexOf(marker);
  expect(markerIndex, `Expected markup to contain ${marker}`).toBeGreaterThanOrEqual(0);
  const tagStart = html.lastIndexOf('<', markerIndex);
  const tagEnd = html.indexOf('>', markerIndex);
  return html.slice(tagStart, tagEnd + 1);
}

describe('ProjectAccessManagement', () => {
  it('renders a complete role-by-section checkbox matrix', () => {
    const html = renderAccessManagement();

    expect(html).toContain('data-testid="project-access-management"');
    expect(html.match(/data-role="/g)).toHaveLength(USER_ROLES.length);
    expect(html.match(/role="checkbox"/g)).toHaveLength(
      USER_ROLES.length * PROJECT_VISIBILITY_SECTIONS.length,
    );

    for (const section of PROJECT_VISIBILITY_SECTIONS) {
      expect(html).toContain(section.label);
    }
  });

  it('shows the safe default bonus visibility in checkbox state', () => {
    const html = renderAccessManagement();
    const ceoBonus = openingTagFor(html, `aria-label="${ROLE_LABELS.ceo}: Бонусы"`);
    const adminBonus = openingTagFor(html, `aria-label="${ROLE_LABELS.admin}: Бонусы"`);
    const deputyBonus = openingTagFor(html, `aria-label="${ROLE_LABELS.deputy_director}: Бонусы"`);

    expect(ceoBonus).toContain('data-state="checked"');
    expect(adminBonus).toContain('data-state="checked"');
    expect(deputyBonus).toContain('data-state="unchecked"');
  });

  it('refuses a custom bonus grant outside CEO and admin without mutating the defaults', () => {
    const custom = setProjectRoleVisibility(
      DEFAULT_PROJECT_ACCESS_CONTROL,
      'deputy_director',
      'bonuses',
      true,
    );
    const html = renderAccessManagement(custom);
    const deputyBonus = openingTagFor(html, `aria-label="${ROLE_LABELS.deputy_director}: Бонусы"`);

    expect(deputyBonus).toContain('data-state="unchecked"');
    expect(deputyBonus).toContain('disabled=""');
    expect(DEFAULT_PROJECT_ACCESS_CONTROL.bonuses).toEqual(['ceo', 'admin']);
  });

  it('keeps save disabled for a clean draft and locks controls while saving', () => {
    const cleanHtml = renderAccessManagement();
    const cleanSaveButton = openingTagFor(cleanHtml, 'data-testid="save-project-access"');
    expect(cleanSaveButton).toContain('disabled=""');

    const savingHtml = renderAccessManagement(DEFAULT_PROJECT_ACCESS_CONTROL, true);
    const savingButton = openingTagFor(savingHtml, 'data-testid="save-project-access"');
    expect(savingButton).toContain('disabled=""');
    expect(savingHtml).toContain('Сохраняю…');
  });
});
