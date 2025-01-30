import type { users } from "./types/users";

export interface Survey {
	id: string;
	name: string;
	description: string;
	user: (typeof users.$inferSelect)["id"];
	userId: string;
}

export interface SurveyOption {
	id: string;
	description: string;
	title: string;
	survey: Survey;
	surveyId: string;
}

export interface SurveyVote {
	id: string;
	option: SurveyOption;
	optionId: string;
	survey: Survey;
	surveyId: string;
	userId: string;
}
