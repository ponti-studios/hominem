import { tool } from 'ai';
import type { ToolSet } from 'ai';
import * as z from 'zod';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const ActivitySchema = z.object({
  activityId: z.string().optional(),
  activityType: z.string().describe('Type of activity (e.g., "running", "cycling")'),
  duration: z.number().describe('Duration of activity in minutes'),
  caloriesBurned: z.number().describe('Calories burned during activity'),
  date: z.string().describe('Date of activity (YYYY-MM-DD)'),
  notes: z.string().optional().describe('Additional notes about the activity'),
});

const logHealthActivityInputSchema = ActivitySchema.omit({ activityId: true });

const getHealthActivitiesInputSchema = z.object({
  startDate: z.string().optional().describe('Start date (YYYY-MM-DD)'),
  endDate: z.string().optional().describe('End date (YYYY-MM-DD)'),
  activityType: z.string().optional().describe('Filter by activity type'),
});

const updateHealthActivityInputSchema = z.object({
  activityId: z.string().describe('ID of the activity to update'),
  activityType: z.string().optional().describe('New type of activity'),
  duration: z.number().optional().describe('New duration in minutes'),
  caloriesBurned: z.number().optional().describe('New calories burned'),
  notes: z.string().optional().describe('New notes'),
});

const deleteHealthActivityInputSchema = z.object({
  activityId: z.string().describe('ID of the activity to delete'),
});

const recommendWorkoutInputSchema = z.object({
  fitnessLevel: z.enum(['beginner', 'intermediate', 'advanced']).describe('Current fitness level'),
  goal: z
    .enum(['strength', 'endurance', 'weight_loss', 'muscle_gain', 'general_fitness'])
    .describe('Primary fitness goal'),
  timeAvailable: z.number().min(10).max(120).describe('Time available for workout in minutes'),
  equipment: z
    .array(z.string())
    .optional()
    .describe('Available equipment (e.g., dumbbells, barbell, kettlebell)'),
  limitations: z
    .array(z.string())
    .optional()
    .describe('Physical limitations or injuries to consider'),
});

const assessMentalWellnessInputSchema = z.object({
  stressDescription: z.string().describe('Description of current stressors or concerns'),
  moodRating: z
    .number()
    .min(1)
    .max(10)
    .describe('Current mood rating from 1 (very low) to 10 (excellent)'),
  recentChallenges: z.array(z.string()).optional().describe('Recent challenges or difficulties'),
  currentCopingStrategies: z
    .array(z.string())
    .optional()
    .describe('Coping strategies currently being used'),
});

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export const getAvailableTools = (_userId: string): ToolSet => ({
  log_health_activity: tool({
    description: 'Log a health activity',
    parameters: logHealthActivityInputSchema,
    execute: async (input) => ({
      message: `Logged ${input.activityType} activity for ${input.duration} minutes on ${input.date}`,
      activityId: `activity_${Date.now()}`,
    }),
  }),

  get_health_activities: tool({
    description: 'Get health activities',
    parameters: getHealthActivitiesInputSchema,
    execute: async (_input) => ({ activities: [] as z.infer<typeof ActivitySchema>[] }),
  }),

  update_health_activity: tool({
    description: 'Update a health activity',
    parameters: updateHealthActivityInputSchema,
    execute: async (input) => ({
      message: `Updated health activity ${input.activityId}`,
      updatedActivity: { ...input },
    }),
  }),

  delete_health_activity: tool({
    description: 'Delete a health activity',
    parameters: deleteHealthActivityInputSchema,
    execute: async (input) => ({
      message: `Deleted health activity ${input.activityId}`,
      deleted: true,
    }),
  }),

  recommend_workout: tool({
    description: 'Get personalized workout recommendations based on fitness level and goals',
    parameters: recommendWorkoutInputSchema,
    execute: async (_input) => ({
      title: 'Quick Workout',
      duration: '30 minutes',
      exercises: [],
      notes: [],
    }),
  }),

  assess_mental_wellness: tool({
    description: 'Assess mental wellness and get personalized coping strategies and recommendations',
    parameters: assessMentalWellnessInputSchema,
    execute: async (_input) => ({
      overallAssessment: 'OK',
      stressLevel: 5,
      copingStrategies: [],
      recommendations: [],
      positiveAffirmation: 'You are doing fine',
    }),
  }),
});
