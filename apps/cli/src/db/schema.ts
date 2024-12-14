import { blob, int, sqliteTable, text } from "drizzle-orm/sqlite-core";

export enum ApplicationStage {
  APPLICATION = "Application",
  PHONE_SCREEN = "Phone Screen",
  TECHNICAL_SCREEN_CALL = "Technical Screen (Call)",
  TECHNICAL_SCREEN_EXERCISE = "Technical Screen (Exercise)",
  INTERVIEW = "Interview",
  IN_PERSON = "In Person",
  OFFER = "Offer",
}

export enum ApplicationStatus {
  APPLIED = "Applied",
  HIRED = "Hired",
  WITHDREW = "Withdrew",
  REJECTED = "Rejected",
  OFFER = "Offer",
}

export const applications = sqliteTable("applications", {
  company: text().notNull(),
  start_date: text().notNull().default(new Date().toISOString()),
  end_date: text(),
  had_phone_screen: text().notNull().default("FALSE"),
  id: int().primaryKey({ autoIncrement: true }),
  is_active: text().notNull().default("TRUE"),
  link: text(),
  location: text().notNull().default("Remote"),
  position: text().notNull(),
  reference: text().notNull().default("FALSE"),
  stage: text().notNull().default(ApplicationStage.APPLICATION),
  stages: blob().notNull().default(
    JSON.stringify([ApplicationStage.APPLICATION]),
  ),
  status: text().notNull().default(ApplicationStatus.APPLIED),
}, () => []);

export const application_stages = sqliteTable("application_stages", {
  id: int().primaryKey({ autoIncrement: true }),
  application_id: int().notNull(),
  name: text().notNull(),
}, () => []);
