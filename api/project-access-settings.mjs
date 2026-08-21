import {
  getSupabaseAdmin,
  parseBody,
  requireAdmin,
  setCors,
} from './_email-utils.mjs';

const USER_ROLES = [
  'ceo', 'deputy_director', 'company_director', 'procurement', 'partner',
  'project_leader', 'manager_1', 'manager_2', 'manager_3', 'supervisor_3',
  'supervisor_2', 'supervisor_1', 'tax_specialist_1', 'tax_specialist_2',
  'assistant_3', 'assistant_2', 'assistant_1', 'contractor', 'academy', 'hr',
  'accountant', 'admin_staff', 'admin_assistant', 'admin',
];
const ALLOWED_ROLES = new Set(USER_ROLES);
const BONUS_ROLES = new Set(['ceo', 'admin']);
const NON_CRITICAL_FINANCE_ROLES = new Set(USER_ROLES.filter((role) => role !== 'admin_assistant'));
const DEFAULT_ACCESS = {
  team: USER_ROLES,
  hours: USER_ROLES,
  contractMoney: ['ceo', 'admin', 'deputy_director', 'procurement', 'accountant'],
  bonuses: ['ceo', 'admin'],
  accounting: ['accountant', 'ceo', 'admin'],
};

function normalizeRoles(value, fallback, allowed = ALLOWED_ROLES) {
  if (!Array.isArray(value)) return [...fallback];
  return Array.from(new Set(value.filter((role) => typeof role === 'string' && allowed.has(role))));
}

function normalizeProjectAccess(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    team: normalizeRoles(source.team, DEFAULT_ACCESS.team),
    hours: normalizeRoles(source.hours, DEFAULT_ACCESS.hours),
    contractMoney: normalizeRoles(source.contractMoney, DEFAULT_ACCESS.contractMoney, NON_CRITICAL_FINANCE_ROLES),
    bonuses: normalizeRoles(source.bonuses, DEFAULT_ACCESS.bonuses, BONUS_ROLES),
    accounting: normalizeRoles(source.accounting, DEFAULT_ACCESS.accounting, NON_CRITICAL_FINANCE_ROLES),
  };
}

function toEnvelope(rawCompanies) {
  if (rawCompanies && typeof rawCompanies === 'object' && !Array.isArray(rawCompanies) && rawCompanies.__suiteASettings === 1) {
    return {
      ...rawCompanies,
      companies: Array.isArray(rawCompanies.companies) ? rawCompanies.companies : [],
    };
  }
  return {
    __suiteASettings: 1,
    companies: Array.isArray(rawCompanies) ? rawCompanies : [],
  };
}

export default async function handler(req, res) {
  setCors(res, 'POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    const supabase = getSupabaseAdmin();
    await requireAdmin(req, supabase, { jwtOnly: true });
    const projectAccess = normalizeProjectAccess(parseBody(req).projectAccess);
    const { data: row, error: readError } = await supabase
      .from('app_settings')
      .select('id,companies')
      .limit(1)
      .maybeSingle();
    if (readError) throw readError;
    if (!row?.id) throw new Error('app_settings row not found');

    const companies = {
      ...toEnvelope(row.companies),
      projectAccess,
    };
    const { error: updateError } = await supabase
      .from('app_settings')
      .update({ companies })
      .eq('id', row.id);
    if (updateError) throw updateError;

    return res.status(200).json({ success: true, projectAccess });
  } catch (error) {
    console.error('project-access-settings error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Project access settings error',
    });
  }
}
