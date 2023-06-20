const Boom = require('@hapi/boom');

// Helper to rate limit a route by a key (like ip or user id)
const rateLimitDecoratorFactory = opts => server => {
  const noop = () => {};
  const {
    redis,
    decoratorName,
    getCustomError,
    maxHits,
    onRateLimit = noop,
    segment: keyPrefix,
    windowLength: expInMilliseconds,
  } = opts;

  async function verifyKeyExpiration(cacheKey) {
    const ttl = await redis.ttl(cacheKey);
    const expirationMissing = ttl === -1;
    if (expirationMissing) {
      // Edge scenario, probably caused by a key that expired between
      // the .get and the .incr call. Incr operation on a non-existing key
      // would set it to zero without expiration. Let's set it manually
      await redis.expire(cacheKey, expInMilliseconds / 1000);
    }
  }

  async function rateLimit(key) {
    const req = this;
    const cacheKey = `${keyPrefix}::${key}`;

    const UNAVAILABLE_REDIS_STATUSES = ['reconnecting', 'error'];

    if (UNAVAILABLE_REDIS_STATUSES.includes(redis.status)) {
      // Redis temporary shortage. Disable Rate limit
      // https://github.com/luin/ioredis#connection-events
      return;
    }
    let rateLimitError = null;
    try {
      const cachedValue = await redis.get(cacheKey);

      const valueToInt = Number.parseInt(cachedValue, 10);
      const counter = Number.isNaN(valueToInt) ? 0 : valueToInt;

      if (counter >= maxHits) {
        await verifyKeyExpiration(cacheKey);
        onRateLimit(req, key);
        // newrelic.incrementMetric(`RateLimit/${keyPrefix}`);
        rateLimitError = getCustomError
          ? getCustomError(req, key)
          : Boom.tooManyRequests();
      } else if (cachedValue) {
        await Promise.all([
          redis.incr(cacheKey),
          verifyKeyExpiration(cacheKey),
        ]);
      } else {
        await redis.set(cacheKey, counter + 1, 'PX', expInMilliseconds);
      }
    } catch (error) {
      // Unexpected error probably means Redis shortage, which should be temporary (by SLA)
      // quiet handling: ignore error, which means rate limit is
      // temporary disabled and does not block any request.
    }

    if (rateLimitError) {
      throw rateLimitError;
    }
  }

  server.decorate('request', decoratorName, rateLimit);
};

module.exports = rateLimitDecoratorFactory;
