// Memories are written in the third person (that's what the copilot reads);
// show them to the person in the second person.
export function humanize(text: string): string {
  return text
    .replace(/^User says:\s*/i, "")
    .replace(/\bthe user\b/g, "you")
    .replace(/\bUser's\b/g, "Your")
    .replace(/\bUser is\b/g, "You are")
    .replace(/\bUser supports\b/g, "You support")
    .replace(/\bUser\b/g, "You")
    .replace(/^On (\d{4}-\d{2}-\d{2}) you/, "On $1 you");
}
