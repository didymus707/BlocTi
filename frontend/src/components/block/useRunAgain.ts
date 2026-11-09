import { useNavigate } from "react-router";
import type { BlockView } from "../../sei/session/seiSessionContext";
import { useSeiSession } from "../../sei/session/seiSessionContext";
import { duplicatePlan } from "../../sei/store/planDraft";
import { useSeiStore } from "../../sei/store/seiStoreContext";

// a finished block's history is immutable, so "run again" copies its plan
export const useRunAgain = (view: BlockView) => {
  const navigate = useNavigate();
  const { savePlan, generateId } = useSeiStore();
  const { clock } = useSeiSession();
  return () => {
    const copy = duplicatePlan(view.block, view.tasks, generateId, clock());
    savePlan(copy.block, copy.tasks);
    navigate(`/block/${copy.block.id}`);
  };
};
