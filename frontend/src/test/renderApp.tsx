import { act, render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AppRoutes } from "../components/AppRoutes";
import { BlockUIProvider } from "../context/BlockUIProvider";
import { SeiSessionProvider } from "../sei/session/SeiSessionProvider";
import { SeiProvider } from "../sei/store/SeiProvider";
import { createLocalPersistence, type SeiPersistence } from "../sei/store/persistence";

// a clock the test moves by hand; the provider polls it every few ms
export const createTestClock = (startIso = "2026-11-08T09:00:00.000Z") => {
  let ms = Date.parse(startIso);
  return {
    now: () => new Date(ms).toISOString(),
    advance: (seconds: number) => {
      ms += seconds * 1000;
    },
  };
};

export const renderApp = ({
  persistence = createLocalPersistence(),
  clock = createTestClock(),
  route = "/",
}: {
  persistence?: SeiPersistence;
  clock?: ReturnType<typeof createTestClock>;
  route?: string;
} = {}) => {
  const utils = render(
    <MemoryRouter initialEntries={[route]}>
      <SeiProvider persistence={persistence}>
        <SeiSessionProvider clock={clock.now} tickMs={10}>
          <BlockUIProvider>
            <AppRoutes />
          </BlockUIProvider>
        </SeiSessionProvider>
      </SeiProvider>
    </MemoryRouter>,
  );
  return { ...utils, clock, persistence };
};

// let pending promises (store load, outbox flush) settle
export const settle = () => act(async () => {});
