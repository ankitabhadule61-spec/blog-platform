process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret';
process.env.UPLOAD_DIR = require('path').join(require('os').tmpdir(), 'blogsphere-test-uploads');
process.env.ADMIN_EMAILS = 'admin@example.com';
