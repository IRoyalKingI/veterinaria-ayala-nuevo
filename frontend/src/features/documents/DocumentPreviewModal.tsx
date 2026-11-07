import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface Props {
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

export default function DocumentPreviewModal({
  labelledBy,
  onClose,
  children,
  className = "",
}: Props) {
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const previousRootOverflow = root.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyPaddingRight = body.style.paddingRight;
    const scrollY = window.scrollY;
    const scrollbarWidth = window.innerWidth - root.clientWidth;

    root.style.overflow = "hidden";
    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      const currentPadding = Number.parseFloat(
        window.getComputedStyle(body).paddingRight,
      );
      body.style.paddingRight = `${currentPadding + scrollbarWidth}px`;
    }

    return () => {
      root.style.overflow = previousRootOverflow;
      body.style.overflow = previousBodyOverflow;
      body.style.paddingRight = previousBodyPaddingRight;
      window.scrollTo(0, scrollY);
    };
  }, []);

  return createPortal(
    <div
      className="document-modal-backdrop no-print"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-labelledby={labelledBy}
        aria-modal="true"
        className={`document-modal ${className}`.trim()}
        role="dialog"
      >
        {children}
      </section>
    </div>,
    document.body,
  );
}
