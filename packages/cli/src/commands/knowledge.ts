import { main } from '../agent/knowledge/main.ts';
import { PassthroughCommand } from '../base-command.js';

export default class Knowledge extends PassthroughCommand {
  static override summary = 'Validate knowledge extraction batches';

  protected main(args: string[]) {
    return main(args);
  }
}
