const swaps = require('./Swap')

describe('Swap', () => {
  it('should not swap items in an array', () => {
    const array = [7, 9, 4]
    expect(swaps.brokenSwap(array, 0, 1)).toEqual([9, 9, 4])
    expect(array).toEqual([9, 9, 4])
  })

  it('should swap items in an array', () => {
    const array = [7, 9, 4]
    expect(swaps.swap(array, 0, 1)).toEqual([9, 7, 4])
    expect(array).toEqual([9, 7, 4])
  })

  it('should swap items in an array', () => {
    const array = [7, 9, 4]
    expect(swaps.functionalSwap(array, 0, 1)).toEqual([9, 7, 4])
    expect(array).toEqual([7, 9, 4])
  })
})
