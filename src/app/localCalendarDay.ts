/** Match the browser calendar day rather than the UTC date near midnight. */
export function localCalendarDay(date = new Date()): string {
 return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
