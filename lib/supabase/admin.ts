// Service role client — RLS bypass. 백엔드 전용.
// publish 완료 후 Storage 객체 삭제 등에 사용.

import { createClient as createSbClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createSbClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
