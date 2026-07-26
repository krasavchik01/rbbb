import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ProjectInlineDetail, type ProjectInlineDetailProps } from './ProjectInlineDetail';

const baseProps: ProjectInlineDetailProps = {
  projectId: 'project-1',
  name: 'Project',
  statusLabel: 'In work',
  team: {
    count: 1,
    members: [{ id: 'employee-1', name: 'Alice Employee', roles: ['Partner'], approvedHours: 12, pendingHours: 0 }],
  },
  deadline: { rangeLabel: '2026', stateLabel: 'On time' },
  hours: { approved: 12, pending: 0 },
  contract: { filesCount: 0 },
  finances: {
    contractAmount: 1_000_000,
    gphAmount: 0,
    preExpenseAmount: 0,
    allocatedBonusAmount: 100_000,
    grossIncome: 900_000,
  },
  bonuses: {
    poolAmount: 100_000,
    poolPercent: 10,
    editable: true,
    employees: [{
      id: 'employee-1',
      name: 'Alice Employee',
      roles: ['Partner'],
      approvedHours: 12,
      pendingHours: 0,
      amount: 100_000,
    }],
  },
  advancedOpen: false,
  onToggleAdvanced: vi.fn(),
};

function renderDetail(overrides: Partial<ProjectInlineDetailProps>): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <ProjectInlineDetail {...baseProps} {...overrides} />
    </MemoryRouter>,
  );
}

describe('ProjectInlineDetail access combinations', () => {
  it('keeps exact employee bonuses visible when the ordinary team section is disabled', () => {
    const html = renderDetail({ showTeam: false, showBonuses: true });

    expect(html).toContain('data-testid="member-bonus-project-1-employee-1"');
    expect(html).toContain('Alice Employee');
    expect(html).toContain('data-testid="employee-bonus-employee-1-input"');
  });

  it('does not render employee identities when both team and bonuses are disabled', () => {
    const html = renderDetail({ showTeam: false, showBonuses: false });

    expect(html).not.toContain('data-testid="project-team-ledger"');
    expect(html).not.toContain('Alice Employee');
  });
});
