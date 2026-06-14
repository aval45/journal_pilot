import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const ALLOWED_NEXT_PATHS = new Set([
  "/dashboard",
  "/dashboard/admin",
  "/dashboard/author",
  "/dashboard/editor",
  "/dashboard/reviewer",
]);

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  const pathname = value.split(/[?#]/, 1)[0] ?? "/dashboard";

  return ALLOWED_NEXT_PATHS.has(pathname) ? value : "/dashboard";
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = getSafeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Invalid+or+expired+link`);
}
