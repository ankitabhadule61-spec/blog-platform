class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const bad = (msg, details) => new HttpError(400, msg, details);
const notFound = (msg = 'Not found') => new HttpError(404, msg);
const forbidden = (msg = 'You do not have permission to do that') => new HttpError(403, msg);

// Pagination helper: clamps user supplied values.
const paging = (query, defLimit = 10, maxLimit = 50) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defLimit));
  return { page, limit, skip: (page - 1) * limit };
};

const pageOf = (items, total, { page, limit }) => ({
  items,
  page,
  limit,
  total,
  pages: Math.max(1, Math.ceil(total / limit))
});

const isObjectId = (v) => /^[a-f\d]{24}$/i.test(String(v));

module.exports = { HttpError, bad, notFound, forbidden, paging, pageOf, isObjectId };
