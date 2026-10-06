import { expect, it } from "vitest";
import { localCalendarDay } from "./localCalendarDay";
it("selects the local October 2 care plan when Madrid midnight is still October 1 UTC", () => {
 const date = new Date(2026, 9, 2, 0, 30);
 expect(localCalendarDay(date)).toBe("2026-10-02");
 if (date.getTimezoneOffset() < 0) expect(date.toISOString().slice(0, 10)).toBe("2026-10-01");
});
