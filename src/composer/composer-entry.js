import { mountSceneComposer } from './composer-app.js';

const root = document.querySelector('[data-scene-composer]');
if (!root) throw new Error('Scene Composer root was not found.');

const initialDocument = window.__CYBERSTAGE_SCENARIO__;
const composer = mountSceneComposer(root, initialDocument);
Object.defineProperty(window, 'CyberStageComposer', {
  value: composer,
  configurable: true,
});
