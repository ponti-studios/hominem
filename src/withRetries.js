const delay = require('./delay');

const withRetries = function ({maxAttempts = 3, minDelay = 1000} = {}) {
  return func => {
    return (function inner(attempt = 1) {
      return func().catch(error => {
        if (attempt < maxAttempts) {
          // Exponential back-off with some randomness
          const baseWait = minDelay * 1.3 ** (attempt - 1);
          const waitFor = baseWait * 0.75 + Math.random() * baseWait * 0.5;
          return delay(waitFor).then(() => inner(attempt + 1));
        }
        throw error;
      });
    })();
  };
};

module.exports = withRetries;
