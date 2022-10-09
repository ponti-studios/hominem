import moment from 'moment';
import {convertCSVtoJSON} from './converter';

export interface CapitalOneTransaction {
  'Account Number': string;
  'Transaction Date': string;
  'Transaction Amount': string;
  'Transaction Type': string;
  'Transaction Description': string;
  [key: string]: string;
}

export const capital_one = {
  name: 'Capital One 360 Checking',
  bankName: 'capital_one',
  ends_in: '9015',
  path: 'finance/capital-one-checking.csv',
  keyMap: {
    'Account Number': 'account',
    'Transaction Date': 'date',
    'Transaction Amount': 'amount',
    'Transaction Type': 'type',
    'Transaction Description': 'description',
    Balance: 'balance',
  },
  formatter(key: string, transaction: CapitalOneTransaction): string {
    switch (key) {
      case 'Account Number':
        return capital_one.name;
      case 'Transaction Date':
        return moment(new Date(transaction[key])).format('YYYY-MM-DD');
      case 'Transaction Description':
        return transaction[key]
          .replace('Withdrawal from ', '')
          .replace('Withdrawal to ', '')
          .replace('Digital Card Purchase - ', '')
          .replace('Debit Card Purchase - ', '')
          .replace('Deposit from ', '');
      default:
        return transaction[key] as string;
    }
  },
};

(async function () {
  await convertCSVtoJSON(capital_one);
})();
