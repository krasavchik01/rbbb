/**
 * Типы для модуля МСУК-1 Compliance Manager
 */

export interface TeamMember {
  name: string;
  role: string;
  position: string;
}

export interface Management {
  director: string;
  directorPosition: string;
  directorContact: string;
  accountant: string;
  accountantContact: string;
}

export interface FinancialData {
  revenue: string;
  expenses: string;
  profit: string;
  assets: string;
  liabilities: string;
  equity: string;
}

export interface MSUKClient {
  id: number;
  name: string;
  inn: string;
  country: 'RU' | 'KZ';
  industry: string;
  address?: string;
  publicCompany: boolean;
  litigation: boolean;
  conflictOfInterest: boolean;
  employees: string;
  employeesInAccounting?: string;
  revenue: string;
  documentFlow?: string;
  management?: Management;
  financialData?: FinancialData;
  teamMembers?: TeamMember[];
  documents: {
    [key: string]: string;
  };
}

export interface RiskResult {
  riskLevel: number;
  riskText: 'ВЫСОКИЙ' | 'СРЕДНИЙ' | 'НИЗКИЙ';
  factors: string[];
  eqrRequired: boolean;
}

export interface MSUKFormData {
  name: string;
  inn: string;
  country: 'RU' | 'KZ';
  industry: string;
  address: string;
  publicCompany: boolean;
  litigation: boolean;
  conflictOfInterest: boolean;
  employees: string;
  employeesInAccounting: string;
  revenue: string;
  documentFlow: string;
  management: Management;
  teamMembers: TeamMember[];
}

