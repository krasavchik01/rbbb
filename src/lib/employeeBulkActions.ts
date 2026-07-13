export type EmployeeDeletionBlockReason = 'current_user' | 'last_privileged_user';

export interface EmployeeDeletionPlan {
  allowedIds: string[];
  blocked: Array<{ id: string; reason: EmployeeDeletionBlockReason }>;
}

function isPrivilegedEmployee(employee: any): boolean {
  return employee?.role === 'ceo' || employee?.role === 'admin';
}

export function planEmployeeBulkDeletion(
  employees: any[],
  selectedIds: Iterable<string>,
  currentUserId?: string | null,
): EmployeeDeletionPlan {
  const byId = new Map(employees.map((employee) => [String(employee.id), employee]));
  const uniqueSelected = Array.from(new Set(Array.from(selectedIds, String))).filter((id) => byId.has(id));
  const blocked: EmployeeDeletionPlan['blocked'] = [];
  const candidates: string[] = [];

  for (const id of uniqueSelected) {
    if (currentUserId && id === String(currentUserId)) {
      blocked.push({ id, reason: 'current_user' });
    } else {
      candidates.push(id);
    }
  }

  const candidateSet = new Set(candidates);
  const privilegedRemaining = employees.filter(
    (employee) => isPrivilegedEmployee(employee) && !candidateSet.has(String(employee.id)),
  ).length;

  if (privilegedRemaining === 0) {
    const allowedIds = candidates.filter((id) => {
      if (!isPrivilegedEmployee(byId.get(id))) return true;
      blocked.push({ id, reason: 'last_privileged_user' });
      return false;
    });
    return { allowedIds, blocked };
  }

  return { allowedIds: candidates, blocked };
}
