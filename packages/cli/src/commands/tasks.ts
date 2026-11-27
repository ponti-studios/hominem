import { main } from '../agent/connectors/google-tasks/google_tasks.ts';
import { PassthroughCommand } from '../base-command.js';

export default class Tasks extends PassthroughCommand {
  static override summary = 'Google Tasks API';

  protected main(args: string[]) {
    return main(args);
  }
}
