// Mock resume parser for demonstration
export interface ParsedResumeData {
  name: string
  title: string
  email: string
  phone?: string
  location?: string
  bio: string
  workExperiences: {
    jobTitle: string
    companyName: string
    startDate: string
    endDate?: string
    description: string
    location?: string
  }[]
  skills: {
    name: string
    category: string
    proficiency: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert'
  }[]
  socialLinks: {
    platform: string
    url: string
  }[]
}

// Mock function to simulate parsing a PDF resume
export async function parseResume(file: File): Promise<ParsedResumeData> {
  // Simulate processing time
  await new Promise((resolve) => setTimeout(resolve, 2000))

  // Return mock parsed data
  return {
    name: 'John Doe',
    title: 'Full Stack Developer',
    email: 'john.doe@example.com',
    phone: '+1 (555) 123-4567',
    location: 'San Francisco, CA',
    bio: 'Experienced full stack developer with a passion for creating efficient and scalable web applications. Skilled in modern JavaScript frameworks and cloud technologies.',
    workExperiences: [
      {
        jobTitle: 'Senior Full Stack Developer',
        companyName: 'Tech Company Inc.',
        startDate: '2022-01-01',
        endDate: '2024-12-01',
        description:
          'Led development of multiple web applications using React, Node.js, and AWS. Improved application performance by 40% and mentored junior developers.',
        location: 'San Francisco, CA',
      },
      {
        jobTitle: 'Full Stack Developer',
        companyName: 'Startup LLC',
        startDate: '2020-06-01',
        endDate: '2021-12-01',
        description:
          'Developed and maintained web applications using React, Express.js, and PostgreSQL. Collaborated with design team to implement responsive user interfaces.',
        location: 'Remote',
      },
    ],
    skills: [
      {
        name: 'JavaScript',
        category: 'Programming Languages',
        proficiency: 'Expert',
      },
      {
        name: 'TypeScript',
        category: 'Programming Languages',
        proficiency: 'Advanced',
      },
      { name: 'React', category: 'Frontend Frameworks', proficiency: 'Expert' },
      {
        name: 'Node.js',
        category: 'Backend Technologies',
        proficiency: 'Advanced',
      },
      {
        name: 'PostgreSQL',
        category: 'Databases',
        proficiency: 'Intermediate',
      },
      { name: 'AWS', category: 'Cloud Platforms', proficiency: 'Intermediate' },
    ],
    socialLinks: [
      { platform: 'linkedin', url: 'https://linkedin.com/in/johndoe' },
      { platform: 'github', url: 'https://github.com/johndoe' },
    ],
  }
}

// Function to save parsed resume data to the database
export async function saveResumeData(userId: string, data: ParsedResumeData): Promise<boolean> {
  // This would save the data to Supabase
  // For now, just return true to simulate success
  return true
}
