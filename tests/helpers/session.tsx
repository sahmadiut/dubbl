import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import type { ReactNode } from "react";

export function TestSession({ children }: { children?: ReactNode }) {
  const session: Session = { expires: "2099-01-01", user: { id: "user-1", name: "<script>user</script>", email: "a@example.com" } };
  return <SessionProvider session={session}>{children}</SessionProvider>;
}
