import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const moduleSource = readFileSync(new URL(
  '../onec-extension/HUB_1C_Exchange/CommonModules/HUB_ОбменСервер/Ext/Module.bsl',
  import.meta.url,
), 'utf8');

test('1C extension sends deletion and unposting tombstones instead of hiding them', () => {
  for (const alias of ['Счет', 'Реализация', 'Акт', 'ЭСФ', 'Платеж']) {
    assert.match(
      moduleSource,
      new RegExp(`${alias}\\.ПометкаУдаления КАК ПометкаУдаления`),
      `${alias} must expose the deletion mark to the exporter`,
    );
  }

  assert.doesNotMatch(
    moduleSource,
    /\|\s+И НЕ (?:Счет|Реализация|Акт|ЭСФ|Платеж)\.ПометкаУдаления/,
  );
  assert.doesNotMatch(moduleSource, /\|\s+И Платеж\.Проведен/);
  assert.match(
    moduleSource,
    /\?\(Выборка\.ПометкаУдаления Или Не Выборка\.Проведен, "cancelled", "issued"\)/,
  );
  assert.match(
    moduleSource,
    /Если Выборка\.ПометкаУдаления Или Не Выборка\.Проведен Тогда\s+СтатусHUB = "cancelled";/,
  );
});

test('1C payment IDs are stable business allocations and unpaid documents cancel old imports', () => {
  const paymentProcedure = moduleSource.match(
    /Процедура HUB_ДобавитьОплаты[\s\S]*?КонецПроцедуры/,
  )?.[0] || '';

  assert.ok(paymentProcedure);
  assert.doesNotMatch(paymentProcedure, /НомерСтроки/);
  assert.match(paymentProcedure, /АгрегированныеПлатежи = Новый Соответствие/);
  assert.match(paymentProcedure, /ИдентификаторПлатежа/);
  assert.match(paymentProcedure, /КлючДоговора/);
  assert.match(paymentProcedure, /КлючКонтрагента/);
  assert.match(paymentProcedure, /"paymentDocumentId", ИдентификаторПлатежа/);
  assert.match(paymentProcedure, /Запись\.amount \+ Выборка\.Сумма/);
  assert.match(
    paymentProcedure,
    /Выборка\.ПометкаУдаления Или Не Выборка\.Проведен Или Не Выборка\.Оплачено/,
  );
});

test('1C probe has no capture metadata while every actual batch shares one UTC snapshot moment', () => {
  const probe = moduleSource.match(/\u0424\u0443\u043d\u043a\u0446\u0438\u044f \u041f\u0440\u043e\u0432\u0435\u0440\u0438\u0442\u044c\u0421\u0432\u044f\u0437\u044c[\s\S]*?\u041a\u043e\u043d\u0435\u0446\u0424\u0443\u043d\u043a\u0446\u0438\u0438/)?.[0] || '';
  const packetBuilder = moduleSource.match(/\u0424\u0443\u043d\u043a\u0446\u0438\u044f HUB_\u041d\u043e\u0432\u044b\u0439\u041f\u0430\u043a\u0435\u0442[\s\S]*?\u041a\u043e\u043d\u0435\u0446\u0424\u0443\u043d\u043a\u0446\u0438\u0438/)?.[0] || '';

  assert.match(probe, /"fullSnapshot", \u041b\u043e\u0436\u044c/);
  assert.doesNotMatch(probe, /runId|batchIndex|batchCount|snapshotSince|snapshotCapturedAt/);
  assert.match(packetBuilder, /"fullSnapshot", \u0418\u0441\u0442\u0438\u043d\u0430/);
  assert.match(packetBuilder, /"snapshotCapturedAt", \u041c\u043e\u043c\u0435\u043d\u0442\u0421\u043d\u0438\u043c\u043a\u0430/);
  assert.match(packetBuilder, /"snapshotSince", HUB_\u0414\u0430\u0442\u0430JSON\(\u0414\u0430\u0442\u0430\u041d\u0430\u0447\u0430\u043b\u0430\)/);
  assert.match(packetBuilder, /"runId", \u0418\u0434\u0435\u043d\u0442\u0438\u0444\u0438\u043a\u0430\u0442\u043e\u0440\u0417\u0430\u043f\u0443\u0441\u043a\u0430/);
  assert.match(moduleSource, /\u041c\u043e\u043c\u0435\u043d\u0442\u0421\u043d\u0438\u043c\u043a\u0430 = HUB_\u0414\u0430\u0442\u0430\u0412\u0440\u0435\u043c\u044fUTCJSON\(\u0422\u0435\u043a\u0443\u0449\u0430\u044f\u0423\u043d\u0438\u0432\u0435\u0440\u0441\u0430\u043b\u044c\u043d\u0430\u044f\u0414\u0430\u0442\u0430\(\)\);/);
});
