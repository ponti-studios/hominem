const { parseModelJson } = require('./json-utils');

// These checks encode two real bugs found in a manual eval of gemma4:e2b-mlx on
// 2026-07-06 (see experiments/local-llm/results.md):
//   1. Fabricating priority: "none" instead of omitting the field.
//   2. Using end-of-day (23:59:59) for a date with no explicit clock time,
//      instead of the noon default the prompt specifies.
// Keeping these as concrete assertions (not vibes) is the whole point of a
// reliable eval — this is the exact thing a manual read is prone to miss on
// a re-run with a different model or prompt tweak.

function hasNoonTime(isoString) {
  return typeof isoString === 'string' && isoString.includes('T12:00:00');
}

module.exports = function (output, context) {
  let parsed;
  try {
    parsed = parseModelJson(output);
  } catch (e) {
    return { pass: false, score: 0, reason: `Invalid JSON: ${e.message}` };
  }

  const tasks = parsed.tasks;
  if (!Array.isArray(tasks)) {
    return { pass: false, score: 0, reason: 'Missing or non-array "tasks" field' };
  }

  const caseId = context.vars.caseId;
  const problems = [];

  if (caseId === 'urgency-and-date') {
    if (tasks.length !== 2) {
      return { pass: false, score: 0, reason: `Expected 2 tasks, got ${tasks.length}` };
    }

    const landlord = tasks.find((t) => /landlord|lease/i.test(t.title || ''));
    const dentist = tasks.find((t) => /dentist/i.test(t.title || ''));

    if (!landlord) problems.push('No landlord/lease task found');
    if (!dentist) problems.push('No dentist task found');

    if (landlord) {
      if (landlord.priority !== 'urgent') {
        problems.push(`Landlord task priority should be "urgent", got ${JSON.stringify(landlord.priority)}`);
      }
      if (landlord.dueDate && !hasNoonTime(landlord.dueDate)) {
        problems.push(
          `Landlord task due "today" should default to noon (T12:00:00), got ${landlord.dueDate}`,
        );
      }
    }

    if (dentist) {
      // "no rush" is explicit urgency language per the prompt's own examples —
      // the field should be present (not omitted), and should not read as urgent.
      if (dentist.priority === undefined) {
        problems.push('Dentist task priority omitted, but "no rush" is explicit urgency language');
      } else if (dentist.priority === 'none') {
        problems.push('Dentist task priority fabricated as literal "none" instead of a real low-urgency value');
      } else if (/urgent|high|asap|critical/i.test(dentist.priority)) {
        problems.push(`Dentist task priority "${dentist.priority}" contradicts stated "no rush"`);
      }
      if (dentist.dueDate && !hasNoonTime(dentist.dueDate)) {
        problems.push(`Dentist task due "next Friday" (no time given) should default to noon, got ${dentist.dueDate}`);
      }
    }

    return problems.length
      ? { pass: false, score: 0, reason: problems.join('; ') }
      : { pass: true, score: 1, reason: 'Priority and due-date handling correct for both tasks' };
  }

  if (caseId === 'noon-default') {
    if (tasks.length !== 1) {
      return { pass: false, score: 0, reason: `Expected 1 task, got ${tasks.length}` };
    }
    const task = tasks[0];
    if (task.priority !== undefined) {
      problems.push(`Priority should be omitted (no urgency stated), got ${JSON.stringify(task.priority)}`);
    }
    if (!hasNoonTime(task.dueDate)) {
      problems.push(`Due date should default to noon (T12:00:00), got ${task.dueDate}`);
    }
    return problems.length
      ? { pass: false, score: 0, reason: problems.join('; ') }
      : { pass: true, score: 1, reason: 'Priority correctly omitted and noon default applied' };
  }

  return { pass: false, score: 0, reason: `Unknown caseId: ${caseId}` };
};
