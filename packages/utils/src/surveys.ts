export interface User {
  id: string;
  name: string;
  photoUrl: string;
  email: string;
}

export interface Survey {
  id: string;
  name: string;
  description: string;
  user: User;
  userId: string;
}

export interface SurveryOption {
  id: string;
  description: string;
  title: string;
  survey: Survey;
  surveyId: string;
}

export interface SurveryVote {
  id: string;
  option: SurveryOption;
  optionId: string;
  survey: Survey;
  surveyId: string;
  userId: string;
}
