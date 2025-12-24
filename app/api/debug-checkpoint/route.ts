import { supabase } from "@/app/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const threadId = searchParams.get("threadId");

    if (!threadId) {
        return NextResponse.json({ error: "threadId is required" }, { status: 400 });
    }

    try {
        const { data, error } = await supabase
            .from("checkpoints")
            .select("*")
            .eq("thread_id", threadId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!data) {
            return NextResponse.json({ message: "No checkpoint found" });
        }

        // Return the full checkpoint structure for debugging
        return NextResponse.json({
            thread_id: data.thread_id,
            checkpoint_id: data.checkpoint_id,
            created_at: data.created_at,
            checkpoint_keys: Object.keys(data.checkpoint || {}),
            checkpoint: data.checkpoint,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
