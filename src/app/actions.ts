"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/database.types";

type SupabaseClient = ReturnType<typeof createServerClient<Database>>;

async function getSupabaseServer(): Promise<SupabaseClient> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("[supabase] 환경 변수 누락", {
      hasUrl: Boolean(supabaseUrl),
      hasKey: Boolean(supabaseKey),
    });
    throw new Error("Supabase 환경 변수가 설정되지 않았습니다.");
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      async getAll() {
        return cookieStore.getAll();
      },
      async setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch (error) {
          console.warn("[supabase] 쿠키 설정 실패 (server component 가능성)", error);
        }
      },
    },
  });
}

export async function syncUser({
  clerkUserId,
  email,
  role = "user",
  inputMode = "eye",
}: {
  clerkUserId: string;
  email?: string | null;
  role?: string;
  inputMode?: string;
}) {
  const supabase = await getSupabaseServer();

  console.log("[action] syncUser start", { clerkUserId, role, inputMode });

  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("users")
      .update({ email, role, input_mode: inputMode })
      .eq("id", existing.id);

    if (error) {
      console.error("[action] syncUser update 실패", error);
      throw error;
    }

    console.log("[action] syncUser updated", { id: existing.id });
    return existing.id;
  }

  const { data, error } = await supabase
    .from("users")
    .insert({
      clerk_user_id: clerkUserId,
      email: email ?? null,
      role,
      input_mode: inputMode,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[action] syncUser insert 실패", error);
    throw error;
  }

  console.log("[action] syncUser created", { id: data.id });
  return data.id;
}

async function getUserIdByClerkId(
  supabase: SupabaseClient,
  clerkUserId: string
) {
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();

  if (error) {
    console.error("[action] 사용자 조회 실패", error);
    throw error;
  }
  return data?.id ?? null;
}

export async function getUserInfo({ clerkUserId }: { clerkUserId: string }) {
  const supabase = await getSupabaseServer();
  console.log("[action] getUserInfo", { clerkUserId });

  const { data, error } = await supabase
    .from("users")
    .select("id, role, input_mode")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();

  if (error) {
    console.error("[action] getUserInfo 실패", error);
    throw error;
  }

  return data;
}

export async function updateInputMode({
  clerkUserId,
  inputMode,
}: {
  clerkUserId: string;
  inputMode: "eye" | "mouse" | "switch";
}) {
  const supabase = await getSupabaseServer();
  console.log("[action] updateInputMode", { clerkUserId, inputMode });

  const userId = await getUserIdByClerkId(supabase, clerkUserId);
  if (!userId) {
    throw new Error("사용자를 찾을 수 없습니다.");
  }

  const { error } = await supabase
    .from("users")
    .update({ input_mode: inputMode })
    .eq("id", userId);

  if (error) {
    console.error("[action] updateInputMode 실패", error);
    throw error;
  }

  revalidatePath("/admin");
  revalidatePath("/access");
  console.log("[action] updateInputMode 성공", { userId, inputMode });
}

export async function listDevices({ clerkUserId }: { clerkUserId: string }) {
  const supabase = await getSupabaseServer();
  console.log("[action] listDevices", { clerkUserId });

  const userId = await getUserIdByClerkId(supabase, clerkUserId);
  if (!userId) {
    console.warn("[action] listDevices 사용자 없음", { clerkUserId });
    return [];
  }

  const { data, error } = await supabase
    .from("devices")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[action] listDevices 실패", error);
    throw error;
  }

  return data ?? [];
}

export async function saveDevice({
  clerkUserId,
  name,
  iconType,
  position,
}: {
  clerkUserId: string;
  name: string;
  iconType: string;
  position: { x: number; y: number; z: number };
}) {
  const supabase = await getSupabaseServer();
  console.log("[action] saveDevice start", { clerkUserId, name, iconType, position });

  let userId = await getUserIdByClerkId(supabase, clerkUserId);
  if (!userId) {
    userId = await syncUser({ clerkUserId, email: null });
  }

  const { error } = await supabase.from("devices").insert({
    name,
    icon_type: iconType,
    user_id: userId,
    position_x: position.x,
    position_y: position.y,
    position_z: position.z,
    is_active: false,
  });

  if (error) {
    console.error("[action] saveDevice 실패", error);
    throw error;
  }

  revalidatePath("/admin");
  console.log("[action] saveDevice success");
}

export async function toggleDeviceStatus({
  deviceId,
  isActive,
}: {
  deviceId: string;
  isActive: boolean;
}) {
  const supabase = await getSupabaseServer();
  console.log("[action] toggleDeviceStatus", { deviceId, isActive });

  const { error } = await supabase
    .from("devices")
    .update({ is_active: isActive })
    .eq("id", deviceId);

  if (error) {
    console.error("[action] toggleDeviceStatus 실패", error);
    throw error;
  }

  revalidatePath("/admin");
  revalidatePath("/access");
  console.log("[action] toggleDeviceStatus 성공", { deviceId, isActive });
}

export async function deleteDevice({ deviceId }: { deviceId: string }) {
  const supabase = await getSupabaseServer();
  console.log("[action] deleteDevice", { deviceId });

  const { error } = await supabase.from("devices").delete().eq("id", deviceId);

  if (error) {
    console.error("[action] deleteDevice 실패", error);
    throw error;
  }

  revalidatePath("/admin");
  revalidatePath("/access");
  console.log("[action] deleteDevice 성공", { deviceId });
}

