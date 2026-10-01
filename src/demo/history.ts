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
  answerAccuracy?: "accurate" | "uncertain" | "inaccurate";
}

const prompts = [
  ["How are you feeling today?", "I feel all right."],
  ["Did you have breakfast?", "Yes, I had toast."],
  ["What would you like to do this morning?", "I might read for a while."],
  ["Would you like some water?", "Yes, please."],
  ["Would you like to open the curtains?", "Yes, that would be nice."],
  ["What would you like to do after lunch?", "I could listen to the radio."],
] as const;

function addMinutes(date: Date, minutes: number): Date {
  const result = new Date(date);
  result.setMinutes(result.getMinutes() + minutes);
  return result;
}

function stageFor(daysAgo: number): number {
  return daysAgo < 30 ? 4 : daysAgo < 90 ? 3 : daysAgo < 180 ? 2 : daysAgo < 270 ? 1 : 0;
}

function baseQuestionCount(daysAgo: number): number {
  return 3 + ((daysAgo + 1) % 3);
}

function extraQuestionCount(daysAgo: number, recipient: "manuel" | "maria", stage: number): number {
  if (recipient !== "manuel") return 0;
  return stage >= 4 ? 2 + (daysAgo % 3 === 0 ? 1 : 0)
    : stage === 3 ? (daysAgo % 2 === 0 ? 2 : 1)
      : stage === 2 ? (daysAgo % 3 === 0 ? 1 : 0)
        : stage === 1 ? (daysAgo % 6 === 0 ? 1 : 0)
          : daysAgo % 12 === 0 ? 1 : 0;
}

export function demoQuestionCount(daysAgo: number, recipient: "manuel" | "maria"): number {
  const stage = stageFor(daysAgo);
  return baseQuestionCount(daysAgo) + extraQuestionCount(daysAgo, recipient, stage);
}

function makeDailyQuestions(daysAgo: number, recipient: "manuel" | "maria"): DemoQuestionRecord[] {
  const recipientId = recipient === "manuel" ? "recipient-manuel" : "recipient-maria";
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(8, 0, 0, 0);
  const stage = stageFor(daysAgo);
  const delayBase = recipient === "manuel" ? 9_000 + stage * 6_000 : 8_000;
  const records = Array.from({ length: baseQuestionCount(daysAgo) }, (_, index): DemoQuestionRecord => {
    const [question, answer] = prompts[(daysAgo + index) % prompts.length];
    const responseTimeMs = delayBase + ((daysAgo + index * 2) % 5) * (recipient === "manuel" ? 4_000 : 1_000);
    const inaccurate = recipient === "manuel" && stage >= 2 && [1, 2].includes(index) && (daysAgo + index * 7) % 17 < stage;
    return {
      id: `history-${recipient}-${daysAgo}-${index}`,
      summaryId: `history-summary-${recipient}-${daysAgo}`,
      careRecipientId: recipientId,
      question,
      answer: inaccurate ? index === 1 ? "I think I had breakfast yesterday." : "I’m not sure; didn’t I already answer that?" : answer,
      answerAccuracy: inaccurate ? "inaccurate" : "accurate",
      responseTimeMs,
      baselineMs: recipient === "manuel" ? 9_000 : 8_000,
      pulseBpm: recipient === "manuel" ? 72 + ((daysAgo + index) % 7) : 70 + ((daysAgo + index) % 6),
      askedAt: addMinutes(date, index * 3).toISOString(),
    };
  });

  const extraQuestions = extraQuestionCount(daysAgo, recipient, stage);
  const followUps = ["What time is my appointment?", "Can you remind me what happens next?", "Did you say we’re leaving now?"];
  for (let index = 0; index < extraQuestions; index += 1) {
      records.push({
        id: `history-manuel-${daysAgo}-repeat-${index}`,
        summaryId: `history-summary-manuel-${daysAgo}`,
        careRecipientId: recipientId,
        question: followUps[index % followUps.length],
        answer: stage >= 3 && index > 0 ? "I thought you said we were staying home." : "The appointment is at 10:30 AM.",
        answerAccuracy: stage >= 3 && index > 0 ? "inaccurate" : "accurate",
        responseTimeMs: delayBase + 10_000 + index * 4_000,
        baselineMs: 9_000,
        pulseBpm: 76,
        askedAt: addMinutes(date, 16 + index * 4).toISOString(),
        isRepeat: true,
      });
  }

  return records;
}

export const demoQuestionHistory: DemoQuestionRecord[] = Array.from({ length: 365 }, (_, daysAgo) => {
  return [...makeDailyQuestions(daysAgo, "manuel"), ...makeDailyQuestions(daysAgo, "maria")];
}).flat();
