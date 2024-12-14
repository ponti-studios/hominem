import process from "node:process";
import { Command } from "commander";
import { applications, db } from "./db/index.ts";
import { ApplicationStatus } from "./db/schema.ts";

const program = new Command();

program
  .version("1.0.0")
  .description("Job Application Logger");

program
  .command("log")
  .description("Log a new job application")
  .requiredOption("-c, --company <company>", "Company name")
  .requiredOption("-l, --location <location>", "Job location")
  .requiredOption("-p, --position <position>", "Job position")
  .option(
    "-d, --date <date>",
    "Date applied (YYYY-MM-DD)",
    new Date().toISOString(),
  )
  .option(
    "-s, --status <status>",
    "Application status",
    ApplicationStatus.APPLIED,
  )
  .action(async (options) => {
    const application: typeof applications.$inferInsert = {
      company: options.company,
      location: options.location,
      position: options.position,
      start_date: options.date,
      status: options.status,
    };
    await db.insert(applications).values(application).run();
    console.log("Job application logged successfully.");
  });

program.parse(process.argv);
