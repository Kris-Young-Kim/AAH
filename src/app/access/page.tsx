import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { listDevices, getUserInfo, listRoutines } from "../actions";
import AccessClient from "./client";

export default async function AccessPage() {
  const user = await currentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const devices = await listDevices({ clerkUserId: user.id });
  const userInfo = await getUserInfo({ clerkUserId: user.id });
  const routines = await listRoutines({ clerkUserId: user.id });

  return (
    <AccessClient
      clerkUserId={user.id}
      initialDevices={devices ?? []}
      inputMode={(userInfo?.input_mode as "eye" | "mouse" | "switch") || "mouse"}
      initialRoutines={routines ?? []}
    />
  );
}

