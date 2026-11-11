import type { Verdict } from "../sei/domain/conformance";
import { VERDICT_LABEL } from "../sei/view/explain";
import { CheckIcon, CloseIcon } from "./icons";

const STYLE: Record<Verdict, string> = {
  followed: "bg-sunken text-ink-2",
  minor_deviations: "border border-line-strong text-ink-2",
  major_deviations: "border border-over text-over",
  not_followed: "bg-over text-white",
};

// The verdict in words. Like the status chips, it never rides on colour alone.
export const VerdictChip = ({ verdict, testId }: { verdict: Verdict; testId?: string }) => (
  <span
    data-testid={testId}
    className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] text-xs font-semibold ${STYLE[verdict]}`}
  >
    {verdict === "followed" && <CheckIcon size={12} strokeWidth={3} />}
    {verdict === "not_followed" && <CloseIcon size={12} strokeWidth={3} />}
    {VERDICT_LABEL[verdict]}
  </span>
);
