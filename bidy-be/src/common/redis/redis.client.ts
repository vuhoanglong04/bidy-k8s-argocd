import Redis from 'ioredis';

const redis = new Redis({
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD,
    lazyConnect: true,
});

redis.on('error', (err) => {
    console.error('[Redis] Connection error:', err.message);
});

export default redis;
