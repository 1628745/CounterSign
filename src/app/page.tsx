import { redirect } from "next/navigation";
import { MissionControlApp } from "@/components/mission-control/mission-control-app";
import { getSession } from "@/lib/auth0/session";

export default async function Home() {
  const session = await getSession();
  if (!session) {
    redirect("/auth/login");
  }

  return <MissionControlApp userName={session.user.name ?? session.user.email ?? "You"} />;
}
