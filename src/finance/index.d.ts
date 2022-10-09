export interface Bank {
  name: string;
  path: string;
  keyMap: KeyMap;
  formatter: Function;
}

interface GetTransactionsResponse {
  error?: string;
  data?: KeyMap[];
}

type KeyMap = {[key: string]: string};
