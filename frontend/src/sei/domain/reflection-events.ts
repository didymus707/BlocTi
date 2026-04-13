import type { BlockId } from "./ids";
import type { ReflectionId, ReflectionKind } from "./reflection";

export type ReflectionEvent =
  | {
      seq: number;
      type: "ReflectionAdded";
      reflectionId: ReflectionId;
      blockId: BlockId;
      occurredAt: string;
      content: string;
      kind: ReflectionKind;
    }
  | {
      seq: number;
      type: "ReflectionRevised";
      reflectionId: ReflectionId;
      blockId: BlockId;
      occurredAt: string;
      newContent: string;
      kind: ReflectionKind;
      supersedesReflectionId: ReflectionId;
    };
