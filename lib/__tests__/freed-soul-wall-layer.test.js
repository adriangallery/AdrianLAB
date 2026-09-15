import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getLayerSequence, getWallLayers } from '../v2/render/layer-order.js';
import { generateRenderHash } from '../render-hash.js';

const common = { generation: '1', skinId: '1', skinName: 'Zero', traitCategories: ['BACKGROUND', 'EYES', 'GEAR', 'HEAD'], traitIds: ['268', '151', '50', '217'] };

test('Freed Soul (GEAR 1183) va en la pared y no en la secuencia normal', () => {
  const traits = { BACKGROUND: '268', EYES: '151', GEAR: '1183', HEAD: '217' };
  assert.deepEqual(getWallLayers(traits), [{ category: 'GEAR', traitId: '1183', phase: 'wall' }]);
  assert.equal(getLayerSequence(traits).some((l) => l.traitId === '1183'), false);
});

test('un GEAR normal sigue en la secuencia normal y no en la pared', () => {
  const traits = { BACKGROUND: '268', GEAR: '50' };
  assert.deepEqual(getWallLayers(traits), []);
  assert.equal(getLayerSequence(traits).some((l) => l.category === 'GEAR' && l.traitId === '50'), true);
});

test('el hash de un token sin Freed Soul no cambia (su caché en GitHub sigue valiendo)', () => {
  // Valor calculado con lib/render-hash.js de main antes de este cambio
  assert.equal(generateRenderHash(common), 'fd517704cfb9c145');
});

test('con Freed Soul el hash cambia para no servir renders con el orden antiguo', () => {
  const wall = { ...common, traitIds: ['268', '151', '1183', '217'] };
  assert.notEqual(generateRenderHash(wall), 'd6a2d4b5be77304b');
});
