import {
  db,
  PortfolioRepository,
  WorkExperienceRepository,
  SkillRepository,
} from '@hominem/db';

import { careerPortfolioSchema } from '../schemas/career.schema';

export class CareerService {
  async getOwnPortfolio(ownerUserId: string) {
    const portfolio = await PortfolioRepository.getPortfolioByUserId(db, ownerUserId);
    if (!portfolio) {
      return null;
    }

    const [workExperiences, skills] = await Promise.all([
      WorkExperienceRepository.listPublicByPortfolioId(db, portfolio.id),
      SkillRepository.listByPortfolioId(db, portfolio.id),
    ]);

    return careerPortfolioSchema.parse({
      id: portfolio.id,
      slug: portfolio.slug,
      name: portfolio.name,
      title: portfolio.title,
      bio: portfolio.bio,
      tagline: portfolio.tagline,
      currentLocation: portfolio.currentLocation,
      email: portfolio.email,
      isPublic: portfolio.isPublic,
      profileImageUrl: portfolio.profileImageUrl,
      workExperiences: workExperiences.map((we) => ({
        id: we.id,
        role: we.role,
        company: we.company,
        description: we.description,
        startDate: we.startDate,
        endDate: we.endDate,
        isVisible: true,
      })),
      skills: skills.map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        isVisible: true,
      })),
    });
  }

  async listUserExperiences(ownerUserId: string, limit: number) {
    const records = await WorkExperienceRepository.listUserWorkExperiences(db, ownerUserId);
    const limited = records.slice(0, limit);

    return {
      experiences: limited.map((we) => ({
        id: we.id,
        role: we.role,
        company: we.company,
        description: we.description,
        startDate: we.startDate,
        endDate: we.endDate,
        employmentType: we.employmentType,
        workArrangement: we.workArrangement,
        isVisible: we.isVisible,
      })),
    };
  }
}
