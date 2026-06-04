import type { FullPortfolio } from '../portfolio.server';
import { jsonArray } from '../db-json';

/**
 * Formats portfolio data in a natural, LLM-friendly format
 * instead of JSON to improve AI comprehension and resume generation quality
 */
export function formatPortfolioForLLM(portfolioData: FullPortfolio): string {
  let formatted = 'CANDIDATE PROFILE:\n';
  formatted += `Name: ${portfolioData.name}\n`;
  formatted += `Current Role: ${portfolioData.job_title}\n`;
  formatted += `Location: ${portfolioData.current_location}\n`;
  formatted += `Email: ${portfolioData.email}\n`;
  if (portfolioData.phone) formatted += `Phone: ${portfolioData.phone}\n`;

  formatted += '\nPROFESSIONAL SUMMARY:\n';
  formatted += `${portfolioData.bio}\n`;

  formatted += '\nCONTACT LINKS:';
  if (portfolioData.social_links) {
    if (portfolioData.social_links.linkedin)
      formatted += `\n- LinkedIn: ${portfolioData.social_links.linkedin}`;
    if (portfolioData.social_links.github)
      formatted += `\n- GitHub: ${portfolioData.social_links.github}`;
    if (portfolioData.social_links.website)
      formatted += `\n- Website: ${portfolioData.social_links.website}`;
    if (portfolioData.social_links.twitter)
      formatted += `\n- Twitter: ${portfolioData.social_links.twitter}`;
  }

  formatted += '\n\nWORK EXPERIENCE:';
  for (let i = 0; i < portfolioData.work_experiences.length; i++) {
    const exp = portfolioData.work_experiences[i];
    const start_date = exp.start_date
      ? new Date(exp.start_date).toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric',
        })
      : 'Unknown';
    const end_date = exp.end_date
      ? new Date(exp.end_date).toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric',
        })
      : 'Present';

    formatted += `\n\n${i + 1}. ${exp.role} at ${exp.company} (${start_date} - ${end_date})\n`;
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
      if (skill.years_of_experience) formatted += ` - ${skill.years_of_experience} years`;
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
    if (project.live_url) formatted += `\n   Live URL: ${project.live_url}`;
    if (project.github_url) formatted += `\n   GitHub: ${project.github_url}`;
  }

  if (portfolioData.portfolio_stats && portfolioData.portfolio_stats.length > 0) {
    formatted += '\n\nKEY STATISTICS:';
    for (const stat of portfolioData.portfolio_stats) {
      formatted += `\n- ${stat.label}: ${stat.value}`;
    }
  }

  return formatted;
}
