import { main } from '../agent/connectors/spotify/spotify.ts';
import { PassthroughCommand } from '../base-command.js';

export default class Spotify extends PassthroughCommand {
  static override summary = 'Spotify connector';

  protected main(args: string[]) {
    return main(args);
  }
}
