import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppRouterContext, type AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { parsePublicCatalogJSON, catalogTask } from '../src/lib/catalog/use-account-catalog';
import { KlausurenView, klausurenHistory, type KlausurenAccountAdapter } from '../src/components/klausuren-view';
import type { ScheduleView } from '../src/lib/learning/schedule-contract';
import type { Klausur } from '../src/lib/types';

const exam: Klausur = { id: 'synthetic-zr', source: 'Hamburg synthetisch', title: 'Ursprüngliche Klausurkarte', area: 'zr', date: '', type: 'Urteil', topicIds: [], createdAt: '', updatedAt: '' };
test('R36 Katalog JSON preserves explicit metadata and unknown date; refuses private extensions and oversized batches', () => {
  const publicFields = { id: exam.id, source: exam.source, title: exam.title, area: exam.area, type: exam.type, topicIds: [] };
  assert.equal(parsePublicCatalogJSON(JSON.stringify(publicFields))[0].date, '');
  assert.equal(parsePublicCatalogJSON(`\`\`\`json\n${JSON.stringify([publicFields])}\n\`\`\``)[0].id, exam.id);
  assert.equal(parsePublicCatalogJSON(`${JSON.stringify(publicFields)}\n${JSON.stringify({ ...publicFields, id: 'next' })}`).length, 2);
  assert.throws(() => parsePublicCatalogJSON(JSON.stringify({ ...publicFields, notes: 'private' })), /persönliche Erweiterungen/);
  assert.throws(() => parsePublicCatalogJSON(JSON.stringify({ ...publicFields, id: undefined })), /Pflichtfelder/);
  assert.throws(() => parsePublicCatalogJSON(JSON.stringify(Array.from({ length: 101 }, () => publicFields))), /1 bis 100/);
  assert.throws(() => parsePublicCatalogJSON('x'.repeat(262145)), /256 KiB/);
  assert.throws(() => parsePublicCatalogJSON(`${JSON.stringify(publicFields)} BROKEN`), /ausschließlich/);
});
test('R36 original history keeps separate written/read entries and stable case IDs', () => {
  const h = klausurenHistory([{ id: 't1', activityType: 'klausur', date: '2026-10-20', klausurId: exam.id, klausurMode: 'read', topicIds: [], durationMinutes: 120, rating: 2, note: '', createdAt: '' }, { id: 't2', activityType: 'klausur', date: '2026-10-21', klausurId: exam.id, klausurMode: 'written', topicIds: [], durationMinutes: 300, rating: 4, note: '', createdAt: '' }], [exam]);
  assert.equal(h.map.get(exam.id)?.count, 2); assert.equal(h.map.get(exam.id)?.rating, 4); assert.deepEqual(h.list.map(r => r.mode), ['written', 'read']);
});
test('R36 task lookup respects same-day links, modes and deferred tasks', () => {
  const v = { records: [{ kind: 'task', id: 'deferred', value: { id: 'deferred', linkedKlausurId: exam.id, date: '2026-10-23', deferred: true } }, { kind: 'task', id: 'read', value: { id: 'read', linkedKlausurId: exam.id, date: '2026-10-23', title: 'Skizze: Fall' } }, { kind: 'task', id: 'written', value: { id: 'written', linkedKlausurId: exam.id, date: '2026-10-23', title: 'Fall', klausurMode: 'written' } }] } as unknown as ScheduleView;
  assert.equal(catalogTask(v, exam.id, '2026-10-23', 'read')?.id, 'read'); assert.equal(catalogTask(v, exam.id, '2026-10-23', 'written')?.id, 'written'); assert.equal(catalogTask(v, exam.id, '2026-10-24'), undefined);
});
test('R36 account mode renders the extracted ORIGINAL card/filter/sidebar/dialog markup and member controls stay closed', () => {
  const adapter: KlausurenAccountAdapter = { klausuren: [exam], trackingEntries: [], admin: false, busy: false, statusPanel: 'Kontodaten bestätigt', uploadPanel: 'Geschützter PDFupload', importPanel: null, pdfLinks: () => null, edit: async () => null, save: async () => false, remove: async () => false, previewImport: async () => {}, jsonChanged: () => {}, done: async () => false, plan: async () => false, write: async () => {}, boosts: () => [] };
  const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch: async () => {} } as unknown as AppRouterInstance;
  const html = renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router }, createElement(KlausurenView, { account: adapter })));
  assert.match(html, /Klausur-Datenbank/); assert.match(html, /Ursprüngliche Klausurkarte/); assert.match(html, /synthetic-zr/); assert.match(html, /lg:grid-cols-\[1fr_240px\]/); assert.match(html, /Bearbeitet/); assert.match(html, /Kontodaten bestätigt/);
  assert.match(html, /Pilot noch nicht freigegeben/); assert.match(html, /disabled=""[^>]*>[\s\S]*?Import/); assert.doesNotMatch(html, /auto-UUID/);
});
