const isString = (v: string | null | undefined): v is string => Boolean(v);

/**
 * Extracts timestamps from a YouTube playlist section element.
 *
 * This function parses a given HTML element representing a YouTube playlist section
 * and extracts the timestamps of the playlist items. It assumes the timestamps are
 * located within elements with the class "badge-shape-wiz__text".
 *
 * @param {Element} el - The YouTube playlist section element.
 * @returns {string[]} An array of timestamps in the format "HH:MM:SS" or "MM:SS".
 */
export function getPlaylistTimestamps(el: Element) {
  const timestampBadges = el.querySelectorAll(".badge-shape-wiz__text")
  return Array.from(timestampBadges).map((e: Element) => e.textContent).filter(isString);
}

/**
 * Calculates the total duration of a list of timestamps.
 *
 * This function takes an array of timestamps in the format "HH:MM:SS" or "MM:SS"
 * and calculates the total duration in days, hours, minutes, and seconds.
 *
 * @param {string[]} timestamps - An array of timestamps.
 * @returns {{ days: number, hours: number, minutes: number, seconds: number }}
 *   An object containing the total duration in days, hours, minutes, and seconds.
 */
export function calculateTotalTimeFromArray(timestamps: string[]) {
  const aggregator = {
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  };

  for (const time of timestamps) {
    const splits = time.split(':').map(Number);

    // Normalize timestamps to always have hours, minutes, and seconds
    if (splits.length === 2) {
      splits.unshift(0);
    }

    const [hours, minutes, seconds] = splits;

    aggregator.seconds += seconds;
    if (aggregator.seconds >= 60) {
      aggregator.minutes += 1;
      aggregator.seconds -= 60;
    }

    aggregator.minutes += minutes;
    if (aggregator.minutes >= 60) {
      aggregator.hours += 1;
      aggregator.minutes -= 60;
    }

    aggregator.hours += hours;
    if (aggregator.hours >= 24) {
      aggregator.days += 1;
      aggregator.hours -= 24;
    }
  }

  return aggregator;
}

export function getPlaylistLength(el: Element) {
  return calculateTotalTimeFromArray(getPlaylistTimestamps(el))
}