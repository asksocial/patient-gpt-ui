import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import WorkspaceShell from "../../components/WorkspaceShell";

export default async function WorkspacePage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  return <WorkspaceShell />;
}