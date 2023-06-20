export interface Bank {
  name: string;
  path: string;
  keyMap: KeyMap;
  formatter: Function;
}

export interface GetTransactionsResponse {
  error?: string;
  data?: KeyMap[];
}

export type KeyMap = {[key: string]: string};
