import {Item, User} from './finance';
import {describe, it, expect} from 'vitest';

describe('finance', () => {
  it('should create a user', () => {
    const user = new User();
    expect(user).toBeInstanceOf(User);
  });

  it('should set the user salary', () => {
    const user = new User();
    user.setSalary(100000);
    expect(user.salary).toBe(100000);
  });

  it('should add an item to the user', () => {
    const user = new User();
    const item = new Item('iPhone', 1000);
    user.addItem(item);
    expect(user.items).toContain(item);
  });

  it('should calculate the cost per day of an item', () => {
    const user = new User();
    user.setSalary(100000);
    const item = new Item('iPhone', 1000);
    const costPerDay = user.calculateCostPerDay(item);
    expect(costPerDay).toBeCloseTo(0.9132, 4);
  });
  it('should accurately calculate cost per day', () => {
    const user = new User().setSalary(75000);
    const item = new Item('Tesla Model 3', 75000.0);
    expect(user.calculateCostPerDay(item)).toEqual(68.49);
  });
});
