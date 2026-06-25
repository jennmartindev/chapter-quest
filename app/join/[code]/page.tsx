import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function JoinPage({ params }: { params: { code: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: cid, error } = await supabase.rpc("join_challenge", { invite: params.code });

  if (error || !cid) {
    return (
      <div className="auth-wrap" data-theme="sage">
        <div className="auth-card confirm">
          <h1>Invite not found</h1>
          <p>That share link looks invalid or expired. Ask for a fresh one.</p>
          <div className="actions"><Link className="submit" href="/">Go home</Link></div>
        </div>
      </div>
    );
  }

  const { data: ch } = await supabase.from("challenges").select("template_key").eq("id", cid).single();
  redirect(`/boards?c=${ch?.template_key ?? ""}`);
}
