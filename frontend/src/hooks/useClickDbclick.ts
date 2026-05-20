import { useRef } from "react";

type ClickHandler = (...args: any[]) => void;

export function useClickDblClick(onClick: ClickHandler, onDblClick: ClickHandler, delay = 300) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = (...args: any[]) => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      onDblClick(...args);
    } else {
      timer.current = setTimeout(() => {
        onClick(...args);
        timer.current = null;
      }, delay);
    }
  };

  return handleClick;
}
