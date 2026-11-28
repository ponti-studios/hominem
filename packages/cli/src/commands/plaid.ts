import { main } from '../agent/connectors/plaid/plaid.ts';
import { PassthroughCommand } from '../base-command.js';

export default class Plaid extends PassthroughCommand {
  static override summary = 'Plaid connector';

  protected main(args: string[]) {
    return main(args);
  }
}
