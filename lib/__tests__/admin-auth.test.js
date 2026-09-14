import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAdminKeyValid, readAdminKey, requireAdmin } from '../admin-auth.js';

function fakeRes() {
  const res = { code: null, payload: null };
  res.status = (c) => { res.code = c; return res; };
  res.json = (p) => { res.payload = p; return res; };
  return res;
}

test('lee la clave de Bearer, x-admin-key o body.apiKey', () => {
  assert.equal(readAdminKey({ headers: { authorization: 'Bearer abc' } }), 'abc');
  assert.equal(readAdminKey({ headers: { 'x-admin-key': ' xyz ' } }), 'xyz');
  assert.equal(readAdminKey({ headers: {}, body: { apiKey: 'legacy' } }), 'legacy');
  assert.equal(readAdminKey({ headers: {} }), '');
});

test('compara exacto y rechaza vacíos', () => {
  assert.equal(isAdminKeyValid('secret-1', 'secret-1'), true);
  assert.equal(isAdminKeyValid('secret-2', 'secret-1'), false);
  assert.equal(isAdminKeyValid('short', 'much-longer-key'), false);
  assert.equal(isAdminKeyValid('', 'x'), false);
  assert.equal(isAdminKeyValid('x', ''), false);
});

test('sin clave configurada responde 503 (fail closed)', () => {
  const res = fakeRes();
  assert.equal(requireAdmin({ headers: { authorization: 'Bearer anything' } }, res, ''), false);
  assert.equal(res.code, 503);
});

test('clave mala → 401, buena → true sin responder', () => {
  const bad = fakeRes();
  assert.equal(requireAdmin({ headers: { authorization: 'Bearer nope' } }, bad, 'right'), false);
  assert.equal(bad.code, 401);
  const good = fakeRes();
  assert.equal(requireAdmin({ headers: { authorization: 'Bearer right' } }, good, 'right'), true);
  assert.equal(good.code, null);
});
