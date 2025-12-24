
import {
    BaseCheckpointSaver,
    Checkpoint,
    CheckpointMetadata,
    CheckpointTuple,
} from "@langchain/langgraph-checkpoint";
import { SupabaseClient } from "@supabase/supabase-js";

export class SupabaseSaver extends BaseCheckpointSaver {
    private client: SupabaseClient;
    private tableName: string;

    constructor(client: SupabaseClient, tableName: string = "checkpoints") {
        super();
        this.client = client;
        this.tableName = tableName;
    }

    // langgraph-checkpoint ^1.0.0 uses getTuple instead of get
    async getTuple(config: any): Promise<CheckpointTuple | undefined> {
        const thread_id = config.configurable?.thread_id;
        const checkpoint_id = config.configurable?.checkpoint_id;

        if (!thread_id) {
            console.log("[SupabaseSaver] No thread_id provided in config");
            return undefined;
        }

        let query = this.client
            .from(this.tableName)
            .select("*")
            .eq("thread_id", thread_id);

        if (checkpoint_id) {
            query = query.eq("checkpoint_id", checkpoint_id);
        } else {
            query = query.order("created_at", { ascending: false }).limit(1);
        }

        const { data, error } = await query.maybeSingle();

        if (error) {
            console.error("[SupabaseSaver] Error fetching checkpoint:", error);
            return undefined;
        }

        if (!data) {
            console.log(`[SupabaseSaver] No checkpoint found for thread ${thread_id}`);
            return undefined;
        }

        console.log(`[SupabaseSaver] Loaded checkpoint for thread ${thread_id}, id: ${data.checkpoint_id}`);

        return {
            config: {
                configurable: {
                    thread_id: data.thread_id,
                    checkpoint_id: data.checkpoint_id,
                },
            },
            checkpoint: data.checkpoint as Checkpoint,
            metadata: data.metadata as CheckpointMetadata,
            parentConfig: data.parent_id
                ? {
                    configurable: {
                        thread_id: data.thread_id,
                        checkpoint_id: data.parent_id,
                    },
                }
                : undefined,
        };
    }

    async *list(
        config: any,
        options?: { before?: any; limit?: number }
    ): AsyncGenerator<CheckpointTuple> {
        const thread_id = config.configurable?.thread_id;
        if (!thread_id) return;

        let query = this.client
            .from(this.tableName)
            .select("*")
            .eq("thread_id", thread_id)
            .order("created_at", { ascending: false });

        if (options?.limit) {
            query = query.limit(options.limit);
        }

        const { data, error } = await query;

        if (error || !data) return;

        for (const row of data) {
            yield {
                config: {
                    configurable: {
                        thread_id: row.thread_id,
                        checkpoint_id: row.checkpoint_id,
                    },
                },
                checkpoint: row.checkpoint as Checkpoint,
                metadata: row.metadata as CheckpointMetadata,
                parentConfig: row.parent_id
                    ? {
                        configurable: {
                            thread_id: row.thread_id,
                            checkpoint_id: row.parent_id,
                        },
                    }
                    : undefined,
            };
        }
    }

    async put(
        config: any,
        checkpoint: Checkpoint,
        metadata: CheckpointMetadata
    ): Promise<any> {
        const thread_id = config.configurable?.thread_id;
        const checkpoint_id = checkpoint.id;

        if (!thread_id) throw new Error("thread_id is required");

        console.log(`[SupabaseSaver] Saving checkpoint for thread ${thread_id}, id: ${checkpoint_id}`);

        const { error } = await this.client.from(this.tableName).upsert(
            {
                thread_id,
                checkpoint_id,
                checkpoint,
                metadata,
                parent_id: config.configurable?.checkpoint_id,
            },
            { onConflict: "thread_id, checkpoint_id" }
        );

        if (error) {
            console.error("[SupabaseSaver] Error saving checkpoint:", error);
            throw error;
        }

        return {
            configurable: {
                thread_id,
                checkpoint_id,
            },
        };
    }

    async putWrites(
        _config: any,
        _writes: any[],
        _taskId: string
    ): Promise<void> {
        // Basic persistence doesn't strictly require granular write tracking
    }

    // Required by some versions
    async deleteThread(thread_id: string): Promise<void> {
        await this.client.from(this.tableName).delete().eq("thread_id", thread_id);
    }
}
