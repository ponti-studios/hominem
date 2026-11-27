import { main } from '../agent/workflows/main.ts';
import { PassthroughCommand } from '../base-command.js';

export default class Workflow extends PassthroughCommand {
  static override summary = 'Check workflow run progress';

  protected main(args: string[]) {
    return main(args);
  }
}
