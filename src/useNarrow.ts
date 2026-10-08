import { useSyncExternalStore } from "react";

/** 결과가 채팅 아래로 내려가는 좁은 화면(휴대폰)인지. style.css의 860px 기준과 같다. */
const QUERY = "(max-width: 860px)";

export function useNarrow(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(QUERY);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(QUERY).matches,
  );
}
