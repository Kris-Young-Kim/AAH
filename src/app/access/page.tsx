import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { listDevices } from "../actions";
import AccessClient from "./client";

export default async function AccessPage() {
  const user = await currentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const devices = await listDevices({ clerkUserId: user.id });

  return (
    <AccessClient clerkUserId={user.id} initialDevices={devices ?? []} />
  );
}

