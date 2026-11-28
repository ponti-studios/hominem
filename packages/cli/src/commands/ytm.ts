import { main } from '../agent/connectors/youtube-music/ytm.ts';
import { PassthroughCommand } from '../base-command.js';

export default class Ytm extends PassthroughCommand {
  static override summary = 'YouTube Music connector';

  protected main(args: string[]) {
    return main(args);
  }
}
