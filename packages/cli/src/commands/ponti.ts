import { main } from '../agent/connectors/ponti-log/ponti_log.ts';
import { PassthroughCommand } from '../base-command.js';

export default class Ponti extends PassthroughCommand {
  static override summary = 'Ponti connector';

  protected main(args: string[]) {
    return main(args);
  }
}
