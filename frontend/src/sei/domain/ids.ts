type Brand<K, T> = K & { __brand: T };

export type TaskId = Brand<string, "TaskId">;
export type UserId = Brand<string, "UserId">;
export type BlockId = Brand<string, "BlockId">;
export type EventId = Brand<string, "EventId">;
export type SessionId = Brand<string, "SessionId">;
