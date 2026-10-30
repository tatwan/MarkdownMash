function parseHistoryQuery(query = {}) {
  const integer = (value, fallback, maximum) => {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
    const number = Number(value);
    return Number.isSafeInteger(number) && number <= maximum ? number : null;
  };
  const page = integer(query.page, 1, 1000000);
  const limit = integer(query.limit, 50, 100);
  const filter = query.filter === undefined ? 'all' : query.filter;
  const type = query.type === undefined ? 'all' : query.type;
  const search = query.search === undefined ? '' : query.search;
  const course = query.course === undefined ? '' : query.course;

  if (page === null || limit === null
    || !['all', 'ended', 'incomplete', 'test'].includes(filter)
    || !['all', 'quiz', 'survey'].includes(type)
    || typeof search !== 'string' || search.length > 500
    || typeof course !== 'string') {
    return { ok: false, error: 'Invalid session history filters or pagination.' };
  }

  return {
    ok: true,
    value: { page, limit, offset: (page - 1) * limit, filter, type, search: search.trim(), course }
  };
}

function historyPagination(total, { page, limit }) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { page, limit, total, totalPages, hasPrevious: page > 1, hasNext: page < totalPages };
}

module.exports = { parseHistoryQuery, historyPagination };
