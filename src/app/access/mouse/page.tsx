import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { listDevices, listRoutines } from "../../actions";
import MouseClient from "./client";

export default async function MousePage() {
  const user = await currentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const devices = await listDevices({ clerkUserId: user.id });
  const routines = await listRoutines({ clerkUserId: user.id });

  return (
    <MouseClient
      clerkUserId={user.id}
      initialDevices={devices ?? []}
      initialRoutines={(routines ?? []) as any}
    />
  );
}

