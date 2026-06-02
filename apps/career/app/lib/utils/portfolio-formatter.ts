import type { FullPortfolio } from '../portfolio.server'

/**
 * Formats portfolio data in a natural, LLM-friendly format
 * instead of JSON to improve AI comprehension and resume generation quality
 */
export function formatPortfolioForLLM(portfolioData: FullPortfolio): string {
  let formatted = 'CANDIDATE PROFILE:\n'
  formatted += `Name: ${portfolioData.name}\n`
  formatted += `Current Role: ${portfolioData.jobTitle}\n`
  formatted += `Location: ${portfolioData.currentLocation}\n`
  formatted += `Email: ${portfolioData.email}\n`
  if (portfolioData.phone) formatted += `Phone: ${portfolioData.phone}\n`

  formatted += '\nPROFESSIONAL SUMMARY:\n'
  formatted += `${portfolioData.bio}\n`

  formatted += '\nCONTACT LINKS:'
  if (portfolioData.socialLinks) {
    if (portfolioData.socialLinks.linkedin)
      formatted += `\n- LinkedIn: ${portfolioData.socialLinks.linkedin}`
    if (portfolioData.socialLinks.github)
      formatted += `\n- GitHub: ${portfolioData.socialLinks.github}`
    if (portfolioData.socialLinks.website)
      formatted += `\n- Website: ${portfolioData.socialLinks.website}`
    if (portfolioData.socialLinks.twitter)
      formatted += `\n- Twitter: ${portfolioData.socialLinks.twitter}`
  }

  formatted += '\n\nWORK EXPERIENCE:'
  for (let i = 0; i < portfolioData.workExperiences.length; i++) {
    const exp = portfolioData.workExperiences[i]
    const startDate = exp.startDate
      ? new Date(exp.startDate).toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric',
        })
      : 'Unknown'
    const endDate = exp.endDate
      ? new Date(exp.endDate).toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric',
        })
      : 'Present'

    formatted += `\n\n${i + 1}. ${exp.role} at ${exp.company} (${startDate} - ${endDate})\n`
    formatted += `   Description: ${exp.description}`

    if (exp.metrics) formatted += `\n   Key Metrics: ${exp.metrics}`
    if (exp.tags && exp.tags.length > 0) formatted += `\n   Technologies: ${exp.tags.join(', ')}`
  }

  formatted += '\n\nSKILLS:'
  const skillsByCategory: Record<string, typeof portfolioData.skills> = {}
  for (const skill of portfolioData.skills) {
    const category = skill.category || 'Other'
    if (!skillsByCategory[category]) skillsByCategory[category] = []
    skillsByCategory[category].push(skill)
  }

  for (const [category, skills] of Object.entries(skillsByCategory)) {
    formatted += `\n\n${category}:`
    for (const skill of skills) {
      formatted += `\n- ${skill.name} (${skill.level}% proficiency)`
      if (skill.yearsOfExperience) formatted += ` - ${skill.yearsOfExperience} years`
      if (skill.description) formatted += ` - ${skill.description}`
    }
  }

  formatted += '\n\nPROJECTS:'
  for (let i = 0; i < portfolioData.projects.length; i++) {
    const project = portfolioData.projects[i]
    formatted += `\n\n${i + 1}. ${project.title} (${project.status})\n`
    formatted += `   Description: ${project.description}`

    if (project.technologies && project.technologies.length > 0) {
      formatted += `\n   Technologies: ${project.technologies.join(', ')}`
    }
    if (project.liveUrl) formatted += `\n   Live URL: ${project.liveUrl}`
    if (project.githubUrl) formatted += `\n   GitHub: ${project.githubUrl}`
  }

  if (portfolioData.portfolioStats && portfolioData.portfolioStats.length > 0) {
    formatted += '\n\nKEY STATISTICS:'
    for (const stat of portfolioData.portfolioStats) {
      formatted += `\n- ${stat.label}: ${stat.value}`
    }
  }

  return formatted
}
