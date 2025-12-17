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
  inputMode = "mouse",
}: {
  clerkUserId: string;
  email?: string | null;
  role?: string;
  inputMode?: string;
}) {
  const supabase = await getSupabaseServer();

  // inputMode 값 검증 및 기본값 설정
  const validInputModes = ["eye", "mouse", "switch", "voice"] as const;
  const validatedInputMode = inputMode && validInputModes.includes(inputMode as any)
    ? inputMode
    : "mouse";

  console.log("[action] syncUser start", { clerkUserId, role, inputMode: validatedInputMode });

  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("users")
      .update({ email, role, input_mode: validatedInputMode })
      .eq("id", existing.id);

    if (error) {
      console.error("[action] syncUser update 실패", error);
      // CHECK constraint 위반 시 기본값으로 재시도
      if (error.code === "23514") {
        console.warn("[action] syncUser CHECK constraint 위반, 기본값으로 재시도");
        const { error: retryError } = await supabase
          .from("users")
          .update({ email, role, input_mode: "mouse" })
          .eq("id", existing.id);
        if (retryError) {
          console.error("[action] syncUser 재시도 실패", retryError);
          throw retryError;
        }
        console.log("[action] syncUser updated (기본값 사용)", { id: existing.id });
        return existing.id;
      }
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
      input_mode: validatedInputMode,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[action] syncUser insert 실패", error);
    // CHECK constraint 위반 시 기본값으로 재시도
    if (error.code === "23514") {
      console.warn("[action] syncUser CHECK constraint 위반, 기본값으로 재시도");
      const { data: retryData, error: retryError } = await supabase
        .from("users")
        .insert({
          clerk_user_id: clerkUserId,
          email: email ?? null,
          role,
          input_mode: "mouse",
        })
        .select("id")
        .single();
      if (retryError) {
        console.error("[action] syncUser 재시도 실패", retryError);
        throw retryError;
      }
      console.log("[action] syncUser created (기본값 사용)", { id: retryData.id });
      return retryData.id;
    }
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
    // CHECK constraint 위반은 무시하고 null 반환 (syncUser에서 처리)
    if (error.code === "23514") {
      console.warn("[action] getUserIdByClerkId CHECK constraint 위반, null 반환");
      return null;
    }
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
    // CHECK constraint 위반은 null 반환 (기본값 사용)
    if (error.code === "23514") {
      console.warn("[action] getUserInfo CHECK constraint 위반, null 반환");
      return null;
    }
    throw error;
  }

  return data;
}

export async function updateInputMode({
  clerkUserId,
  inputMode,
}: {
  clerkUserId: string;
  inputMode: "eye" | "mouse" | "switch" | "voice";
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
    try {
      userId = await syncUser({ clerkUserId, email: null });
    } catch (error: any) {
      // syncUser 실패 시에도 계속 진행 (기기 저장은 나중에 가능)
      console.error("[action] saveDevice syncUser 실패, 사용자 없이 진행", error);
      // 사용자가 없으면 기기를 저장할 수 없으므로 에러 throw
      throw new Error("사용자를 생성할 수 없습니다. 데이터베이스 마이그레이션을 확인해주세요.");
    }
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

export async function updateDevicePosition({
  deviceId,
  position,
}: {
  deviceId: string;
  position: { x: number; y: number; z: number };
}) {
  const supabase = await getSupabaseServer();
  console.log("[action] updateDevicePosition", { deviceId, position });

  const { error } = await supabase
    .from("devices")
    .update({
      position_x: position.x,
      position_y: position.y,
      position_z: position.z,
    })
    .eq("id", deviceId);

  if (error) {
    console.error("[action] updateDevicePosition 실패", error);
    throw error;
  }

  revalidatePath("/admin");
  revalidatePath("/access");
  console.log("[action] updateDevicePosition 성공", { deviceId, position });
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

// ================================================================
// 루틴 관련 서버 액션
// ================================================================

export async function listRoutines({ clerkUserId }: { clerkUserId: string }) {
  const supabase = await getSupabaseServer();
  console.log("[action] listRoutines", { clerkUserId });

  const userId = await getUserIdByClerkId(supabase, clerkUserId);
  if (!userId) {
    console.warn("[action] listRoutines 사용자 없음", { clerkUserId });
    return [];
  }

  const { data, error } = await supabase
    .from("routines")
    .select(
      `
      *,
      routine_devices (
        id,
        device_id,
        target_state,
        order_index,
        devices (
          id,
          name,
          icon_type
        )
      )
    `
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[action] listRoutines 실패", error);
    throw error;
  }

  console.log("[action] listRoutines 성공", { count: data?.length ?? 0 });
  return data ?? [];
}

export async function createRoutine({
  clerkUserId,
  name,
  timeType,
  devices,
}: {
  clerkUserId: string;
  name: string;
  timeType: "morning" | "evening" | "custom";
  devices: Array<{ deviceId: string; targetState: boolean; orderIndex: number }>;
}) {
  const supabase = await getSupabaseServer();
  console.log("[action] createRoutine start", { clerkUserId, name, timeType, deviceCount: devices.length });

  const userId = await getUserIdByClerkId(supabase, clerkUserId);
  if (!userId) {
    throw new Error("사용자를 찾을 수 없습니다.");
  }

  // 루틴 생성
  const { data: routine, error: routineError } = await supabase
    .from("routines")
    .insert({
      user_id: userId,
      name,
      time_type: timeType,
    })
    .select("id")
    .single();

  if (routineError) {
    console.error("[action] createRoutine 루틴 생성 실패", routineError);
    throw routineError;
  }

  // 루틴 기기 추가
  if (devices.length > 0) {
    const routineDevices = devices.map((d) => ({
      routine_id: routine.id,
      device_id: d.deviceId,
      target_state: d.targetState,
      order_index: d.orderIndex,
    }));

    const { error: devicesError } = await supabase
      .from("routine_devices")
      .insert(routineDevices);

    if (devicesError) {
      console.error("[action] createRoutine 루틴 기기 추가 실패", devicesError);
      // 루틴은 생성되었지만 기기 추가 실패 시 루틴 삭제
      await supabase.from("routines").delete().eq("id", routine.id);
      throw devicesError;
    }
  }

  revalidatePath("/admin");
  revalidatePath("/access");
  console.log("[action] createRoutine success", { routineId: routine.id });
  return routine.id;
}

export async function updateRoutine({
  routineId,
  name,
  timeType,
  devices,
}: {
  routineId: string;
  name?: string;
  timeType?: "morning" | "evening" | "custom";
  devices?: Array<{ deviceId: string; targetState: boolean; orderIndex: number }>;
}) {
  const supabase = await getSupabaseServer();
  console.log("[action] updateRoutine start", { routineId, name, timeType, deviceCount: devices?.length ?? 0 });

  // 루틴 정보 업데이트
  if (name || timeType) {
    const updateData: { name?: string; time_type?: string } = {};
    if (name) updateData.name = name;
    if (timeType) updateData.time_type = timeType;

    const { error } = await supabase
      .from("routines")
      .update(updateData)
      .eq("id", routineId);

    if (error) {
      console.error("[action] updateRoutine 루틴 업데이트 실패", error);
      throw error;
    }
  }

  // 루틴 기기 업데이트 (기존 기기 삭제 후 재생성)
  if (devices !== undefined) {
    // 기존 기기 삭제
    const { error: deleteError } = await supabase
      .from("routine_devices")
      .delete()
      .eq("routine_id", routineId);

    if (deleteError) {
      console.error("[action] updateRoutine 기존 기기 삭제 실패", deleteError);
      throw deleteError;
    }

    // 새 기기 추가
    if (devices.length > 0) {
      const routineDevices = devices.map((d) => ({
        routine_id: routineId,
        device_id: d.deviceId,
        target_state: d.targetState,
        order_index: d.orderIndex,
      }));

      const { error: insertError } = await supabase
        .from("routine_devices")
        .insert(routineDevices);

      if (insertError) {
        console.error("[action] updateRoutine 새 기기 추가 실패", insertError);
        throw insertError;
      }
    }
  }

  revalidatePath("/admin");
  revalidatePath("/access");
  console.log("[action] updateRoutine success", { routineId });
}

export async function deleteRoutine({ routineId }: { routineId: string }) {
  const supabase = await getSupabaseServer();
  console.log("[action] deleteRoutine", { routineId });

  // CASCADE DELETE로 routine_devices도 자동 삭제됨
  const { error } = await supabase.from("routines").delete().eq("id", routineId);

  if (error) {
    console.error("[action] deleteRoutine 실패", error);
    throw error;
  }

  revalidatePath("/admin");
  revalidatePath("/access");
  console.log("[action] deleteRoutine 성공", { routineId });
}

export async function executeRoutine({ routineId }: { routineId: string }) {
  const supabase = await getSupabaseServer();
  console.log("[action] executeRoutine start", { routineId });

  // 루틴의 기기 목록 조회 (순서대로)
  const { data: routineDevices, error: fetchError } = await supabase
    .from("routine_devices")
    .select("device_id, target_state, order_index")
    .eq("routine_id", routineId)
    .order("order_index", { ascending: true });

  if (fetchError) {
    console.error("[action] executeRoutine 루틴 기기 조회 실패", fetchError);
    throw fetchError;
  }

  if (!routineDevices || routineDevices.length === 0) {
    console.warn("[action] executeRoutine 루틴에 기기가 없음", { routineId });
    return;
  }

  // 순차적으로 기기 상태 변경
  for (const rd of routineDevices) {
    const { error } = await supabase
      .from("devices")
      .update({ is_active: rd.target_state })
      .eq("id", rd.device_id);

    if (error) {
      console.error("[action] executeRoutine 기기 상태 변경 실패", {
        deviceId: rd.device_id,
        targetState: rd.target_state,
        error,
      });
      // 하나라도 실패하면 계속 진행하되 로그만 남김
    } else {
      console.log("[action] executeRoutine 기기 상태 변경 성공", {
        deviceId: rd.device_id,
        targetState: rd.target_state,
        orderIndex: rd.order_index,
      });
    }

    // 순차 실행을 위한 짧은 지연 (100ms)
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  revalidatePath("/admin");
  revalidatePath("/access");
  console.log("[action] executeRoutine success", {
    routineId,
    deviceCount: routineDevices.length,
  });
}

