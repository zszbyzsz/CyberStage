import {
  ComposerValidationError,
  exportScenario,
  importScenario,
} from './composer-document.js';
import {
  createComposerState,
  deserializeComposerState,
  serializeComposerState,
} from './composer-state.js';
import { validateScenarioBoundary } from './composer-safety.js';

async function assertBoundary(document) {
  const report = await validateScenarioBoundary(document);
  if (!report.ok) throw new ComposerValidationError(report.errors);
  return report;
}

export async function exportScenarioText(state) {
  await assertBoundary(state.document);
  return exportScenario(state.document);
}

export async function importScenarioText(serialized) {
  const document = importScenario(serialized);
  await assertBoundary(document);
  return createComposerState(document);
}

export function exportComposerStateText(state) {
  return serializeComposerState(state);
}

export async function importComposerStateText(serialized) {
  const state = deserializeComposerState(serialized);
  await assertBoundary(state.document);
  return state;
}

export async function verifyScenarioRoundTrip(state) {
  const first = await exportScenarioText(state);
  const imported = await importScenarioText(first);
  const second = await exportScenarioText(imported);
  return {
    ok: first === second,
    first,
    second,
    imported,
  };
}

export function downloadText(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  queueMicrotask(() => URL.revokeObjectURL(url));
}

export async function readTextFile(file) {
  if (!(file instanceof File)) throw new TypeError('A file is required.');
  if (file.size > 5_000_000) throw new ComposerValidationError(['Composer imports are limited to 5 MB.']);
  return file.text();
}
