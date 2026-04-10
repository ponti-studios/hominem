/**
 * This module tracks user activity and prompts for a review after a certain number of active days.
 * It uses Expo's StoreReview API to request a review when the threshold is met.
 */
import * as StoreReview from 'expo-store-review';

import { E2E_TESTING } from '~/constants';
import { storage } from '../storage/mmkv';

const ACTIVE_DAYS_KEY = 'review_active_days';
const PROMPTED_KEY = 'review_prompted';
const THRESHOLD = 7;

function todayKey() {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

export async function recordActiveDay() {
  if (E2E_TESTING) return;

  const alreadyPrompted = storage.getBoolean(PROMPTED_KEY) ?? false;
  if (alreadyPrompted) return;

  const isAvailable = await StoreReview.isAvailableAsync();
  if (!isAvailable) return;

  const raw = storage.getString(ACTIVE_DAYS_KEY) ?? '[]';
  const days: string[] = JSON.parse(raw);
  const today = todayKey();

  if (!days.includes(today)) {
    days.push(today);
    storage.set(ACTIVE_DAYS_KEY, JSON.stringify(days));
  }

  if (days.length >= THRESHOLD) {
    storage.set(PROMPTED_KEY, true);
    await StoreReview.requestReview();
  }
}
