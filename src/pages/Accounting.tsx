import { useMemo, useState, type ChangeEvent } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  FileCheck2,
  FileText,
  Loader2,
  ReceiptText,
  Search,
  Send,
  Trash2,
  WalletCards,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProjects } from '@/hooks/useSupabaseData';
import { useToast } from '@/hooks/use-toast';
import { supabaseDataStore, type Project } from '@/lib/supabaseDataStore';
import { projectContract, projectContractFiles, projectNotes } from '@/lib/contractData';
import { effectiveProjectTeam } from '@/lib/projectLegacyCompatibility';
import { projectForAccountingWorkspace } from '@/lib/accountingAccess';
import { sendEmail } from '@/lib/emailService';
import {
  ACCOUNTING_DOCUMENT_STATUS_LABELS,
  ACCOUNTING_PAYMENT_KIND_LABELS,
  ACCOUNTING_STATUS_LABELS,
  addAccountingPayment,
  calculateAccountingProject,
  projectAccountingLedger,
  updateAccountingContact,
  upsertAccountingDocument,
  type AccountingContact,
  type AccountingDocument,
  type AccountingDocumentStatus,
  type AccountingDocumentType,
  type AccountingFile,
  type AccountingPayment,
  type AccountingPaymentKind,
  type AccountingProjectStatus,
  type AccountingProjectSummary,
} from '@/lib/accountingLedger';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { projectCompanyName } from '@/types/companies';

type EntryKind = AccountingDocumentType | 'payment';
type AccountingRow = {
  project: Project;
  summary: AccountingProjectSummary;
  clientName: string;
  companyName: string;
  contractNumber: string;
  contractDate: string;
  deadline: string;
  leaderName: string;
};

const STATUS_COLORS: Record<AccountingProjectStatus, string> = {
  needs_contract: 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
  needs_invoice: 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200',
  awaiting_payment: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
  overdue: 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200',
  needs_avr: 'border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200',
  awaiting_signature: 'border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-200',
  complete: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
};

function makeId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateAfter(days: number): string {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('ru-RU').format(date);
}

function formatMoney(value: number, currency = 'KZT'): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'KZT' ? 0 : 2,
  }).format(Number(value) || 0);
}

function formatCompactMoney(value: number, currency = 'KZT'): string {
  const amount = Number(value) || 0;
  const symbol = currency === 'KZT' ? '₸' : currency;
  const format = (scaled: number) => new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: scaled >= 100 ? 0 : 1,
  }).format(scaled);
  if (Math.abs(amount) >= 1_000_000_000) return `${format(amount / 1_000_000_000)} млрд ${symbol}`;
  if (Math.abs(amount) >= 1_000_000) return `${format(amount / 1_000_000)} млн ${symbol}`;
  if (Math.abs(amount) >= 1_000) return `${format(amount / 1_000)} тыс. ${symbol}`;
  return `${format(amount)} ${symbol}`;
}

function clientName(project: any): string {
  const notes = projectNotes(project);
  const client = project.client || notes.client || {};
  return String(project.clientName || notes.clientName || client.name || project.name || 'Проект без названия').trim();
}

function leaderName(project: any): string {
  const team = effectiveProjectTeam(project);
  const leader = team.find((member: any) => (
    ['project_leader', 'manager_1', 'manager_2', 'manager_3'].includes(String(member?.role || ''))
  ));
  return String(leader?.userName || leader?.name || '—');
}

function storedFile(result: any, source: File): AccountingFile {
  const file = result?.file || {};
  return {
    ...file,
    id: file.id || result?.id,
    fileName: file.fileName || file.name || source.name,
    storagePath: file.storagePath || result?.storagePath,
    publicUrl: file.publicUrl || result?.publicUrl,
    url: file.url,
    isSeafile: Boolean(file.isSeafile || result?.storagePath),
    fileType: file.fileType || source.type,
    fileSize: Number(file.fileSize || source.size || 0),
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function ContactEditor({
  row,
  saving,
  onSave,
}: {
  row: AccountingRow;
  saving: boolean;
  onSave: (row: AccountingRow, contact: AccountingContact) => Promise<void>;
}) {
  const current = row.summary.ledger.contact || {};
  const [contact, setContact] = useState<AccountingContact>(current);
  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold">Контакт заказчика</div>
          <div className="text-xs text-muted-foreground">Кому бухгалтерия отправляет счёт и АВР</div>
        </div>
        <Button size="sm" disabled={saving} onClick={() => onSave(row, contact)}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Сохранить
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Input value={contact.name || ''} onChange={(event) => setContact((value) => ({ ...value, name: event.target.value }))} placeholder="ФИО" />
        <Input value={contact.phone || ''} onChange={(event) => setContact((value) => ({ ...value, phone: event.target.value }))} placeholder="Телефон" />
        <Input type="email" value={contact.email || ''} onChange={(event) => setContact((value) => ({ ...value, email: event.target.value }))} placeholder="Электронная почта" />
      </div>
      <Textarea className="mt-3 min-h-20" value={contact.notes || ''} onChange={(event) => setContact((value) => ({ ...value, notes: event.target.value }))} placeholder="Примечание: способ отправки, особые требования заказчика…" />
    </div>
  );
}

export default function Accounting() {
  const { user } = useAuth();
  const { projects, loading, error, updateProject } = useProjects();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | AccountingProjectStatus>('all');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [entry, setEntry] = useState<{ kind: EntryKind; row: AccountingRow } | null>(null);
  const [amount, setAmount] = useState('');
  const [number, setNumber] = useState('');
  const [entryDate, setEntryDate] = useState(today());
  const [dueDate, setDueDate] = useState(dateAfter(14));
  const [paymentKind, setPaymentKind] = useState<AccountingPaymentKind>('advance');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [savingKey, setSavingKey] = useState('');

  const rows = useMemo<AccountingRow[]>(() => projects.map(projectForAccountingWorkspace).map((project) => {
    const contract = projectContract(project);
    return {
      project,
      summary: calculateAccountingProject(project),
      clientName: clientName(project),
      companyName: projectCompanyName(project),
      contractNumber: String(contract?.number || '—'),
      contractDate: String(contract?.date || ''),
      deadline: String(contract?.serviceEndDate || project.deadline || ''),
      leaderName: leaderName(project),
    };
  }), [projects]);

  const companies = useMemo(() => Array.from(new Set(rows.map((row) => row.companyName))).sort(), [rows]);
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (companyFilter !== 'all' && row.companyName !== companyFilter) return false;
      if (statusFilter !== 'all' && row.summary.status !== statusFilter) return false;
      if (!query) return true;
      const contact = row.summary.ledger.contact || {};
      return [
        row.clientName,
        row.companyName,
        row.contractNumber,
        row.leaderName,
        contact.name,
        contact.phone,
        contact.email,
      ].some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [rows, search, companyFilter, statusFilter]);

  const totalsByCurrency = useMemo(() => {
    const result: Record<string, { contract: number; invoiced: number; paid: number; receivable: number; overdue: number }> = {};
    for (const row of filteredRows) {
      const currency = row.summary.currency;
      result[currency] ||= { contract: 0, invoiced: 0, paid: 0, receivable: 0, overdue: 0 };
      result[currency].contract += row.summary.contractAmount;
      result[currency].invoiced += row.summary.invoiceAmount;
      result[currency].paid += row.summary.paidAmount;
      result[currency].receivable += row.summary.receivableAmount;
      result[currency].overdue += row.summary.overdueAmount;
    }
    return result;
  }, [filteredRows]);

  const primaryCurrency = totalsByCurrency.KZT ? 'KZT' : Object.keys(totalsByCurrency)[0] || 'KZT';
  const primaryTotals = totalsByCurrency[primaryCurrency] || { contract: 0, invoiced: 0, paid: 0, receivable: 0, overdue: 0 };

  const openEntry = (row: AccountingRow, kind: EntryKind) => {
    const already = kind === 'invoice'
      ? row.summary.invoiceAmount
      : kind === 'avr'
        ? row.summary.avrAmount
        : row.summary.paidAmount;
    setEntry({ row, kind });
    setAmount(String(Math.max(0, row.summary.contractAmount - already) || ''));
    setNumber('');
    setEntryDate(today());
    setDueDate(dateAfter(14));
    setPaymentKind(row.summary.paidAmount > 0 ? 'interim' : 'advance');
    setReference('');
    setNotes('');
    setFile(null);
  };

  const saveEntry = async () => {
    if (!entry || !user) return;
    const parsedAmount = Number(String(amount).replace(/\s/g, '').replace(',', '.'));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast({ title: 'Укажите сумму больше нуля', variant: 'destructive' });
      return;
    }
    if (!entryDate) {
      toast({ title: 'Укажите дату', variant: 'destructive' });
      return;
    }
    if (entry.kind !== 'payment' && !number.trim()) {
      toast({ title: entry.kind === 'invoice' ? 'Укажите номер счёта' : 'Укажите номер АВР', variant: 'destructive' });
      return;
    }

    const saveKey = `${entry.row.project.id}:${entry.kind}:new`;
    setSavingKey(saveKey);
    try {
      let uploadedFile: AccountingFile | undefined;
      if (file) {
        const result = await supabaseDataStore.uploadProjectFile(entry.row.project.id, file, 'document', user.id);
        uploadedFile = storedFile(result, file);
      }
      const now = new Date().toISOString();
      await updateProject(entry.row.project.id, (current: Project) => {
        const currentLedger = projectAccountingLedger(current);
        const nextLedger = entry.kind === 'payment'
          ? addAccountingPayment(currentLedger, {
              id: makeId('payment'),
              date: entryDate,
              amount: parsedAmount,
              kind: paymentKind,
              reference: reference.trim() || undefined,
              notes: notes.trim() || undefined,
              file: uploadedFile,
              createdAt: now,
              createdBy: user.name || user.id,
            }, user.name || user.id)
          : upsertAccountingDocument(currentLedger, {
              id: makeId(entry.kind),
              type: entry.kind,
              number: number.trim(),
              issueDate: entryDate,
              dueDate: entry.kind === 'invoice' ? dueDate || undefined : undefined,
              amount: parsedAmount,
              status: 'issued',
              notes: notes.trim() || undefined,
              file: uploadedFile,
              createdAt: now,
              createdBy: user.name || user.id,
            }, user.name || user.id);
        return { notes: { ...current.notes, accounting: nextLedger } };
      });
      toast({
        title: entry.kind === 'payment' ? 'Оплата учтена' : entry.kind === 'invoice' ? 'Счёт выставлен' : 'АВР добавлен',
        description: `${entry.row.clientName} · ${formatMoney(parsedAmount, entry.row.summary.currency)}`,
      });
      setEntry(null);
      setExpanded((value) => ({ ...value, [entry.row.project.id]: true }));
    } catch (saveError: any) {
      toast({ title: 'Не удалось сохранить', description: saveError?.message || 'Повторите попытку', variant: 'destructive' });
    } finally {
      setSavingKey('');
    }
  };

  const updateDocumentStatus = async (row: AccountingRow, document: AccountingDocument, status: AccountingDocumentStatus) => {
    if (!user) return;
    const key = `${row.project.id}:${document.id}:${status}`;
    setSavingKey(key);
    try {
      const now = new Date().toISOString();
      await updateProject(row.project.id, (current: Project) => {
        const ledger = projectAccountingLedger(current);
        const next = upsertAccountingDocument(ledger, {
          ...document,
          status,
          sentAt: status === 'sent' ? now : document.sentAt,
          signedAt: status === 'signed' ? now : document.signedAt,
          updatedAt: now,
          updatedBy: user.name || user.id,
        }, user.name || user.id);
        return { notes: { ...current.notes, accounting: next } };
      });
      toast({ title: `Статус изменён: ${ACCOUNTING_DOCUMENT_STATUS_LABELS[status]}` });
    } catch (statusError: any) {
      toast({ title: 'Не удалось изменить статус', description: statusError?.message, variant: 'destructive' });
    } finally {
      setSavingKey('');
    }
  };

  const removeRecord = async (row: AccountingRow, kind: 'document' | 'payment', id: string) => {
    if (!user || !window.confirm('Удалить ошибочную запись из бухгалтерского реестра?')) return;
    const key = `${row.project.id}:${id}:delete`;
    setSavingKey(key);
    try {
      await updateProject(row.project.id, (current: Project) => {
        const ledger = projectAccountingLedger(current);
        const next = {
          ...ledger,
          documents: kind === 'document' ? ledger.documents.filter((item) => item.id !== id) : ledger.documents,
          payments: kind === 'payment' ? ledger.payments.filter((item) => item.id !== id) : ledger.payments,
          updatedAt: new Date().toISOString(),
          updatedBy: user.name || user.id,
        };
        return { notes: { ...current.notes, accounting: next } };
      });
      toast({ title: 'Запись удалена' });
    } finally {
      setSavingKey('');
    }
  };

  const saveContact = async (row: AccountingRow, contact: AccountingContact) => {
    if (!user) return;
    const key = `${row.project.id}:contact`;
    setSavingKey(key);
    try {
      await updateProject(row.project.id, (current: Project) => ({
        notes: {
          ...current.notes,
          accounting: updateAccountingContact(projectAccountingLedger(current), contact, user.name || user.id),
        },
      }));
      toast({ title: 'Контакт заказчика сохранён' });
    } catch (contactError: any) {
      toast({ title: 'Не удалось сохранить контакт', description: contactError?.message, variant: 'destructive' });
    } finally {
      setSavingKey('');
    }
  };

  const openFile = async (fileValue?: AccountingFile) => {
    if (!fileValue) return;
    const preview = window.open('about:blank', '_blank');
    try {
      const direct = fileValue.publicUrl || fileValue.url || '';
      const url = fileValue.isSeafile && fileValue.storagePath
        ? await supabaseDataStore.getSeafileDownloadUrl(fileValue.storagePath)
        : direct;
      if (!url) throw new Error('У файла нет рабочей ссылки');
      if (preview) preview.location.href = url;
      else window.open(url, '_blank', 'noopener,noreferrer');
    } catch (fileError: any) {
      preview?.close();
      toast({ title: 'Не удалось открыть файл', description: fileError?.message, variant: 'destructive' });
    }
  };

  const sendDocumentEmail = async (row: AccountingRow, document: AccountingDocument) => {
    const recipient = row.summary.ledger.contact?.email?.trim();
    if (!recipient) {
      toast({ title: 'Сначала укажите email заказчика', description: 'Раскройте проект и сохраните контакт заказчика.', variant: 'destructive' });
      return;
    }
    if (!document.file) {
      toast({ title: 'Сначала прикрепите файл документа', variant: 'destructive' });
      return;
    }
    const typeLabel = document.type === 'invoice' ? 'Счёт' : 'АВР';
    if (!window.confirm(`Отправить ${typeLabel.toLowerCase()} № ${document.number} на ${recipient}?`)) return;
    const key = `${row.project.id}:${document.id}:email`;
    setSavingKey(key);
    try {
      const direct = document.file.publicUrl || document.file.url || '';
      const fileUrl = document.file.isSeafile && document.file.storagePath
        ? await supabaseDataStore.getSeafileDownloadUrl(document.file.storagePath)
        : direct;
      if (!fileUrl) throw new Error('Не удалось получить ссылку на файл');
      const safeClient = escapeHtml(row.clientName);
      const safeNumber = escapeHtml(document.number);
      const safeUrl = escapeHtml(fileUrl);
      const result = await sendEmail(recipient, {
        subject: `${typeLabel} № ${document.number} — ${row.companyName}`,
        html: `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827"><p>Здравствуйте.</p><p>Направляем ${document.type === 'invoice' ? 'счёт на оплату' : 'акт выполненных работ'} <strong>№ ${safeNumber}</strong> по проекту «${safeClient}» на сумму <strong>${escapeHtml(formatMoney(document.amount, row.summary.currency))}</strong>.</p><p><a href="${safeUrl}" style="display:inline-block;padding:10px 16px;background:#0284c7;color:#fff;text-decoration:none;border-radius:8px">Скачать документ</a></p><p>С уважением,<br>${escapeHtml(row.companyName)}<br>HUB</p></div>`,
        text: `Здравствуйте.\n\nНаправляем ${document.type === 'invoice' ? 'счёт на оплату' : 'акт выполненных работ'} № ${document.number} по проекту «${row.clientName}» на сумму ${formatMoney(document.amount, row.summary.currency)}.\n\nСкачать документ: ${fileUrl}\n\n${row.companyName}\nHUB`,
      });
      if (!result.success) throw new Error(result.message || 'Почтовый сервер не подтвердил отправку');
      await updateDocumentStatus(row, document, 'sent');
      toast({ title: `${typeLabel} отправлен`, description: recipient });
    } catch (sendError: any) {
      toast({ title: 'Не удалось отправить email', description: sendError?.message, variant: 'destructive' });
    } finally {
      setSavingKey('');
    }
  };

  const exportExcel = () => {
    const exportRows = filteredRows.map((row, index) => ({
      '№': index + 1,
      'Наша компания': row.companyName,
      'Заказчик / проект': row.clientName,
      'Договор №': row.contractNumber === '—' ? '' : row.contractNumber,
      'Дата договора': row.contractDate,
      'Срок проекта': row.deadline,
      'Валюта': row.summary.currency,
      'Стоимость проекта': row.summary.contractAmount,
      'Счета №': row.summary.invoices.map((item) => item.number).filter(Boolean).join(', '),
      'Выставлено': row.summary.invoiceAmount,
      'Оплачено по факту': row.summary.paidAmount,
      'Дебиторская задолженность': row.summary.receivableAmount,
      'Остаток по договору': row.summary.contractBalanceAmount,
      'АВР №': row.summary.avrs.map((item) => item.number).filter(Boolean).join(', '),
      'Сумма АВР': row.summary.avrAmount,
      'Статус': ACCOUNTING_STATUS_LABELS[row.summary.status],
      'Руководитель проекта': row.leaderName === '—' ? '' : row.leaderName,
      'Контакт заказчика': row.summary.ledger.contact?.name || '',
      'Телефон': row.summary.ledger.contact?.phone || '',
      'Email': row.summary.ledger.contact?.email || '',
      'Примечание': row.summary.ledger.contact?.notes || '',
    }));
    const workbook = XLSX.utils.book_new();
    const appendSheet = (name: string, data: typeof exportRows) => {
      const sheet = XLSX.utils.json_to_sheet(data);
      sheet['!cols'] = [5, 24, 38, 20, 14, 14, 10, 18, 24, 18, 18, 22, 20, 22, 18, 24, 24, 24, 18, 28, 34]
        .map((width) => ({ wch: width }));
      XLSX.utils.book_append_sheet(workbook, sheet, name.slice(0, 31));
    };
    appendSheet('Общий реестр', exportRows);
    for (const company of companies) {
      const data = exportRows.filter((item) => item['Наша компания'] === company);
      if (data.length > 0) appendSheet(company.replace(/[\\/?*\[\]:]/g, ' ').slice(0, 31) || 'Компания', data);
    }
    XLSX.writeFile(workbook, `HUB_Бухгалтерия_${today()}.xlsx`);
  };

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /><p className="mt-3 text-muted-foreground">Загружаю бухгалтерский реестр…</p></div>
      </div>
    );
  }

  if (error) {
    return <Card className="border-destructive/40"><CardContent className="flex gap-3 p-6"><AlertCircle className="h-5 w-5 text-destructive" /><div><b>Не удалось загрузить проекты</b><p className="text-sm text-muted-foreground">{error}</p></div></CardContent></Card>;
  }

  return (
    <div className="space-y-5 pb-20 md:pb-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><ReceiptText className="h-4 w-4" /> Финансовые документы и оплаты</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">Бухгалтерский кабинет</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Один проект — одна строка. Только договоры, счета, АВР, фактические оплаты, задолженность и необходимые бухгалтерии контакты.</p>
        </div>
        <Button variant="outline" onClick={exportExcel} disabled={filteredRows.length === 0}><Download className="mr-2 h-4 w-4" />Скачать Excel</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {[
          { label: 'Договоры', value: primaryTotals.contract, icon: FileText, color: 'text-slate-600' },
          { label: 'Выставлено', value: primaryTotals.invoiced, icon: ReceiptText, color: 'text-blue-600' },
          { label: 'Оплачено по факту', value: primaryTotals.paid, icon: CheckCircle2, color: 'text-emerald-600' },
          { label: 'К получению', value: primaryTotals.receivable, icon: WalletCards, color: 'text-amber-600' },
          { label: 'Просрочено', value: primaryTotals.overdue, icon: AlertCircle, color: 'text-red-600' },
        ].map((item) => (
          <Card key={item.label} className="overflow-hidden">
            <CardContent className="flex items-center gap-2 p-3 md:gap-3 md:p-4">
              <div className="rounded-xl bg-muted p-2 md:p-2.5"><item.icon className={`h-5 w-5 ${item.color}`} /></div>
              <div className="min-w-0"><div className="text-[11px] text-muted-foreground md:text-xs">{item.label}</div><div className="whitespace-nowrap text-base font-bold tabular-nums md:text-lg" title={formatMoney(item.value, primaryCurrency)}>{formatCompactMoney(item.value, primaryCurrency)}</div></div>
            </CardContent>
          </Card>
        ))}
      </div>
      {Object.keys(totalsByCurrency).length > 1 && (
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>Другие валюты:</span>
          {Object.entries(totalsByCurrency).filter(([currency]) => currency !== primaryCurrency).map(([currency, value]) => (
            <Badge key={currency} variant="outline">{currency}: оплачено {formatMoney(value.paid, currency)}, долг {formatMoney(value.receivable, currency)}</Badge>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-[minmax(260px,1fr)_260px_260px_auto]">
          <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Заказчик, договор, руководитель, контакт…" /></div>
          <Select value={companyFilter} onValueChange={setCompanyFilter}><SelectTrigger><SelectValue placeholder="Все компании" /></SelectTrigger><SelectContent><SelectItem value="all">Все наши компании</SelectItem>{companies.map((company) => <SelectItem key={company} value={company}>{company}</SelectItem>)}</SelectContent></Select>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}><SelectTrigger><SelectValue placeholder="Все состояния" /></SelectTrigger><SelectContent><SelectItem value="all">Все состояния</SelectItem>{Object.entries(ACCOUNTING_STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
          <div className="flex items-center justify-end whitespace-nowrap text-sm text-muted-foreground">{filteredRows.length} из {rows.length}</div>
        </CardContent>
      </Card>

      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <div>
          <table className="w-full table-fixed text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="w-10 px-2 py-3"></th><th className="w-[24%] px-2 py-3">Проект, компания и договор</th><th className="w-[11%] px-2 py-3 text-right">Стоимость</th><th className="w-[11%] px-2 py-3 text-right">Выставлено</th><th className="w-[11%] px-2 py-3 text-right">Оплачено</th><th className="w-[12%] px-2 py-3 text-right">Долг</th><th className="w-[15%] px-2 py-3">Статус</th><th className="w-[16%] px-2 py-3 text-right">Действия</th></tr>
            </thead>
            <tbody className="divide-y">
              {filteredRows.map((row) => {
                const isExpanded = Boolean(expanded[row.project.id]);
                return [
                  <tr key={row.project.id} className="align-top hover:bg-muted/30">
                    <td className="px-2 py-4"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpanded((value) => ({ ...value, [row.project.id]: !isExpanded }))}>{isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</Button></td>
                    <td className="px-2 py-4"><div className="font-semibold leading-snug">{row.clientName}</div><div className="mt-1 line-clamp-2 text-xs text-primary">{row.companyName}</div><div className="mt-1 text-xs text-muted-foreground">№ {row.contractNumber} {row.contractDate && `от ${formatDate(row.contractDate)}`}</div><div className="mt-1 text-xs text-muted-foreground">Руководитель: {row.leaderName}</div></td>
                    <td className="px-2 py-4 text-right font-medium tabular-nums" title={formatMoney(row.summary.contractAmount, row.summary.currency)}>{formatCompactMoney(row.summary.contractAmount, row.summary.currency)}</td>
                    <td className="px-2 py-4 text-right"><div className="font-medium tabular-nums" title={formatMoney(row.summary.invoiceAmount, row.summary.currency)}>{formatCompactMoney(row.summary.invoiceAmount, row.summary.currency)}</div><div className="text-xs text-muted-foreground">{row.summary.invoices.length} сч.</div></td>
                    <td className="px-2 py-4 text-right"><div className="font-semibold tabular-nums text-emerald-600" title={formatMoney(row.summary.paidAmount, row.summary.currency)}>{formatCompactMoney(row.summary.paidAmount, row.summary.currency)}</div><div className="text-xs text-muted-foreground">{row.summary.payments.length} плат.</div></td>
                    <td className="px-2 py-4 text-right"><div className={`font-bold tabular-nums ${row.summary.receivableAmount > 0 ? 'text-red-600' : 'text-emerald-600'}`} title={formatMoney(row.summary.receivableAmount, row.summary.currency)}>{formatCompactMoney(row.summary.receivableAmount, row.summary.currency)}</div><div className="mt-1 text-[11px] text-muted-foreground" title={formatMoney(row.summary.contractBalanceAmount, row.summary.currency)}>договор: {formatCompactMoney(row.summary.contractBalanceAmount, row.summary.currency)}</div></td>
                    <td className="px-2 py-4"><Badge variant="outline" className={`whitespace-normal text-left leading-tight ${STATUS_COLORS[row.summary.status]}`}>{ACCOUNTING_STATUS_LABELS[row.summary.status]}</Badge>{row.deadline && <div className="mt-2 text-xs text-muted-foreground">срок {formatDate(row.deadline)}</div>}</td>
                    <td className="px-2 py-4"><div className="ml-auto grid max-w-[128px] gap-1"><Button size="sm" variant="outline" className="h-7 justify-start px-2 text-xs" onClick={() => openEntry(row, 'invoice')}><ReceiptText className="mr-1 h-3.5 w-3.5" />Счёт</Button><Button size="sm" variant="outline" className="h-7 justify-start px-2 text-xs" onClick={() => openEntry(row, 'avr')}><Send className="mr-1 h-3.5 w-3.5" />АВР</Button><Button size="sm" className="h-7 justify-start px-2 text-xs" onClick={() => openEntry(row, 'payment')}><Banknote className="mr-1 h-3.5 w-3.5" />Оплата</Button></div></td>
                  </tr>,
                  isExpanded && <tr key={`${row.project.id}:details`}><td colSpan={8} className="bg-muted/20 p-4"><AccountingDetails row={row} savingKey={savingKey} onStatus={updateDocumentStatus} onSendEmail={sendDocumentEmail} onRemove={removeRecord} onOpenFile={openFile} onSaveContact={saveContact} /></td></tr>,
                ];
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {filteredRows.map((row) => {
          const isExpanded = Boolean(expanded[row.project.id]);
          return <Card key={row.project.id}><CardContent className="p-4"><button type="button" className="w-full text-left" onClick={() => setExpanded((value) => ({ ...value, [row.project.id]: !isExpanded }))}><div className="flex items-start justify-between gap-2"><div><div className="font-semibold">{row.clientName}</div><div className="mt-1 text-xs text-muted-foreground">{row.companyName} · № {row.contractNumber}</div></div>{isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}</div><Badge variant="outline" className={`mt-3 ${STATUS_COLORS[row.summary.status]}`}>{ACCOUNTING_STATUS_LABELS[row.summary.status]}</Badge><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><div className="text-xs text-muted-foreground">Стоимость</div><b>{formatMoney(row.summary.contractAmount, row.summary.currency)}</b></div><div><div className="text-xs text-muted-foreground">Выставлено</div><b>{formatMoney(row.summary.invoiceAmount, row.summary.currency)}</b></div><div><div className="text-xs text-muted-foreground">Оплачено</div><b className="text-emerald-600">{formatMoney(row.summary.paidAmount, row.summary.currency)}</b></div><div><div className="text-xs text-muted-foreground">Задолженность</div><b className={row.summary.receivableAmount ? 'text-red-600' : 'text-emerald-600'}>{formatMoney(row.summary.receivableAmount, row.summary.currency)}</b></div></div></button><div className="mt-4 grid grid-cols-3 gap-2"><Button size="sm" variant="outline" onClick={() => openEntry(row, 'invoice')}>Счёт</Button><Button size="sm" variant="outline" onClick={() => openEntry(row, 'avr')}>АВР</Button><Button size="sm" onClick={() => openEntry(row, 'payment')}>Оплата</Button></div>{isExpanded && <div className="mt-4 border-t pt-4"><AccountingDetails row={row} savingKey={savingKey} onStatus={updateDocumentStatus} onSendEmail={sendDocumentEmail} onRemove={removeRecord} onOpenFile={openFile} onSaveContact={saveContact} /></div>}</CardContent></Card>;
        })}
      </div>

      {filteredRows.length === 0 && <Card><CardContent className="py-16 text-center"><Search className="mx-auto h-8 w-8 text-muted-foreground" /><div className="mt-3 font-semibold">Ничего не найдено</div><p className="text-sm text-muted-foreground">Измените поиск или фильтры.</p></CardContent></Card>}

      <Dialog open={Boolean(entry)} onOpenChange={(open) => !open && setEntry(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>{entry?.kind === 'payment' ? 'Добавить фактическую оплату' : entry?.kind === 'invoice' ? 'Выставить счёт' : 'Добавить АВР'}</DialogTitle><DialogDescription>{entry?.row.clientName} · {entry && formatMoney(entry.row.summary.contractAmount, entry.row.summary.currency)}</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-2">
            {entry?.kind !== 'payment' && <div className="grid gap-2"><Label htmlFor="entry-number">{entry?.kind === 'invoice' ? 'Номер счёта' : 'Номер АВР'}</Label><Input id="entry-number" value={number} onChange={(event) => setNumber(event.target.value)} placeholder={entry?.kind === 'invoice' ? 'СФ-123' : 'АВР-123'} /></div>}
            <div className="grid grid-cols-2 gap-3"><div className="grid gap-2"><Label htmlFor="entry-date">Дата</Label><Input id="entry-date" type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="entry-amount">Сумма</Label><Input id="entry-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" /></div></div>
            {entry?.kind === 'invoice' && <div className="grid gap-2"><Label htmlFor="due-date">Оплатить до</Label><Input id="due-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></div>}
            {entry?.kind === 'payment' && <div className="grid gap-2"><Label>Тип оплаты</Label><Select value={paymentKind} onValueChange={(value) => setPaymentKind(value as AccountingPaymentKind)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(ACCOUNTING_PAYMENT_KIND_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>}
            {entry?.kind === 'payment' && <div className="grid gap-2"><Label htmlFor="payment-reference">Номер платёжного поручения / назначение</Label><Input id="payment-reference" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="ПП №…, оплата по договору…" /></div>}
            <div className="grid gap-2"><Label htmlFor="entry-file">Файл {entry?.kind === 'payment' ? 'платёжного документа' : entry?.kind === 'invoice' ? 'счёта' : 'АВР'} (необязательно)</Label><Input id="entry-file" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" onChange={(event: ChangeEvent<HTMLInputElement>) => setFile(event.target.files?.[0] || null)} /></div>
            <div className="grid gap-2"><Label htmlFor="entry-notes">Примечание</Label><Textarea id="entry-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Что важно знать бухгалтерии" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEntry(null)}>Отмена</Button><Button onClick={saveEntry} disabled={Boolean(savingKey)}>{savingKey && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{entry?.kind === 'payment' ? 'Учесть оплату' : entry?.kind === 'invoice' ? 'Выставить счёт' : 'Сохранить АВР'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccountingDetails({
  row,
  savingKey,
  onStatus,
  onSendEmail,
  onRemove,
  onOpenFile,
  onSaveContact,
}: {
  row: AccountingRow;
  savingKey: string;
  onStatus: (row: AccountingRow, document: AccountingDocument, status: AccountingDocumentStatus) => Promise<void>;
  onSendEmail: (row: AccountingRow, document: AccountingDocument) => Promise<void>;
  onRemove: (row: AccountingRow, kind: 'document' | 'payment', id: string) => Promise<void>;
  onOpenFile: (file?: AccountingFile) => Promise<void>;
  onSaveContact: (row: AccountingRow, contact: AccountingContact) => Promise<void>;
}) {
  const documents = [...row.summary.invoices, ...row.summary.avrs].sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  const payments = [...row.summary.payments].sort((a, b) => b.date.localeCompare(a.date));
  const notes = projectNotes(row.project);
  const amendments = Array.isArray((row.project as any).amendments)
    ? (row.project as any).amendments
    : Array.isArray(notes.amendments)
      ? notes.amendments
      : [];
  const finances = (row.project as any).finances || notes.finances || {};
  const contractors = Array.isArray(finances.contractors) ? finances.contractors : [];
  const contractFiles = projectContractFiles(row.project);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border bg-background p-4"><div className="text-xs uppercase text-muted-foreground">Договор</div><div className="mt-1 font-semibold">№ {row.contractNumber}</div><div className="text-sm text-muted-foreground">от {formatDate(row.contractDate)}</div><div className="mt-2 text-lg font-bold">{formatMoney(row.summary.contractAmount, row.summary.currency)}</div>{amendments.length > 0 && <div className="mt-2 text-xs text-muted-foreground">Дополнительных соглашений: <b className="text-foreground">{amendments.length}</b>{amendments.slice(0, 2).map((item: any, index: number) => <div key={item?.id || index}>№ {item?.number || 'б/н'}{item?.date ? ` от ${formatDate(item.date)}` : ''}{Number(item?.amount || item?.amountWithoutVAT || 0) > 0 ? ` · ${formatMoney(Number(item.amount || item.amountWithoutVAT), row.summary.currency)}` : ''}</div>)}</div>}</div>
        <div className="rounded-xl border bg-background p-4"><div className="text-xs uppercase text-muted-foreground">Контроль оплаты</div><div className="mt-2 flex justify-between text-sm"><span>Оплачено</span><b className="text-emerald-600">{formatMoney(row.summary.paidAmount, row.summary.currency)}</b></div><div className="mt-1 flex justify-between text-sm"><span>Дебиторка</span><b className={row.summary.receivableAmount ? 'text-red-600' : 'text-emerald-600'}>{formatMoney(row.summary.receivableAmount, row.summary.currency)}</b></div><div className="mt-1 flex justify-between text-sm"><span>Остаток договора</span><b>{formatMoney(row.summary.contractBalanceAmount, row.summary.currency)}</b></div></div>
        <div className="rounded-xl border bg-background p-4"><div className="text-xs uppercase text-muted-foreground">Проект</div><div className="mt-2 text-sm">Руководитель: <b>{row.leaderName}</b></div><div className="mt-1 text-sm">Срок: <b>{formatDate(row.deadline)}</b></div>{contractors.length > 0 && <div className="mt-2 text-xs text-muted-foreground">ГПХ / субподряд: <b className="text-foreground">{contractors.map((item: any) => item?.name || item?.label).filter(Boolean).join(', ') || `${contractors.length} записей`}</b></div>}<div className="mt-3 flex flex-wrap gap-1.5">{contractFiles.length === 0 ? <span className="text-xs text-muted-foreground">Файл договора не загружен</span> : contractFiles.map((file: any, index: number) => <Button key={file?.id || file?.storagePath || index} size="sm" variant="outline" onClick={() => onOpenFile(file as AccountingFile)}><Download className="mr-1 h-3.5 w-3.5" />{file?.fileName || file?.name || 'Договор'}</Button>)}</div></div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border bg-background p-4"><div className="mb-3 flex items-center gap-2 font-semibold"><FileCheck2 className="h-4 w-4" />Счета и АВР</div>{documents.length === 0 ? <div className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">Документы ещё не добавлены.</div> : <div className="space-y-2">{documents.map((document) => <div key={document.id} className="rounded-lg border p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="font-medium">{document.type === 'invoice' ? 'Счёт' : 'АВР'} № {document.number || 'без номера'}</div><div className="text-xs text-muted-foreground">{formatDate(document.issueDate)} · {formatMoney(document.amount, row.summary.currency)}{document.dueDate ? ` · оплатить до ${formatDate(document.dueDate)}` : ''}</div></div><Badge variant="outline">{ACCOUNTING_DOCUMENT_STATUS_LABELS[document.status]}</Badge></div><div className="mt-2 flex flex-wrap gap-1.5">{document.file && <Button size="sm" variant="ghost" onClick={() => onOpenFile(document.file)}><Download className="mr-1 h-3.5 w-3.5" />{document.file.fileName || 'Файл'}</Button>}{document.file && row.summary.ledger.contact?.email && document.status !== 'sent' && document.status !== 'signed' && <Button size="sm" variant="outline" disabled={Boolean(savingKey)} onClick={() => onSendEmail(row, document)}><Send className="mr-1 h-3.5 w-3.5" />Отправить email</Button>}{document.status === 'draft' && <Button size="sm" variant="outline" disabled={Boolean(savingKey)} onClick={() => onStatus(row, document, 'issued')}>Выставлен</Button>}{document.status === 'issued' && <Button size="sm" variant="outline" disabled={Boolean(savingKey)} onClick={() => onStatus(row, document, 'sent')}>Уже отправлен</Button>}{document.type === 'avr' && document.status === 'sent' && <Button size="sm" variant="outline" disabled={Boolean(savingKey)} onClick={() => onStatus(row, document, 'signed')}><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Подписан</Button>}<Button size="sm" variant="ghost" className="text-destructive" disabled={Boolean(savingKey)} onClick={() => onRemove(row, 'document', document.id)}><Trash2 className="h-3.5 w-3.5" /></Button></div>{document.notes && <div className="mt-2 text-xs text-muted-foreground">{document.notes}</div>}</div>)}</div>}</div>
        <div className="rounded-xl border bg-background p-4"><div className="mb-3 flex items-center gap-2 font-semibold"><Banknote className="h-4 w-4" />Фактические оплаты</div>{payments.length === 0 ? <div className="rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">Оплаты ещё не внесены.</div> : <div className="space-y-2">{payments.map((payment: AccountingPayment) => <div key={payment.id} className="flex items-start justify-between gap-3 rounded-lg border p-3"><div><div className="font-semibold text-emerald-600">+ {formatMoney(payment.amount, row.summary.currency)}</div><div className="text-xs text-muted-foreground">{formatDate(payment.date)} · {ACCOUNTING_PAYMENT_KIND_LABELS[payment.kind]}</div>{payment.reference && <div className="mt-1 text-xs">{payment.reference}</div>}{payment.file && <Button size="sm" variant="ghost" className="mt-1 h-7 px-1" onClick={() => onOpenFile(payment.file)}><Download className="mr-1 h-3.5 w-3.5" />Документ</Button>}</div><Button size="sm" variant="ghost" className="text-destructive" disabled={Boolean(savingKey)} onClick={() => onRemove(row, 'payment', payment.id)}><Trash2 className="h-3.5 w-3.5" /></Button></div>)}</div>}</div>
      </div>
      <ContactEditor row={row} saving={savingKey === `${row.project.id}:contact`} onSave={onSaveContact} />
    </div>
  );
}
