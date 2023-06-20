/**
 * * Maximal Time Utilization
 *
 * I once pondered how much could be accomplished if one's time were maximally utilized.
 *
 * To determine maximum utilization, some data points would need to be calcuted:
 * 1. How much time is spent on different activities?
 * 2. What is the goal of each activity?
 * 3. What impact does the activity have on the goal?
 *
 * This file is the exploration of that pondering.
 */

type Interval = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
type DurationType = 'MINUTES' | 'HOURS' | 'WEEKS';
type ActivityType = 'BODY' | 'MIND';

interface Activity {
  duration: number;
  durationType: DurationType;
  interval: Interval;
  /* The impact, on a 1-10 scale, of the activity on the improvement of the type */
  score: number;
  startDate: Date;
  title: string;
  type: ActivityType;
}

/**
 * Activities linked to the maintainance and improvement of the body.
 */
export const body: Activity[] = [
  {
    duration: 2,
    durationType: 'HOURS',
    interval: 'DAILY',
    startDate: new Date(),
    score: 10,
    title: 'cooking',
    type: 'BODY',
  },
  {
    duration: 7,
    durationType: 'HOURS',
    interval: 'DAILY',
    startDate: new Date(),
    score: 10,
    title: 'sleep',
    type: 'BODY',
  },
  {
    duration: 45,
    durationType: 'MINUTES',
    interval: 'DAILY',
    score: 8,
    startDate: new Date(),
    title: 'exercise',
    type: 'BODY',
  },
  {
    duration: 1,
    durationType: 'HOURS',
    interval: 'WEEKLY',
    score: 5,
    startDate: new Date(),
    title: 'meditation',
    type: 'BODY',
  },
  {
    duration: 1,
    durationType: 'HOURS',
    interval: 'DAILY',
    score: 5,
    startDate: new Date(),
    title: 'reading',
    type: 'MIND',
  },
  {
    duration: 1,
    durationType: 'HOURS',
    interval: 'WEEKLY',
    score: 2,
    startDate: new Date(),
    title: 'writing',
    type: 'MIND',
  },
];
