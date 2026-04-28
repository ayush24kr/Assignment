const Redis = require('ioredis');
const { REDIS_HOST, REDIS_PORT } = require('./env');

const redis = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 5000);
    console.warn(`Redis reconnecting... attempt ${times}, delay ${delay}ms`);
    return delay;
  },
});

redis.on('connect', () => {
  console.log('✅ Redis connected');
});

redis.on('error', (err) => {
  console.error(`❌ Redis error: ${err.message}`);
});

module.exports = redis;
