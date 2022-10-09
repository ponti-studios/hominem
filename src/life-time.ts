/**
 * Lifestyle Calculator
 *
 * I once pondered how much could be accomplished if one's time were maximally utilized.
 *
 * This file is the exploration of that pondering.
 */

const WEEKLY = 'weekly';
const DAILY = 'daily';
const HOURS = 'hours';
const MINUTES = 'minutes';

/**
 * Activities linked to the maintainance and improvement of the body.
 */
export const body = {
  cooking: {duration: 2, durationType: HOURS, interval: DAILY},
  sleep: {duration: 7, durationType: HOURS, interval: DAILY},
  exercise: {duration: 45, durationType: MINUTES, interval: DAILY},
  yoga: {duration: 1, durationType: HOURS, interval: WEEKLY},
};

/**
 * Activities linked to the maintainance and improvement of the mind.
 */
export const mind = {
  reading: {
    duration: 1,
    durationType: HOURS,
    interval: DAILY,
    score: 5,
  },
  writing: {
    duration: '1 hours',
    durationType: HOURS,
    interval: WEEKLY,
    score: 2,
  },
};
