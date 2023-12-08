/**
 * # Activity
 *
 * An activity is a task that is performed to achieve a goal.
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

export interface Activity {
  duration: number;
  durationType: DurationType;
  interval: Interval;
  /* The impact, on a 1-10 scale, of the activity on the improvement of the type */
  score: number;
  startDate: Date;
  title: string;
  type: ActivityType;
}
