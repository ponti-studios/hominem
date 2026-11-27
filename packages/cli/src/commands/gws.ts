import { main } from '../agent/connectors/gws-log/gws_log.ts';
import { PassthroughCommand } from '../base-command.js';

export default class Gws extends PassthroughCommand {
  static override summary = 'Google Workspace connector';

  protected main(args: string[]) {
    return main(args);
  }
}
