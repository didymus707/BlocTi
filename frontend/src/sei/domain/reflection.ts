import type { BlockId } from "./ids";

export type ReflectionId = string & { readonly __brand: "ReflectionId" };

export type ReflectionKind =
  | "end_of_block"
  | "termination_note"
  | "mid_block_note"
  | "review_note";

export type BlockReflectionEntry = {
  reflectionId: ReflectionId;
  blockId: BlockId;
  content: string;
  kind: ReflectionKind;
  createdAt: string;
  revisedAt: string | null;
  supersedesReflectionId: ReflectionId | null;
};