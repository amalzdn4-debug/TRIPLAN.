import bcrypt from "bcryptjs";

const COST = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

export function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  // Compare against a dummy hash when the user has none, to keep timing uniform.
  return bcrypt.compare(password, hash || "$2a$12$CwTycUXWue0Thq9StjUM0uJ8.qJ9fH8eWl1XMYxQyGx3BmQXcYJ3K");
}
