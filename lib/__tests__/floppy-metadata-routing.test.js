import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyFloppyMetadataToken, labMetadataIds } from '../floppy-metadata-routing.js';

const none = () => false;

test('los ids que ya funcionaban mantienen su rama', () => {
  const cases = {
    1: 'trait', 1181: 'trait', 9999: 'trait',
    1123: 'floppy', 10000: 'floppy', 10019: 'floppy', 10020: 'floppy',
    15000: 'pager', 15007: 'pager', 15013: 'pager',
    15008: 'actionPack', 15010: 'actionPack',
    15014: 'mcorder',
    20000: 'achievement', 20099: 'achievement',
    30000: 'studio', 30301: 'studio', 35000: 'studio',
    100001: 'ogpunk', 101003: 'ogpunk',
    262144: 'serum', 262147: 'serum',
    262148: 'floppy', 15015: 'floppy',
  };
  for (const [id, kind] of Object.entries(cases)) {
    assert.equal(classifyFloppyMetadataToken(Number(id), { has: none }), kind, `id ${id}`);
  }
});

test('un serum, action pack o pager nuevo sale por su rama si está en su JSON', () => {
  const has = (kind, id) => (kind === 'serums' && id === 262148) || (kind === 'actionPacks' && id === 15020) || (kind === 'pagers' && id === 15021);
  assert.equal(classifyFloppyMetadataToken(262148, { has }), 'serum');
  assert.equal(classifyFloppyMetadataToken(15020, { has }), 'actionPack');
  assert.equal(classifyFloppyMetadataToken(15021, { has }), 'pager');
});

test('la pertenencia a un JSON no roba ids de traits (1–9999)', () => {
  const has = () => true;
  assert.equal(classifyFloppyMetadataToken(42, { has }), 'trait');
});

test('ids inválidos no tienen rama', () => {
  for (const id of [0, -1, NaN, 1.5]) assert.equal(classifyFloppyMetadataToken(id, { has: none }), 'none');
});

test('lee los JSON reales del repo', () => {
  assert.ok(labMetadataIds('serums').has(262144));
  assert.ok(labMetadataIds('actionPacks').has(15008));
  assert.ok(labMetadataIds('pagers').has(15011));
  assert.equal(classifyFloppyMetadataToken(15011), 'pager');
});
