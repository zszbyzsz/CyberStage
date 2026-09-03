import { blackoutLedger } from './scene-packs/blackout-ledger.js';
import { cipherFurnace } from './scene-packs/cipher-furnace.js';
import { controlPlaneEclipse } from './scene-packs/control-plane-eclipse.js';
import { glassSupplyChain } from './scene-packs/glass-supply-chain.js';
import { phantomInbox } from './scene-packs/phantom-inbox.js';
import { trafficAvalanche } from './scene-packs/traffic-avalanche.js';

/**
 * Familiar computer-security stories expressed as deterministic, visual-only
 * timelines. The pack describes signals, decisions, containment, and recovery;
 * it contains no executable actions or live targets.
 */
export const computerScenarios = Object.freeze([
  cipherFurnace,
  controlPlaneEclipse,
  blackoutLedger,
  phantomInbox,
  trafficAvalanche,
  glassSupplyChain,
]);
