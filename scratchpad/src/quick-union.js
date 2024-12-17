/**
 * {lazy approach}: Avoid doing work until you have to.
 * Tree - Forest
 * Interpretation: id[i] is the parent of i
 * Root of i is id[id[....id[i]...]]
 * 
 * Defect:
 * * Trees can get too tall
 * * Find too expensive (Could be N array accesses)
 */
class QuickUnion {
  constructor (N) {
    this.tree = new Array(N)
    for (var i = 0; i < N; i++) {
      this.tree[i] = N
    }
  }

  /**
   * Make the q's root the root of p's root
   * @param {Number} p 
   * @param {Number} q 
   */
  union (p, q) {
    const pRoot = root(p)
    const qRoot = root(q)
    this.tree[pRoot] = this.tree[qRoot]
  }

  /**
   * Determine if the root of each object is the same
   * @param {Number} p 
   * @param {Number} q 
   */
  connected (p, q) {
    return root(p) === root(q)
  }

  /**
   * Find root of object
   * @param {Number} i 
   */
  root (i) {
    while (i != this.tree[i]) i = this.tree[i]
    return i
  }
}

module.exports = QuickUnion
