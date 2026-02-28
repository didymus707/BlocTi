import React, { useState } from "react";

export const Timer = () => {
  const [taskName, setTaskName] = useState<string>("");
  const [eventDate, setEventDate] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isActive, setIsActive] = useState<boolean>(false);

  React.useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (isActive) {
      timer = setInterval(() => {
        const now = new Date().getTime();
        const eventTime = new Date(eventDate).getTime();
        const distance = eventTime - now;

        if (distance < 0) {
          clearInterval(timer);
          setIsActive(false);
          setTimeLeft("Event has passed");
          return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor(
          (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
        );
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
      }, 1000);
    }

    return () => clearInterval(timer);
  }, [isActive, eventDate]);

  const startTimer = () => {
    if (taskName && eventDate) {
      setIsActive(true);
    }
  };

  return (
    <>
      <div className="timer-container">
        
      </div>
    </>
  );
};
