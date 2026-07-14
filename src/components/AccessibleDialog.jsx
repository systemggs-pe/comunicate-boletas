import React, {useEffect, useId, useRef} from 'react';
import {createPortal} from 'react-dom';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function AccessibleDialog({
  title,
  description,
  onClose,
  children,
  backdropClassName = '',
  panelClassName = '',
  closeOnBackdrop = true,
}) {
  const generatedId = useId();
  const titleId = `${generatedId}-title`;
  const descriptionId = description ? `${generatedId}-description` : undefined;
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const root = document.getElementById('root');
    const previousOverflow = document.body.style.overflow;
    const rootWasInert = root?.hasAttribute('inert');
    const previousAriaHidden = root?.getAttribute('aria-hidden');

    document.body.style.overflow = 'hidden';
    root?.setAttribute('inert', '');
    root?.setAttribute('aria-hidden', 'true');

    const focusTimer = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      const preferred = panel?.querySelector('[data-dialog-autofocus]');
      const first = panel?.querySelector(FOCUSABLE);
      (preferred || first || panel)?.focus();
    });

    const onKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      const focusable = panel ? Array.from(panel.querySelectorAll(FOCUSABLE)) : [];
      if (!focusable.length) {
        event.preventDefault();
        panel?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (!rootWasInert) root?.removeAttribute('inert');
      if (previousAriaHidden == null) root?.removeAttribute('aria-hidden');
      else root?.setAttribute('aria-hidden', previousAriaHidden);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

  const dialog = (
    <div
      className={`saas-modal-backdrop ${backdropClassName}`.trim()}
      onMouseDown={event => {
        if (closeOnBackdrop && event.target === event.currentTarget) closeRef.current?.();
      }}
    >
      <section
        ref={panelRef}
        className={`saas-detail-modal ${panelClassName}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <div className="dialog-heading">
          <h2 id={titleId}>{title}</h2>
          {description && <p id={descriptionId}>{description}</p>}
        </div>
        {children}
      </section>
    </div>
  );

  return createPortal(dialog, document.body);
}
