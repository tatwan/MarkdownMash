const assert = require('node:assert/strict');
const { parseHistoryQuery, historyPagination } = require('./analytics-history');

const defaults = parseHistoryQuery();
assert.equal(defaults.ok, true);
assert.deepEqual(defaults.value, {
  page: 1, limit: 50, offset: 0, filter: 'all', type: 'all', search: '', course: ''
});
assert.deepEqual(parseHistoryQuery({
  page: '2', limit: '25', filter: 'test', type: 'survey', search: '  Old mash  ', course: 'all'
}).value, {
  page: 2, limit: 25, offset: 25, filter: 'test', type: 'survey', search: 'Old mash', course: 'all'
});
for (const key of ['page', 'limit']) {
  for (const value of ['0', '-1', '1.5', '2abc', '1e3', 'Infinity', '', ['2'], {}, 2, '9007199254740993']) {
    assert.equal(parseHistoryQuery({ [key]: value }).ok, false, `${key}: ${String(value)}`);
  }
}
assert.equal(parseHistoryQuery({ limit: '101' }).ok, false);
assert.equal(parseHistoryQuery({ page: '1000001' }).ok, false);
assert.equal(parseHistoryQuery({ limit: '100' }).ok, true);
for (const filter of ['all', 'ended', 'incomplete', 'test']) {
  assert.equal(parseHistoryQuery({ filter }).ok, true);
}
for (const input of [
  { filter: 'unknown' }, { type: 'poll' }, { filter: ['all'] }, { type: {} },
  { search: ['private'] }, { course: {} }, { search: 'x'.repeat(501) }
]) {
  assert.equal(parseHistoryQuery(input).ok, false);
}
assert.equal(parseHistoryQuery({ search: '100%_\\' }).value.search, '100%_\\');
assert.equal('ownerId' in parseHistoryQuery({ ownerId: '9' }).value, false,
  'query parameters never choose the account');

assert.deepEqual(historyPagination(84, defaults.value), {
  page: 1, limit: 50, total: 84, totalPages: 2, hasPrevious: false, hasNext: true
});
assert.deepEqual(historyPagination(84, { page: 2, limit: 50 }), {
  page: 2, limit: 50, total: 84, totalPages: 2, hasPrevious: true, hasNext: false
});
assert.equal(historyPagination(50, defaults.value).hasNext, false);
assert.equal(historyPagination(0, defaults.value).totalPages, 1);
assert.equal(historyPagination(0, defaults.value).hasNext, false);
assert.equal(historyPagination(50, { page: 2, limit: 50 }).totalPages, 1,
  'a removed last-page match tells the client to reload the new last page');

console.log('All analytics history tests passed.');
