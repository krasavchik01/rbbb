import crypto from 'crypto';

const DOCUMENT_KINDS = new Set(['invoice', 'avr', 'esf']);
const PAYMENT_KINDS = new Set(['payment']);

function text(value) {
  return String(value ?? '').trim();
}

function first(source, keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && text(value)) return value;
  }
  return '';
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function money(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.max(0, value) : 0;
  const normalized = text(value)
    .replace(/\u00a0/g, '')
    .replace(/\s+/g, '')
    .replace(/,/g, '.')
    .replace(/[^0-9.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function isoDate(value) {
  const raw = text(value);
  if (!raw) return '';
  const direct = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (direct) return `${direct[1]}-${direct[2]}-${direct[3]}`;
  const ru = raw.match(/^(\d{2})[./-](\d{2})[./-](\d{4})/);
  if (ru) return `${ru[3]}-${ru[2]}-${ru[1]}`;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

function isoTimestamp(value) {
  const raw = text(value);
  if (!raw) return '';
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

export function normalizeContractNumber(value) {
  return text(value)
    .toLocaleLowerCase('ru')
    .replace(/[№#]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

export function normalizeIdentity(value) {
  return text(value)
    .toLocaleLowerCase('ru')
    .replace(/[«»"'`]/g, '')
    .replace(/\b(тоо|ао|чк|llp|ltd|group|компания)\b/giu, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function normalizeKind(value) {
  const key = normalizeIdentity(value);
  if (['invoice', 'счет', 'счетнаоплату', 'счетнаоплатуклиенту', 'счетнаоплатупокупателю', 'сф', 'schet'].includes(key)) return 'invoice';
  if (['avr', 'авр', 'акт', 'актвыполненныхработ', 'реализацияуслуг', 'реализациятоваровиуслуг'].includes(key)) return 'avr';
  if (['esf', 'эсф', 'электронныйсчетфактура', 'электроннаясчетфактура', 'счетфактура'].includes(key)) return 'esf';
  if (['payment', 'оплата', 'платеж', 'платежноепоручение', 'банковскаявыписка', 'поступлениенарасчетныйсчет'].includes(key)) return 'payment';
  return '';
}

function normalizeStatus(kind, value) {
  const key = normalizeIdentity(value);
  if (['cancelled', 'canceled', 'отменен', 'аннулирован', 'пометкаудаления'].includes(key)) return 'cancelled';
  if (kind === 'avr' && ['signed', 'подписан', 'принят'].includes(key)) return 'signed';
  if (kind === 'esf' && ['registered', 'accepted', 'processed', 'зарегистрирован', 'принят', 'обработан'].includes(key)) return 'registered';
  if (['sent', 'отправлен', 'передан'].includes(key)) return 'sent';
  if (['issued', 'posted', 'проведен', 'выставлен', 'оформлен'].includes(key)) return 'issued';
  return 'draft';
}

function normalizePaymentKind(value) {
  const key = normalizeIdentity(value);
  if (['advance', 'аванс', 'предоплата'].includes(key)) return 'advance';
  if (['interim', 'частичная', 'промежуточная'].includes(key)) return 'interim';
  if (['final', 'окончательная', 'финальная'].includes(key)) return 'final';
  return 'other';
}

export function normalizeOneCRecord(raw, index = 0) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const kind = normalizeKind(first(raw, ['kind', 'type', 'documentType', 'ВидДокумента', 'ТипДокумента']));
  if (!DOCUMENT_KINDS.has(kind) && !PAYMENT_KINDS.has(kind)) return null;

  const externalId = text(first(raw, ['externalId', 'id', 'ref', 'guid', 'Ссылка', 'УИД', 'UUID']));
  const number = text(first(raw, ['number', 'documentNumber', 'Номер', 'НомерДокумента']));
  const date = isoDate(first(raw, ['date', 'issueDate', 'documentDate', 'Дата', 'ДатаДокумента']));
  const amount = money(first(raw, ['amount', 'sum', 'Сумма', 'СуммаДокумента', 'СуммаОплаты']));
  const contractNumber = text(first(raw, ['contractNumber', 'agreementNumber', 'ДоговорНомер', 'НомерДоговора', 'Договор']));
  const projectId = text(first(raw, ['projectId', 'hubProjectId', 'ПроектID', 'ИдентификаторПроекта']));
  if (!externalId && !number) return null;
  if (!date || amount <= 0) return null;

  return {
    kind,
    externalId: externalId || `${kind}:${number}:${date}:${amount}`,
    number,
    date,
    dueDate: isoDate(first(raw, ['dueDate', 'paymentDueDate', 'СрокОплаты', 'КонтрольныйСрок'])),
    amount,
    currency: text(first(raw, ['currency', 'Валюта'])) || 'KZT',
    status: normalizeStatus(kind, first(raw, ['status', 'state', 'Статус', 'Состояние', 'Проведен'])),
    paymentKind: normalizePaymentKind(first(raw, ['paymentKind', 'ВидОплаты', 'ТипОплаты'])),
    reference: text(first(raw, ['reference', 'purpose', 'НазначениеПлатежа', 'Основание'])),
    contractNumber,
    contractKey: normalizeContractNumber(contractNumber),
    projectId,
    organizationBin: text(first(raw, ['organizationBin', 'companyBin', 'БИНОрганизации', 'ОрганизацияБИН'])).replace(/\D/g, ''),
    organizationName: text(first(raw, ['organizationName', 'companyName', 'Организация', 'НашаКомпания'])),
    counterpartyBin: text(first(raw, ['counterpartyBin', 'customerBin', 'БИНКонтрагента', 'КонтрагентБИН'])).replace(/\D/g, ''),
    counterpartyName: text(first(raw, ['counterpartyName', 'customerName', 'Контрагент', 'Заказчик'])),
    fileUrl: text(first(raw, ['fileUrl', 'documentUrl', 'СсылкаНаФайл', 'ФайлURL'])),
    fileName: text(first(raw, ['fileName', 'ИмяФайла'])),
    notes: text(first(raw, ['notes', 'comment', 'Комментарий'])),
    requireEsf: Boolean(first(raw, ['requireEsf', 'ТребуетсяЭСФ'])),
    updatedAt: isoTimestamp(first(raw, ['updatedAt', 'modifiedAt', 'ДатаИзменения'])) || new Date().toISOString(),
    rawIndex: index,
  };
}

export function normalizeOneCPayload(body) {
  const rows = Array.isArray(body)
    ? body
    : Array.isArray(body?.records)
      ? body.records
      : Array.isArray(body?.data)
        ? body.data
        : [
            ...array(body?.invoices || body?.Счета).map((row) => ({ ...row, kind: row.kind || 'invoice' })),
            ...array(body?.avrs || body?.АВР).map((row) => ({ ...row, kind: row.kind || 'avr' })),
            ...array(body?.esfs || body?.ЭСФ).map((row) => ({ ...row, kind: row.kind || 'esf' })),
            ...array(body?.payments || body?.Оплаты).map((row) => ({ ...row, kind: row.kind || 'payment' })),
          ];
  return {
    source: text(body?.source || body?.database || body?.ИнформационнаяБаза) || '1C',
    fullSnapshot: Boolean(body?.fullSnapshot),
    records: rows.map(normalizeOneCRecord).filter(Boolean).slice(0, 1000),
  };
}

export function isOneCNoopBatch(body) {
  return Boolean(
    body
    && typeof body === 'object'
    && !Array.isArray(body)
    && text(body.source || body.database || body.ИнформационнаяБаза)
    && body.fullSnapshot === false
    && Array.isArray(body.records)
    && body.records.length === 0,
  );
}

function parseNotes(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function projectContractNumber(project) {
  const notes = parseNotes(project?.notes);
  return text(
    notes?.contract?.number || notes?.contract?.contractNumber || notes?.contractNumber
    || project?.contract_number || project?.contractNumber,
  );
}

function projectIdentityValues(project) {
  const notes = parseNotes(project?.notes);
  const client = notes?.client || {};
  return {
    company: [notes.companyId, notes.companyName, notes.ourCompany, project?.company_id, project?.company_name].filter(Boolean).map(normalizeIdentity),
    clientBin: text(client.bin || client.inn || notes.clientBin || project?.client_bin).replace(/\D/g, ''),
    client: [client.name, notes.clientName, project?.name].filter(Boolean).map(normalizeIdentity),
  };
}

export function matchOneCRecord(record, projects) {
  if (record.projectId) {
    const direct = projects.find((project) => String(project.id) === record.projectId);
    if (direct) return { project: direct, reason: 'project_id' };
  }
  if (!record.contractKey) return { project: null, reason: 'missing_contract' };
  const candidates = projects.filter((project) => normalizeContractNumber(projectContractNumber(project)) === record.contractKey);
  if (candidates.length === 0) return { project: null, reason: 'contract_not_found' };
  if (candidates.length === 1) return { project: candidates[0], reason: 'contract' };

  const scored = candidates.map((project) => {
    const identities = projectIdentityValues(project);
    let score = 0;
    if (record.organizationName && identities.company.includes(normalizeIdentity(record.organizationName))) score += 20;
    if (record.counterpartyBin && identities.clientBin === record.counterpartyBin) score += 30;
    if (record.counterpartyName && identities.client.includes(normalizeIdentity(record.counterpartyName))) score += 10;
    return { project, score };
  }).sort((a, b) => b.score - a.score);
  if (scored[0].score > 0 && scored[0].score > (scored[1]?.score || 0)) return { project: scored[0].project, reason: 'contract_and_identity' };
  return { project: null, reason: 'ambiguous_contract', candidates: candidates.map((project) => project.id) };
}

function fileFromRecord(record) {
  if (!record.fileUrl) return undefined;
  return {
    id: `1c-file:${record.externalId}`,
    fileName: record.fileName || `${record.kind}-${record.number || record.externalId}.pdf`,
    publicUrl: record.fileUrl,
    url: record.fileUrl,
    isSeafile: false,
    fileType: 'application/pdf',
  };
}

export function mergeOneCRecordsIntoNotes(rawNotes, records, source = '1C', syncedAt = new Date().toISOString()) {
  const notes = parseNotes(rawNotes);
  const current = notes.accounting && typeof notes.accounting === 'object' && !Array.isArray(notes.accounting)
    ? notes.accounting
    : {};
  const documents = Array.isArray(current.documents) ? [...current.documents] : [];
  const payments = Array.isArray(current.payments) ? [...current.payments] : [];
  let requiresEsf = Boolean(current?.requirements?.esf);

  for (const record of records) {
    requiresEsf ||= record.kind === 'esf' || record.requireEsf;
    if (record.kind === 'payment') {
      const id = `1c:payment:${record.externalId}`;
      const next = {
        id,
        externalId: record.externalId,
        source: '1c',
        sourceDatabase: source,
        syncedAt,
        date: record.date,
        amount: record.amount,
        kind: record.paymentKind,
        reference: record.reference || record.number || undefined,
        notes: record.notes || undefined,
        file: fileFromRecord(record),
        createdAt: record.updatedAt || syncedAt,
        createdBy: '1С',
      };
      const index = payments.findIndex((item) => item?.id === id || (item?.source === '1c' && item?.externalId === record.externalId));
      if (index >= 0) payments[index] = { ...payments[index], ...next };
      else payments.push(next);
      continue;
    }

    const id = `1c:${record.kind}:${record.externalId}`;
    const next = {
      id,
      externalId: record.externalId,
      source: '1c',
      sourceDatabase: source,
      syncedAt,
      type: record.kind,
      number: record.number,
      issueDate: record.date,
      dueDate: record.dueDate || undefined,
      amount: record.amount,
      status: record.status,
      notes: record.notes || undefined,
      file: fileFromRecord(record),
      createdAt: record.updatedAt || syncedAt,
      createdBy: '1С',
      updatedAt: record.updatedAt || syncedAt,
      updatedBy: '1С',
    };
    const index = documents.findIndex((item) => item?.id === id || (item?.source === '1c' && item?.externalId === record.externalId));
    if (index >= 0) documents[index] = { ...documents[index], ...next };
    else documents.push(next);
  }

  return {
    ...notes,
    accounting: {
      ...current,
      version: 2,
      documents,
      payments,
      requirements: { ...(current.requirements || {}), esf: requiresEsf },
      sync: { source: '1c', sourceDatabase: source, lastSyncedAt: syncedAt },
      updatedAt: syncedAt,
      updatedBy: '1С',
    },
  };
}

export function safeUnmatchedRecord(record, reason, candidates = []) {
  return {
    externalId: record.externalId,
    kind: record.kind,
    number: record.number,
    date: record.date,
    amount: record.amount,
    currency: record.currency,
    contractNumber: record.contractNumber,
    organizationName: record.organizationName,
    counterpartyName: record.counterpartyName,
    reason,
    candidates: candidates.slice(0, 10),
  };
}

export function secureSecretMatches(received, expected) {
  const left = Buffer.from(text(received));
  const right = Buffer.from(text(expected));
  return left.length > 0 && left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function hashSharedSecret(value) {
  return crypto.createHash('sha256').update(text(value), 'utf8').digest('hex');
}

export async function runWithConcurrency(items, concurrency, worker) {
  const values = Array.from(items || []);
  if (values.length === 0) return [];

  const requested = Number.isFinite(Number(concurrency)) ? Math.floor(Number(concurrency)) : 1;
  const workerCount = Math.min(values.length, Math.max(1, requested));
  const results = new Array(values.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < values.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(values[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return results;
}
