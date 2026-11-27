import { main } from '../agent/connectors/starling/starling.ts';
import { PassthroughCommand } from '../base-command.js';

export default class Starling extends PassthroughCommand {
  static override summary = 'Starling connector';

  protected main(args: string[]) {
    return main(args);
  }
}
