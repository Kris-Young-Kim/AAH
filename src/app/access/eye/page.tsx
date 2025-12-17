import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { listDevices, listRoutines } from "../../actions";
import EyeClient from "./client";

export default async function EyePage() {
  const user = await currentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const devices = await listDevices({ clerkUserId: user.id });
  const routines = await listRoutines({ clerkUserId: user.id });

  return (
    <EyeClient
      clerkUserId={user.id}
      initialDevices={devices ?? []}
      initialRoutines={(routines ?? []) as any}
    />
  );
}

