const { HttpError } = require('../utils/http');

// Drops keys like "$gt" or "a.b" from the JSON body to block NoSQL operator injection.
function stripMongoKeys(value) {
  if (Array.isArray(value)) return value.map(stripMongoKeys);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k.startsWith('$') || k.includes('.')) continue;
      out[k] = stripMongoKeys(v);
    }
    return out;
  }
  return value;
}

function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') req.body = stripMongoKeys(req.body);
  next();
}

// CSRF defence in depth on top of SameSite cookies: a state-changing request that
// carries an Origin header must come from this same host.
function sameOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (origin) {
    let host;
    try {
      host = new URL(origin).host;
    } catch {
      return next(new HttpError(403, 'Bad origin'));
    }
    if (host !== req.get('host')) return next(new HttpError(403, 'Cross-site request blocked'));
  }
  next();
}

module.exports = { sanitizeBody, sameOrigin };
