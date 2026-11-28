import { main } from '../agent/connectors/notion-log/notion_log.ts';
import { PassthroughCommand } from '../base-command.js';

export default class Notion extends PassthroughCommand {
  static override summary = 'Notion connector';

  protected main(args: string[]) {
    return main(args);
  }
}
