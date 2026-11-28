import { main } from '../agent/connectors/linear-log/linear_log.ts';
import { PassthroughCommand } from '../base-command.js';

export default class Linear extends PassthroughCommand {
  static override summary = 'Linear connector';

  protected main(args: string[]) {
    return main(args);
  }
}
