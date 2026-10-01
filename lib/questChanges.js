// Turns "what a professor just changed on a quest" into short phrases for the
// students' notification. Pure function, no database access.
//
// before / after: { bountyPoints, deadline (ms timestamp or null), attachmentUrl }
function formatDate(ms) {
  // Deadlines are stored as UTC midnight (that's what a date input produces),
  // so format in UTC to always show the day the professor picked.
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function describeQuestChanges(before, after) {
  const changes = [];

  if (after.bountyPoints !== before.bountyPoints) {
    changes.push(`bounty is now ${after.bountyPoints} pts (was ${before.bountyPoints})`);
  }

  if (after.deadline !== before.deadline) {
    changes.push(after.deadline == null ? "the deadline was removed" : `deadline is now ${formatDate(after.deadline)}`);
  }

  if (after.attachmentUrl !== before.attachmentUrl) {
    changes.push(before.attachmentUrl ? "the attached file was replaced" : "a file was attached");
  }

  return changes;
}
