'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="dialog" onClick={e => e.stopPropagation()} role="alertdialog" aria-modal="true">
        <div className="icon-wrap" data-danger={danger}>
          <AlertTriangle size={22} />
        </div>
        <h2 className="title">{title}</h2>
        <p className="message">{message}</p>
        <div className="actions">
          <button className="btn-cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className={danger ? 'btn-confirm danger' : 'btn-confirm'}
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>

      <style jsx>{`
        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 20px;
          animation: fadeIn 0.15s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .dialog {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 28px 24px 24px;
          width: 100%;
          max-width: min(360px, 90vw);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.25);
          animation: scaleIn 0.15s ease;
        }

        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        .icon-wrap {
          width: 52px;
          height: 52px;
          border-radius: 16px;
          background: color-mix(in srgb, var(--primary) 12%, transparent);
          color: var(--primary);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 4px;
        }

        .icon-wrap[data-danger='true'] {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }

        .title {
          font-size: 17px;
          font-weight: 700;
          color: var(--foreground);
          text-align: center;
          margin: 0;
        }

        .message {
          font-size: 14px;
          color: var(--muted-foreground);
          text-align: center;
          margin: 0;
          line-height: 1.55;
        }

        .actions {
          display: flex;
          gap: 10px;
          width: 100%;
          margin-top: 8px;
        }

        .btn-cancel, .btn-confirm {
          flex: 1;
          padding: 13px 18px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }

        .btn-cancel {
          background: var(--muted);
          border: 1px solid var(--border);
          color: var(--foreground);
        }
        .btn-cancel:hover { background: var(--border); }

        .btn-confirm {
          background: var(--primary);
          border: none;
          color: white;
        }
        .btn-confirm:hover { opacity: 0.88; }

        .btn-confirm.danger {
          background: #ef4444;
        }
        .btn-confirm.danger:hover { background: #dc2626; }
      `}</style>
    </div>
  );
}

export default ConfirmDialog;
