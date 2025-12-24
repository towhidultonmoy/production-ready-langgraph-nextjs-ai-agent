import { supabase } from "@/app/lib/supabase";
import { NextResponse } from "next/server";
import crypto from "crypto";

export async function GET() {
    try {
        const { data, error } = await supabase
            .from("sessions")
            .select("*")
            .order("updated_at", { ascending: false });

        if (error) throw error;
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { threadId, title } = await request.json();

        // If no threadId provided, we are creating a new one
        const id = threadId || `sid-${crypto.randomUUID()}`;

        const { data, error } = await supabase
            .from("sessions")
            .upsert({
                thread_id: id,
                title: title || "New Conversation",
                updated_at: new Date().toISOString(),
            }, { onConflict: "thread_id" })
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const threadId = searchParams.get("threadId");

    if (!threadId) {
        return NextResponse.json({ error: "threadId is required" }, { status: 400 });
    }

    try {
        // Delete session
        await supabase.from("sessions").delete().eq("thread_id", threadId);

        // Delete checkpoints (cascading cleanup if not handled by DB)
        await supabase.from("checkpoints").delete().eq("thread_id", threadId);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
