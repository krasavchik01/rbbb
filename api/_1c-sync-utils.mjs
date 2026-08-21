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
  const status = normalizeStatus(kind, first(raw, ['status', 'state', 'Статус', 'Состояние', 'Проведен']));
  const contractNumber = text(first(raw, ['contractNumber', 'agreementNumber', 'ДоговорНомер', 'НомерДоговора', 'Договор']));
  const projectId = text(first(raw, ['projectId', 'hubProjectId', 'ПроектID', 'ИдентификаторПроекта']));
  const paymentDocumentId = kind === 'payment'
    ? text(first(raw, ['paymentDocumentId', 'paymentId', 'ИдентификаторПлатежа', 'ПлатежУИД']))
    : '';
  if (!externalId && !number) return null;
  // Cancellation is an accounting tombstone. It must survive normalization even
  // when 1C has already zeroed the document amount after unposting/deletion.
  if (!date || (amount <= 0 && status !== 'cancelled')) return null;

  return {
    kind,
    externalId: externalId || `${kind}:${number}:${date}:${amount}`,
    number,
    date,
    dueDate: isoDate(first(raw, ['dueDate', 'paymentDueDate', 'СрокОплаты', 'КонтрольныйСрок'])),
    amount,
    currency: text(first(raw, ['currency', 'Валюта'])) || 'KZT',
    status,
    paymentKind: normalizePaymentKind(first(raw, ['paymentKind', 'ВидОплаты', 'ТипОплаты'])),
    paymentDocumentId,
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
  const hasRunMetadata = body && typeof body === 'object' && [
    'runId', 'run_id', 'syncRunId', 'ИдентификаторЗапуска',
    'batchIndex', 'batch_index', 'НомерПакета',
    'batchCount', 'batch_count', 'КоличествоПакетов',
    'snapshotSince', 'snapshot_since', 'ДатаНачалаСнимка',
    'snapshotCapturedAt', 'snapshot_captured_at', 'МоментСнимка',
  ].some((key) => Object.prototype.hasOwnProperty.call(body, key));
  return Boolean(
    body
    && typeof body === 'object'
    && !Array.isArray(body)
    && text(body.source || body.database || body.ИнформационнаяБаза)
    && body.fullSnapshot === false
    && !hasRunMetadata
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
  const companyValues = [
    notes.companyId,
    notes.companyName,
    notes.ourCompany,
    notes.company,
    project?.company_id,
    project?.company_name,
    project?.company,
  ].filter(Boolean);
  const companyNames = companyValues.flatMap((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [value];
    return [value.id, value.companyId, value.name, value.companyName, value.fullName].filter(Boolean);
  });
  const companyBins = companyValues.flatMap((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    return [value.bin, value.inn, value.companyBin].filter(Boolean);
  });
  return {
    company: companyNames.map(normalizeCompanyIdentity).filter(Boolean),
    companyBins: companyBins.map((value) => text(value).replace(/\D/g, '')).filter(Boolean),
    clientBin: text(client.bin || client.inn || notes.clientBin || project?.client_bin).replace(/\D/g, ''),
    client: [client.name, notes.clientName, project?.client_name].filter(Boolean).map(normalizeIdentity),
  };
}

function normalizeCompanyIdentity(value) {
  const key = normalizeIdentity(value);
  const aliases = {
    mak: 'mak',
    comprba: 'mak',
    aplus: 'mak',
    apartners: 'mak',
    rbapartners: 'mak',
    rbapluspartners: 'mak',
    rbaplus: 'mak',
    rbpartnersitaudit: 'rb-partners-it-audit',
    rbpartners: 'rb-partners-it-audit',
    itaudit: 'rb-partners-it-audit',
    mkf: 'mkf',
    мкф: 'mkf',
    academy: 'academy',
    rbacademy: 'academy',
    rusell: 'rusell',
    russell: 'rusell',
    anderson: 'anderson-qazaqstan',
    andersonkz: 'anderson-qazaqstan',
    andersonqazaqstan: 'anderson-qazaqstan',
    andersonconsulting: 'anderson-consulting',
    branchofandersonqazaqstanllpintheaifc: 'anderson-aifc-branch',
    parkerrussell: 'parker-kaz-ltd',
    parkerkazltd: 'parker-kaz-ltd',
    parkerkazakhstan: 'parker-kazakhstan',
    parkerconsultingappraisal: 'parker-consulting-appraisal',
  };
  // Unknown labels are intentionally not treated as a different legal entity:
  // live 1C names can be longer than HUB aliases. Known canonical companies
  // are still compared strictly, while an unknown label falls back to client
  // BIN/name evidence instead of causing a false mismatch.
  return aliases[key] || '';
}

function identityNamesMatch(left, values) {
  if (!left) return false;
  return values.some((right) => (
    right === left
    || (Math.min(right.length, left.length) >= 6 && (right.includes(left) || left.includes(right)))
  ));
}

function identityComparison(record, project) {
  const identities = projectIdentityValues(project);
  let score = 0;
  const conflicts = [];

  const organizationBin = text(record.organizationBin).replace(/\D/g, '');
  const comparedOrganizationBin = Boolean(organizationBin && identities.companyBins.length > 0);
  if (organizationBin && identities.companyBins.length > 0) {
    if (identities.companyBins.includes(organizationBin)) score += 40;
    else conflicts.push('organization_bin');
  }

  const organization = normalizeCompanyIdentity(record.organizationName);
  if (!comparedOrganizationBin && organization && identities.company.length > 0) {
    if (identities.company.includes(organization)) score += 20;
    else conflicts.push('organization');
  }

  const comparedCounterpartyBin = Boolean(record.counterpartyBin && identities.clientBin);
  if (record.counterpartyBin && identities.clientBin) {
    if (identities.clientBin === record.counterpartyBin) score += 30;
    else conflicts.push('counterparty_bin');
  }

  const counterparty = normalizeIdentity(record.counterpartyName);
  if (!comparedCounterpartyBin && counterparty && identities.client.length > 0) {
    if (identityNamesMatch(counterparty, identities.client)) score += 10;
    else conflicts.push('counterparty');
  }

  return { project, score, conflicts };
}

function sameOneCSource(item, source) {
  const itemSource = text(item?.sourceDatabase);
  return item?.source === '1c' && (!itemSource || !text(source) || itemSource === text(source));
}

function legacyPaymentExternalIdMatches(externalId, paymentDocumentId) {
  const storedId = text(externalId);
  const documentId = text(paymentDocumentId);
  if (!storedId || !documentId || !storedId.startsWith(`${documentId}-`)) return false;
  return /^\d+$/.test(storedId.slice(documentId.length + 1));
}

function paymentRecordMatches(item, record, source, includeSiblingAllocations = false) {
  if (!sameOneCSource(item, source)) return false;
  if (text(item?.externalId) === record.externalId) return true;
  if (!record.paymentDocumentId) return false;
  if (legacyPaymentExternalIdMatches(item?.externalId, record.paymentDocumentId)) return true;
  if (!includeSiblingAllocations) return false;
  return text(item?.paymentDocumentId) === record.paymentDocumentId
    || text(item?.externalId).startsWith(`${record.paymentDocumentId}|`);
}

function documentRecordMatches(item, record, source) {
  return sameOneCSource(item, source)
    && text(item?.externalId) === record.externalId
    && text(item?.type) === record.kind;
}

export function findOneCRecordLocations(record, projects, source = '') {
  const locations = [];
  for (const project of projects || []) {
    const accounting = parseNotes(project?.notes)?.accounting;
    if (!accounting || typeof accounting !== 'object' || Array.isArray(accounting)) continue;
    const rows = record.kind === 'payment' ? accounting.payments : accounting.documents;
    for (const item of array(rows)) {
      const matches = record.kind === 'payment'
        ? paymentRecordMatches(item, record, source, record.status === 'cancelled')
        : documentRecordMatches(item, record, source);
      if (matches) locations.push({ project, item });
    }
  }
  return locations;
}

function projectContainsOneCRecord(project, record, source = '') {
  const accounting = parseNotes(project?.notes)?.accounting;
  if (!accounting || typeof accounting !== 'object' || Array.isArray(accounting)) return false;
  const rows = record.kind === 'payment' ? accounting.payments : accounting.documents;
  return array(rows).some((item) => (record.kind === 'payment'
    ? paymentRecordMatches(item, record, source, record.status === 'cancelled')
    : documentRecordMatches(item, record, source)));
}

function matchOneCRecordByBusinessIdentity(record, projects) {
  if (!record.contractKey) return { project: null, reason: 'missing_contract' };
  const candidates = projects.filter((project) => normalizeContractNumber(projectContractNumber(project)) === record.contractKey);
  if (candidates.length === 0) return { project: null, reason: 'contract_not_found' };
  const compared = candidates.map((project) => identityComparison(record, project));
  if (compared.length === 1) {
    if (compared[0].conflicts.length > 0) {
      return {
        project: null,
        reason: 'contract_identity_mismatch',
        candidates: [candidates[0].id],
      };
    }
    return {
      project: candidates[0],
      reason: compared[0].score > 0 ? 'contract_and_identity' : 'contract',
    };
  }

  // A candidate with an explicit contradictory BIN/name must never win merely
  // because the contract number happens to be duplicated in another company.
  const scored = compared
    .filter((item) => item.conflicts.length === 0)
    .sort((a, b) => b.score - a.score);
  if (scored[0]?.score > 0 && scored[0].score > (scored[1]?.score || 0)) return { project: scored[0].project, reason: 'contract_and_identity' };
  return { project: null, reason: 'ambiguous_contract', candidates: candidates.map((project) => project.id) };
}

export function matchOneCRecord(record, projects, options = {}) {
  if (record.projectId) {
    const direct = projects.find((project) => String(project.id) === record.projectId);
    if (direct) return { project: direct, reason: 'project_id' };
  }
  // A cancellation may arrive after 1C cleared the agreement or counterparty
  // from an unposted/deleted document. The prior imported external ID is then
  // the only safe way to remove the exact old amount from the exact project.
  if (record.status === 'cancelled') {
    const preferred = options.preferredProjectId
      ? projects.find((project) => String(project.id) === String(options.preferredProjectId))
      : null;
    if (preferred) return { project: preferred, reason: 'durable_inbox_match' };

    const existing = projects.filter((project) => projectContainsOneCRecord(project, record, options.source));
    if (existing.length === 1) return { project: existing[0], reason: 'existing_1c_record' };
    if (existing.length > 1) {
      const businessMatch = matchOneCRecordByBusinessIdentity(record, projects);
      if (businessMatch.project && existing.some((project) => String(project.id) === String(businessMatch.project.id))) {
        return { ...businessMatch, reason: `existing_1c_record_and_${businessMatch.reason}` };
      }
      return {
        project: null,
        reason: 'ambiguous_existing_record',
        candidates: existing.map((project) => project.id),
      };
    }
  }
  return matchOneCRecordByBusinessIdentity(record, projects);
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
      const sameOneCPayment = (item) => paymentRecordMatches(item, record, source);
      if (record.status === 'cancelled') {
        for (let index = payments.length - 1; index >= 0; index -= 1) {
          if (paymentRecordMatches(payments[index], record, source, true)) payments.splice(index, 1);
        }
        continue;
      }
      if (record.paymentDocumentId) {
        for (let index = payments.length - 1; index >= 0; index -= 1) {
          if (legacyPaymentExternalIdMatches(payments[index]?.externalId, record.paymentDocumentId)
            && sameOneCSource(payments[index], source)) {
            payments.splice(index, 1);
          }
        }
      }
      const next = {
        id,
        externalId: record.externalId,
        paymentDocumentId: record.paymentDocumentId || undefined,
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
      const index = payments.findIndex(sameOneCPayment);
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
    const index = documents.findIndex((item) => documentRecordMatches(item, record, source));
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

export function removeOneCRecordsFromNotes(rawNotes, records, source = '1C', syncedAt = new Date().toISOString()) {
  const notes = parseNotes(rawNotes);
  const current = notes.accounting && typeof notes.accounting === 'object' && !Array.isArray(notes.accounting)
    ? notes.accounting
    : null;
  if (!current) return { notes, changed: false };

  const removals = array(records);
  const documents = array(current.documents).filter((item) => !removals.some((record) => (
    record.kind !== 'payment' && documentRecordMatches(item, record, source)
  )));
  const payments = array(current.payments).filter((item) => !removals.some((record) => (
    record.kind === 'payment'
    && paymentRecordMatches(item, record, source, record.status === 'cancelled')
  )));
  const changed = documents.length !== array(current.documents).length
    || payments.length !== array(current.payments).length;
  if (!changed) return { notes, changed: false };

  return {
    changed: true,
    notes: {
      ...notes,
      accounting: {
        ...current,
        documents,
        payments,
        sync: { source: '1c', sourceDatabase: source, lastSyncedAt: syncedAt },
        updatedAt: syncedAt,
        updatedBy: '1С',
      },
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
    paymentDocumentId: record.paymentDocumentId || undefined,
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
