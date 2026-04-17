import { currentUser } from "@clerk/nextjs/server";

function allowedEmails(): Set<string> {
  return new Set(
    (process.env.CLERK_ALLOWED_EMAILS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

export async function requireCoach() {
  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");

  const allow = allowedEmails();
  if (allow.size > 0) {
    const email = user.primaryEmailAddress?.emailAddress?.toLowerCase();
    if (!email || !allow.has(email)) {
      throw new Error("Forbidden: not on coach allowlist");
    }
  }
  return user;
}
