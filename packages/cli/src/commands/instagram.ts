import { main } from '../agent/connectors/instagram/instagram.ts';
import { PassthroughCommand } from '../base-command.js';

export default class Instagram extends PassthroughCommand {
  static override summary = 'Instagram connector';

  protected main(args: string[]) {
    return main(args);
  }
}
