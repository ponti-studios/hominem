import type { Note } from "./notes";
import type { Team } from "./permissions";

export interface Company {
	id: string;
	name: string;
	projects: CompanyProject[];
}

export interface Organization {
	id: string;
	name: string;
	teams: Team[];
}

export interface CompanyProject {
	id: string;
	name: string;
	description?: string;
	candidates: ProjectCandidate[];
}

export interface ProjectCandidate {
	id: string;
	name: string;
	resume?: Document;
	coverLetter?: Document;
	notes?: Note[];
}
