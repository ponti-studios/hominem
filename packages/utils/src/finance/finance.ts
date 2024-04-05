/**
 * # Cost per Time
 *
 * ## Description
 * Determine how much an item costs of a user's time in minutes, hours, days, and years.
 *
 * ## Steps
 *  1. Create a User class
 *  2. Get user’s annual salary
 *  3. Get price of item
 *  4. Determine user’s hourly rate
 *  5. Determine how many minutes of a user's time it times to afford item
 *  6. Determine how many hours of a user's time it times to afford item
 *  7. Determine how many days of a user's time it times to afford item
 *  8. Determine how many years of a user's time it times to afford item
 */

const {v4: uuidV4} = require('uuid');

export class User {
  id: number;
  items: Item[] = [];
  salary = 0;

  constructor() {
    this.id = uuidV4();
  }

  setSalary(salary: number): User {
    this.salary = salary;
    return this;
  }

  addItem(item: Item): User {
    this.items.push(item);
    return this;
  }

  calculateCostPerDay(item: Item): number {
    return +(item.price / 3 / 365).toPrecision(4);
  }
}

export class Item {
  name: string;
  price = 0;

  constructor(name: string, price: number) {
    this.name = name;
    this.price = price;
  }
}
