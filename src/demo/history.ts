export interface DemoQuestionRecord {
  id: string;
  summaryId: string;
  careRecipientId: string;
  question: string;
  answer: string;
  responseTimeMs: number;
  baselineMs: number;
  pulseBpm: number;
  askedAt: string;
  isRepeat?: boolean;
}

const prompts = [
  ["How are you feeling today?", "I feel all right."],
  ["Did you have breakfast?", "Yes, I had toast."],
  ["What would you like to do this morning?", "I might read for a while."],
  ["Would you like some water?", "Yes, please."],
] as const;

function addMinutes(date: Date, minutes: number): Date {
  const result = new Date(date);
  result.setMinutes(result.getMinutes() + minutes);
  return result;
}

function makeDailyQuestions(daysAgo: number, recipient: "manuel" | "maria"): DemoQuestionRecord[] {
  const recipientId = recipient === "manuel" ? "recipient-manuel" : "recipient-maria";
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(8, 0, 0, 0);
  const delayBase = recipient === "manuel"
    ? daysAgo < 45 ? 25_000 : daysAgo < 120 ? 17_000 : 9_000
    : 8_000;
  const records = prompts.map<DemoQuestionRecord>(([question, answer], index) => {
    const responseTimeMs = delayBase + ((daysAgo + index * 2) % 4) * 2_000;
    return {
      id: `history-${recipient}-${daysAgo}-${index}`,
      summaryId: `history-summary-${recipient}-${daysAgo}`,
      careRecipientId: recipientId,
      question,
      answer,
      responseTimeMs,
      baselineMs: recipient === "manuel" ? 9_000 : 8_000,
      pulseBpm: recipient === "manuel" ? 72 + ((daysAgo + index) % 7) : 70 + ((daysAgo + index) % 6),
      askedAt: addMinutes(date, index * 3).toISOString(),
    };
  });

  if (recipient === "manuel" && daysAgo < 150 && (daysAgo % 3 === 0 || daysAgo < 25 && daysAgo % 2 === 0)) {
    const repeats = daysAgo < 45 && daysAgo % 4 === 0 ? 2 : 1;
    for (let index = 0; index < repeats; index += 1) {
      records.push({
        id: `history-manuel-${daysAgo}-repeat-${index}`,
        summaryId: `history-summary-manuel-${daysAgo}`,
        careRecipientId: recipientId,
        question: index === 0 ? "What time is my appointment?" : "Can you remind me what time I need to leave?",
        answer: "The appointment is at 10:30 AM.",
        responseTimeMs: delayBase + 8_000,
        baselineMs: 9_000,
        pulseBpm: 76,
        askedAt: addMinutes(date, 16 + index * 2).toISOString(),
        isRepeat: true,
      });
    }
  }

  return records;
}

export const demoQuestionHistory: DemoQuestionRecord[] = Array.from({ length: 365 }, (_, daysAgo) => {
  const records: DemoQuestionRecord[] = [];
  if (daysAgo % 2 === 0) records.push(...makeDailyQuestions(daysAgo, "manuel"));
  if (daysAgo % 3 === 0) records.push(...makeDailyQuestions(daysAgo, "maria"));
  return records;
}).flat();
