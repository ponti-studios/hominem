import {User} from './finance';

describe('finance', () => {
  it('should create User', () => {
    const user = new User();
    expect(user.salary).toEqual(0);
  });
  it('should accurately calculate cost per day', () => {
    const user = new User().setSalary(75000);
    const item = new Item('Tesla Model 3', 75000.0);
    expect(user.calculateCostPerDay(item)).toEqual(602.73);
  });
});
