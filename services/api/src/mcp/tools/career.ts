import { NotFoundError } from '@hominem/db';
import * as z from 'zod';

import { CareerService } from '../../application/career.service';
import {
  careerExperiencesQuerySchema,
  careerExperiencesSchema,
  careerPortfolioSchema,
} from '../../schemas/career.schema';
import { registerTool } from '../tools';

const careerService = new CareerService();

// No-input schema — the tool resolves the authenticated user's portfolio internally
const noInputSchema = z.object({});

registerTool('get_career_portfolio', {
  name: 'get_career_portfolio',
  title: 'Get your career portfolio',
  description: 'Returns your own career portfolio data (name, title, bio, work experiences, skills — no compensation data).',
  inputSchema: noInputSchema,
  outputSchema: careerPortfolioSchema,
  readOnly: true,
  scopes: ['career:read'],
  sensitivity: 'standard',
  resultCap: 1,
}, async (ownerUserId, _input) => {
  const portfolio = await careerService.getOwnPortfolio(ownerUserId);
  if (!portfolio) {
    throw new NotFoundError('Portfolio', { ownerUserId });
  }
  return portfolio;
});

registerTool('list_career_experiences', {
  name: 'list_career_experiences',
  title: 'List career work experiences',
  description: 'Returns the authenticated user work experiences (role, company, dates — no compensation data).',
  inputSchema: careerExperiencesQuerySchema,
  outputSchema: careerExperiencesSchema,
  readOnly: true,
  scopes: ['career:read'],
  sensitivity: 'standard',
  resultCap: 50,
}, async (ownerUserId, input) => {
  const parsed = careerExperiencesQuerySchema.parse(input);
  return careerService.listUserExperiences(ownerUserId, parsed.limit);
});
