const mongoose = require('mongoose');
const config = require('./src/config');
const createApp = require('./src/app');

async function main() {
  await mongoose.connect(config.mongoUri);
  console.log('MongoDB connected');

  const server = createApp().listen(config.port, () =>
    console.log(`${config.appName} running on http://localhost:${config.port} (${config.env})`)
  );

  const shutdown = (sig) => {
    console.log(`${sig} received, shutting down`);
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});
