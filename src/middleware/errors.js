const config = require('../config');

function notFoundApi(req, res) {
  res.status(404).json({ message: `No such endpoint: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message;

  if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors).map((e) => e.message).join('. ');
  } else if (err.name === 'CastError') {
    status = 404;
    message = 'Not found';
  } else if (err.code === 11000) {
    status = 409;
    message = 'That value is already in use';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON body';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'Request body too large';
  } else if (err.name === 'MulterError') {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? `Image must be under ${config.maxUploadMB}MB` : err.message;
  }

  if (status >= 500) {
    console.error(err);
    if (config.isProd) message = 'Something went wrong on our side';
  }
  res.status(status).json({ message, ...(err.details ? { details: err.details } : {}) });
}

module.exports = { notFoundApi, errorHandler };
