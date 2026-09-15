import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serializedWrite } from '../serialized-write.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('serializedWrite ejecuta las escrituras de una en una y en orden', async () => {
  let active = 0;
  let maxActive = 0;
  const order = [];
  const write = (id, ms) => async () => {
    active++;
    maxActive = Math.max(maxActive, active);
    await sleep(ms);
    order.push(id);
    active--;
    return id;
  };
  const results = await Promise.all([
    serializedWrite(write('a', 30)),
    serializedWrite(write('b', 5)),
    serializedWrite(write('c', 10)),
  ]);
  assert.deepEqual(results, ['a', 'b', 'c']);
  assert.deepEqual(order, ['a', 'b', 'c']);
  assert.equal(maxActive, 1);
});

test('serializedWrite reintenta los conflictos 409 y luego resuelve', async () => {
  let calls = 0;
  const result = await serializedWrite(async () => {
    calls++;
    if (calls < 3) throw Object.assign(new Error('is at X but expected Y'), { status: 409 });
    return 'ok';
  }, { delayMs: 1 });
  assert.equal(result, 'ok');
  assert.equal(calls, 3);
});

test('serializedWrite no reintenta otros errores y la cola sigue viva', async () => {
  let calls = 0;
  await assert.rejects(
    serializedWrite(async () => {
      calls++;
      throw Object.assign(new Error('Bad credentials'), { status: 401 });
    }, { delayMs: 1 }),
    /Bad credentials/,
  );
  assert.equal(calls, 1);
  assert.equal(await serializedWrite(async () => 'siguiente'), 'siguiente');
});

test('serializedWrite se rinde tras los reintentos de 409', async () => {
  let calls = 0;
  await assert.rejects(
    serializedWrite(async () => {
      calls++;
      throw Object.assign(new Error('conflict'), { status: 409 });
    }, { retries: 2, delayMs: 1 }),
    /conflict/,
  );
  assert.equal(calls, 2);
});
