import { main } from '../agent/routines/cadence_regen.ts';
import { PassthroughCommand } from '../base-command.js';

export default class Cadence extends PassthroughCommand {
  static override summary = 'Regenerate an open Google Tasks cadence';

  protected main(args: string[]) {
    return main(args);
  }
}
