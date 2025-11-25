// keep/server/src/utils/idGenerator.ts

// Generates a short, readable ID (e.g., 'gftr-1234')
export const generateListId = (): string => {
  // Generate a random 4-letter alphanumeric string
  const letters = Math.random().toString(36).substring(2, 6);
  // Generate a random 4-digit number
  const numbers = Math.floor(1000 + Math.random() * 9000).toString();

  return `${letters}-${numbers}`;
};