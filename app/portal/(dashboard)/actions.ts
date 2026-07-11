"use server";

import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";

// Sign the client contact out and return them to the portal login.
export async function signOut() {
  const supabase = createSessionClient();
  await supabase.auth.signOut();
  redirect("/portal/login");
}
