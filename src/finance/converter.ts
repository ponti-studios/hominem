import csv from 'csvtojson';
import * as fs from 'fs';
import {Bank, GetTransactionsResponse, KeyMap} from '.';
import {capital_one} from './capital-one';

export function formatTransaction(
  transaction: KeyMap,
  formatFunction: Function,
  keyMap: KeyMap
) {
  return Object.keys(capital_one.keyMap).reduce(
    (result, key) => ({
      ...result,
      [keyMap[key]]: formatFunction(key, transaction),
    }),
    {}
  );
}

export async function getTransactionsFile(
  filePath: string
): Promise<GetTransactionsResponse> {
  try {
    return {
      data: await csv().fromFile(
        `${process.env.HOME}/Documents/data/${filePath}`
      ),
    };
  } catch (err) {
    console.log(err);
    return {error: 'Could not retrieve transactions file'};
  }
}

export async function convertCSVtoJSON(bankObj: Bank) {
  const {data, error} = await getTransactionsFile(bankObj.path);

  if (data) {
    const translated = data.map((t: KeyMap) =>
      formatTransaction(t, bankObj.formatter, bankObj.keyMap)
    );
    fs.writeFileSync(
      `${process.env.HOME}/Documents/finance/${bankObj.name}/transactions.json`,
      JSON.stringify(translated, null, 2)
    );
  }

  if (error) {
    console.error(`No transactions from file (${bankObj.keyMap})`, error);
  }
}
