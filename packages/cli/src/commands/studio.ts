import { main } from '../agent/studio/main.ts';
import { PassthroughCommand } from '../base-command.js';

export default class Studio extends PassthroughCommand {
  static override summary = 'Render studio assets such as nameplates';

  protected main(args: string[]) {
    return main(args);
  }
}
