import { validateDocument } from './composer-document.js';

const VALIDATOR_NAMES = [
  'validateScenario',
  'validateScenarioDocument',
  'validateScenarioDefinition',
  'validateScenarioSafety',
  'assertScenario',
  'assertScenarioSafe',
];

let modulePromise;

async function repositoryScenarioModule() {
  modulePromise ??= import('../scenario.js').catch(() => null);
  return modulePromise;
}

function normalizeResult(result) {
  if (result === false) return { ok: false, errors: ['Repository scenario validation rejected the document.'] };
  if (Array.isArray(result)) return { ok: result.length === 0, errors: result.map(String) };
  if (result && typeof result === 'object') {
    if (Array.isArray(result.errors)) {
      const ok = result.ok ?? result.valid ?? result.errors.length === 0;
      return { ok: Boolean(ok), errors: result.errors.map((entry) => String(entry?.message ?? entry)) };
    }
    if (typeof result.ok === 'boolean') return { ok: result.ok, errors: result.ok ? [] : ['Repository scenario validation rejected the document.'] };
    if (typeof result.valid === 'boolean') return { ok: result.valid, errors: result.valid ? [] : ['Repository scenario validation rejected the document.'] };
  }
  return { ok: true, errors: [] };
}

export async function validateScenarioBoundary(document) {
  const local = validateDocument(document);
  if (!local.ok) return { ...local, checkedBy: ['composer-document'] };

  const repositoryModule = await repositoryScenarioModule();
  if (!repositoryModule) {
    return { ok: true, errors: [], checkedBy: ['composer-document', 'repository-guard'] };
  }

  const validatorName = VALIDATOR_NAMES.find((name) => typeof repositoryModule[name] === 'function');
  if (!validatorName) {
    return { ok: true, errors: [], checkedBy: ['composer-document', 'repository-guard'] };
  }

  try {
    const result = await repositoryModule[validatorName](document);
    const normalized = normalizeResult(result);
    return {
      ...normalized,
      checkedBy: ['composer-document', `scenario.js:${validatorName}`, 'repository-guard'],
    };
  } catch (error) {
    return {
      ok: false,
      errors: [String(error?.message ?? error)],
      checkedBy: ['composer-document', `scenario.js:${validatorName}`, 'repository-guard'],
    };
  }
}
