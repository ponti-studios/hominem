const yargs = require('yargs')

/**
 * Determine if a number `a` is divisble by a number `b`
 * 
 * @param {number} a 
 * @param {number} b 
 * @returns {boolean}
 */
exports.isDivisible = function isDivisible (a, b) {
  return a % b === 0
}

/**
 * Determine if a number `n` is even
 * 
 * @param {number} n 
 * @returns {boolean}
 */
function isEven (n) {
  return n % 2 === 0
}

/**
 * Determine if a number `n` is odd
 * 
 * @param {number} n 
 * @returns {boolean}
 */
function isOdd (n) {
  return !isEven(n)
}

/**
 * Determine the value of a number `a` to the power of a number 
 * `b` using recursion.
 * 
 * @param {number} a
 * @param {number} b 
 * @returns 
 */
function power (a, b) {
  /**
   * base case: n is zero
   * n = 0, x^0 = 1
   */
  if (b === 0) return 1

  /**
   * recursive case: n is negative 
   * y = 1 / x^-n
   */
  if (b < 0) return 1 / power(a, -b)

  /**
   * recursive case: n is odd
   * y = x * x^(n - 1 ... 1)
   */
  if (isOdd(b)) return a * power(a, b - 1)

  /**
   * recursive case: n is even
   * y = x^n/2 ... x^n = y * y
   */
  if (isEven(b)) {
    var y = power(a, b / 2)
    return y * y
  }
}

if (require.main === module) {
  console.log(power(yargs.argv.n, yargs.argv.exp))
}

module.exports = power
