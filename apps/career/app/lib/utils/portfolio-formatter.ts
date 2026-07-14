import type { UserSocialLinksRecord } from '@hominem/db';

import { jsonArray } from '../db-json';
import type { FullPortfolio } from '../portfolio.server';

/**
 * Formats portfolio data in a natural, LLM-friendly format
 * instead of JSON to improve AI comprehension and resume generation quality
 */
export function formatPortfolioForLLM(
  portfolioData: FullPortfolio,
  socialLinks: UserSocialLinksRecord | null,
): string {
  let formatted = 'CANDIDATE PROFILE:\n';
  formatted += `Name: ${portfolioData.name}\n`;
  formatted += `Current Role: ${portfolioData.jobTitle}\n`;
  formatted += `Location: ${portfolioData.currentLocation}\n`;
  formatted += `Email: ${portfolioData.email}\n`;
  if (portfolioData.phone) formatted += `Phone: ${portfolioData.phone}\n`;

  formatted += '\nPROFESSIONAL SUMMARY:\n';
  formatted += `${portfolioData.bio}\n`;

  formatted += '\nCONTACT LINKS:';
  if (socialLinks) {
    if (socialLinks.linkedin) formatted += `\n- LinkedIn: ${socialLinks.linkedin}`;
    if (socialLinks.github) formatted += `\n- GitHub: ${socialLinks.github}`;
    if (socialLinks.website) formatted += `\n- Website: ${socialLinks.website}`;
    if (socialLinks.twitter) formatted += `\n- Twitter: ${socialLinks.twitter}`;
  }

  formatted += '\n\nWORK EXPERIENCE:';
  for (let i = 0; i < portfolioData.work_experiences.length; i++) {
    const exp = portfolioData.work_experiences[i];
    const startDate = exp.startDate
      ? new Date(exp.startDate).toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric',
          timeZone: 'UTC',
        })
      : 'Unknown';
    const endDate = exp.endDate
      ? new Date(exp.endDate).toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric',
          timeZone: 'UTC',
        })
      : 'Present';

    formatted += `\n\n${i + 1}. ${exp.role} at ${exp.company} (${startDate} - ${endDate})\n`;
    formatted += `   Description: ${exp.description}`;

    if (exp.metrics) formatted += `\n   Key Metrics: ${exp.metrics}`;
    const tags = jsonArray<string>(exp.tags);
    if (tags.length > 0) formatted += `\n   Technologies: ${tags.join(', ')}`;
  }

  formatted += '\n\nSKILLS:';
  const skillsByCategory: Record<string, typeof portfolioData.skills> = {};
  for (const skill of portfolioData.skills) {
    const category = skill.category || 'Other';
    if (!skillsByCategory[category]) skillsByCategory[category] = [];
    skillsByCategory[category].push(skill);
  }

  for (const [category, skills] of Object.entries(skillsByCategory)) {
    formatted += `\n\n${category}:`;
    for (const skill of skills) {
      formatted += `\n- ${skill.name} (${skill.level}% proficiency)`;
      if (skill.yearsOfExperience) formatted += ` - ${skill.yearsOfExperience} years`;
      if (skill.description) formatted += ` - ${skill.description}`;
    }
  }

  formatted += '\n\nPROJECTS:';
  for (let i = 0; i < portfolioData.projects.length; i++) {
    const project = portfolioData.projects[i];
    formatted += `\n\n${i + 1}. ${project.title} (${project.status})\n`;
    formatted += `   Description: ${project.description}`;

    const technologies = jsonArray<string>(project.technologies);
    if (technologies.length > 0) {
      formatted += `\n   Technologies: ${technologies.join(', ')}`;
    }
    if (project.liveUrl) formatted += `\n   Live URL: ${project.liveUrl}`;
    if (project.githubUrl) formatted += `\n   GitHub: ${project.githubUrl}`;
  }

  return formatted;
}
