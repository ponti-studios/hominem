import * as z from 'zod'

export type FlightOutput = Record<string, unknown>

export const FlightOutputSchema = z.record(z.string(), z.unknown())
