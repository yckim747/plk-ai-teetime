import { useEffect, useRef, type ReactNode } from "react";
import { CloseIcon } from "../icons";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** 화면 아래에서 올라오는 시트 (PC에서는 가운데 창). 배경·✕·ESC로 닫는다. */
export function Sheet({ title, onClose, children }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" aria-hidden />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button ref={closeRef} type="button" className="icon-btn" onClick={onClose} aria-label="닫기">
            <CloseIcon />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
