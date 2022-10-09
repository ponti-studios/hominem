import {expect} from '@jest/globals';
import {describe} from 'yargs';
import {User} from './finance';

describe('finance', () => {
  it('should create User', () => {
    const user = new User();
    expect(user.salary).toEqual(0);
  });
});
