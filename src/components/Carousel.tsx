import type { ReactNode } from "react";

/** 가로로 넘기는 카드 줄 (스크롤 스냅). 화면 양 끝까지 넘어가도록 좌우 여백을 상쇄한다. */
export function Carousel({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="carousel" aria-label={label}>
      {children}
    </div>
  );
}
