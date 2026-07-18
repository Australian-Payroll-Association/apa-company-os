// Server-only. Which admins get the assistant's write + email tools.
//
// Everyone in company_os.admins gets the read-only assistant; only the emails
// listed here also get execute_write and send_email (each individual action
// still requires an explicit Approve click in the chat UI). Deliberately not
// stored in the DB: expanding this list should be a deploy, not a row edit.

const DEFAULT_PRIVILEGED = "dave@edge8.ai";

export function isPrivilegedChatUser(email: string | null | undefined): boolean {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return false;
  return (process.env.CHATBOT_PRIVILEGED_EMAILS ?? DEFAULT_PRIVILEGED)
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalized);
}
