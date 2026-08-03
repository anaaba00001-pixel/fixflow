import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

export default function Modal({
  open,
  onClose,
  title,
  description = "",
  children,
  footer = null,
  closeOnBackdrop = true,
  closeOnEscape = true,
  showCloseButton = true,
  className = "",
}) {
  const titleId = useId();
  const descriptionId = useId();
  const modalRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement;

    document.body.style.overflow = "hidden";

    requestAnimationFrame(() => {
      modalRef.current?.focus();
    });

    function handleKeyDown(event) {
      if (event.key === "Escape" && closeOnEscape) {
        onClose?.();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);

      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      }
    };
  }, [open, closeOnEscape, onClose]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  function handleBackdropClick(event) {
    if (
      closeOnBackdrop &&
      event.target === event.currentTarget
    ) {
      onClose?.();
    }
  }

  const modalClassName = ["create-modal", className]
    .filter(Boolean)
    .join(" ");

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={handleBackdropClick}
      role="presentation"
    >
      <section
        ref={modalRef}
        className={modalClassName}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        {showCloseButton ? (
          <button
            type="button"
            className="close"
            onClick={onClose}
            aria-label="إغلاق النافذة"
          >
            ×
          </button>
        ) : null}

        {title ? <h2 id={titleId}>{title}</h2> : null}

        {description ? (
          <p id={descriptionId}>{description}</p>
        ) : null}

        <div>{children}</div>

        {footer ? (
          <div className="modal-buttons">{footer}</div>
        ) : null}
      </section>
    </div>,
    document.body
  );
}
