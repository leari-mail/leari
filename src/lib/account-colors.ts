/** Account accent colors, led by the macaw's cobalt and yellow. */
export const accountColors = [
  "#3552b8", // cobalt
  "#e8b923", // eye-ring yellow
  "#2a9d8f", // teal
  "#d9534f", // red
  "#8e5bd6", // violet
  "#4aa3df", // sky
  "#f08a4b", // orange
  "#5b8c5a", // green
] as const;

export function pickAccountColor(index: number): string {
  return accountColors[index % accountColors.length];
}

/** Stable color for any string (e.g. a sender address), picked from the account palette. */
export function colorFromString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return pickAccountColor(Math.abs(hash));
}
