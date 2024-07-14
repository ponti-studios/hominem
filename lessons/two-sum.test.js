const {twoSum} = require('./two-sum');

describe('twoSum', () => {
  it('should find where', () => {
    expect(twoSum([2, 7, 11, 15], 9)).toEqual([0, 1]);
  });
});
