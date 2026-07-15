import { db, TestimonialRepository } from '@hominem/db';

export async function getTestimonialsByPortfolio(portfolioId: string) {
  return TestimonialRepository.listByPortfolioId(db, portfolioId);
}

export async function getTestimonialById(ownerUserid: string, testimonialId: string) {
  return TestimonialRepository.getTestimonialById(db, ownerUserid, testimonialId);
}
