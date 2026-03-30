'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Settings, LogOut, AlertTriangle } from 'lucide-react';

export function UserMenu() {
  const router = useRouter();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirming(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!session?.user) return null;

  const { user } = session;

  const toggle = () => {
    setOpen(v => !v);
    setConfirming(false);
  };

  return (
    <div className="wrap" ref={ref}>
      <button className="avatar-btn" onClick={toggle} aria-label="Account menu">
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt={user.name ?? 'User'}
            className="avatar"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="avatar-fallback">{user.name?.[0]?.toUpperCase() ?? 'U'}</div>
        )}
      </button>

      {open && (
        <div className="popover" role="menu">
          {/* User info */}
          <div className="popover-user">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt=""
                className="popover-avatar"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="popover-avatar-fallback">{user.name?.[0]?.toUpperCase() ?? 'U'}</div>
            )}
            <div className="popover-user-info">
              <span className="popover-name">{user.name ?? 'User'}</span>
              <span className="popover-email">{user.email}</span>
            </div>
          </div>

          <div className="divider" />

          {/* Settings */}
          <button
            className="popover-row"
            onClick={() => { setOpen(false); router.push('/settings'); }}
          >
            <Settings size={15} />
            Settings
          </button>

          {/* Sign out — inline confirmation */}
          {!confirming ? (
            <button className="popover-row danger" onClick={() => setConfirming(true)}>
              <LogOut size={15} />
              Sign out
            </button>
          ) : (
            <div className="confirm-row">
              <span className="confirm-label">
                <AlertTriangle size={13} />
                Sign out?
              </span>
              <div className="confirm-btns">
                <button className="confirm-cancel" onClick={() => setConfirming(false)}>
                  Cancel
                </button>
                <button
                  className="confirm-ok"
                  onClick={() => signOut({ callbackUrl: '/sign-in' })}
                >
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .wrap {
          position: relative;
        }

        .avatar-btn {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          border: 2px solid var(--border);
          padding: 0;
          background: none;
          cursor: pointer;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: border-color 0.15s;
        }
        .avatar-btn:hover { border-color: var(--primary); }

        .avatar {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .avatar-fallback {
          width: 100%;
          height: 100%;
          background: var(--primary);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 700;
        }

        /* Popover */
        .popover {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          width: 220px;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 14px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.16);
          overflow: hidden;
          z-index: 200;
        }

        .popover-user {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 14px 12px;
        }

        .popover-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          object-fit: cover;
          flex-shrink: 0;
          border: 1.5px solid var(--border);
        }

        .popover-avatar-fallback {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: var(--primary);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
          font-weight: 700;
          flex-shrink: 0;
        }

        .popover-user-info {
          display: flex;
          flex-direction: column;
          gap: 1px;
          min-width: 0;
        }

        .popover-name {
          font-size: 13px;
          font-weight: 700;
          color: var(--foreground);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .popover-email {
          font-size: 11px;
          color: var(--muted-foreground);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .divider {
          height: 1px;
          background: var(--border);
          margin: 0;
        }

        .popover-row {
          display: flex;
          align-items: center;
          gap: 9px;
          width: 100%;
          padding: 11px 14px;
          background: none;
          border: none;
          font-size: 13px;
          font-weight: 500;
          color: var(--foreground);
          cursor: pointer;
          text-align: left;
          transition: background 0.12s;
        }
        .popover-row:hover { background: var(--muted); }
        .popover-row.danger { color: #ef4444; }
        .popover-row.danger:hover { background: rgba(239, 68, 68, 0.07); }

        .confirm-row {
          padding: 10px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          background: rgba(239, 68, 68, 0.05);
        }

        .confirm-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          color: #dc2626;
        }

        .confirm-btns {
          display: flex;
          gap: 6px;
        }

        .confirm-cancel {
          padding: 4px 10px;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: var(--card);
          font-size: 12px;
          font-weight: 500;
          color: var(--foreground);
          cursor: pointer;
          transition: background 0.12s;
        }
        .confirm-cancel:hover { background: var(--muted); }

        .confirm-ok {
          padding: 4px 10px;
          border: none;
          border-radius: 6px;
          background: #ef4444;
          color: white;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.12s;
        }
        .confirm-ok:hover { opacity: 0.85; }
      `}</style>
    </div>
  );
}
