import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { listDevices, getUserInfo, listRoutines } from "../actions";
import AdminClient from "./client";

export default async function AdminPage() {
  const user = await currentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const devices = await listDevices({ clerkUserId: user.id });
  const userInfo = await getUserInfo({ clerkUserId: user.id });
  const routines = await listRoutines({ clerkUserId: user.id });

  return (
    <AdminClient
      clerkUserId={user.id}
      initialDevices={devices ?? []}
      currentInputMode={(userInfo?.input_mode as "eye" | "mouse" | "switch" | "voice") || "mouse"}
      initialRoutines={(routines ?? []) as any}
    />
  );
}

