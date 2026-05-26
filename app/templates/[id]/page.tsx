'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Share2, Check, BookOpen, User, LayoutTemplate, ChevronDown, ChevronUp } from 'lucide-react';
import dynamic from 'next/dynamic';

const CreateChecklistModal = dynamic(() => import('@/components/create-checklist-modal'), { ssr: false });

const CAT_COLORS: Record<string, { bg: string; color: string }> = {
  travel:   { bg: '#dbeafe', color: '#1d4ed8' },
  event:    { bg: '#fce7f3', color: '#be185d' },
  work:     { bg: '#e0e7ff', color: '#4338ca' },
  home:     { bg: '#dcfce7', color: '#15803d' },
  health:   { bg: '#fef9c3', color: '#a16207' },
  shopping: { bg: '#fef3c7', color: '#b45309' },
  general:  { bg: '#f3f4f6', color: '#374151' },
  other:    { bg: '#ede9fe', color: '#7c3aed' },
};

interface TemplateItem { title: string; groupName: string; }
interface Template {
  id: string; title: string; description: string; category: string;
  authorName: string; isPublished: boolean; items: TemplateItem[];
}

export default function TemplatePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();

  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch(`/api/templates/${params.id}`)
      .then(r => r.json())
      .then(data => {
        if (data.template) setTemplate(data.template);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: template?.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // fallback: silently ignore
    }
  };

  const handleUse = () => {
    if (!session) {
      router.push(`/api/auth/signin?callbackUrl=/templates/${params.id}`);
      return;
    }
    setShowModal(true);
  };

  const toggleGroup = (g: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(g) ? next.delete(g) : next.add(g);
      return next;
    });
  };

  const catStyle = (cat: string) => CAT_COLORS[cat] || CAT_COLORS.general;

  // Group items
  const groups: Record<string, TemplateItem[]> = {};
  template?.items.forEach(item => {
    const key = item.groupName || 'General';
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });

  if (loading) {
    return (
      <div className="page">
        <div className="header">
          <button className="back-btn" onClick={() => router.back()}><ArrowLeft size={20} /></button>
        </div>
        <div className="skeleton-wrap">
          {[140, 80, 100, 80].map((h, i) => (
            <div key={i} className="skeleton" style={{ height: h }} />
          ))}
        </div>
        <style jsx>{`
          .page { min-height: 100vh; background: var(--background); }
          .header { display: flex; align-items: center; padding: 16px 16px 0; }
          .back-btn { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border: none; background: var(--muted); border-radius: 10px; cursor: pointer; color: var(--foreground); }
          .skeleton-wrap { display: flex; flex-direction: column; gap: 12px; padding: 24px 16px; }
          .skeleton { border-radius: 12px; background: var(--muted); animation: pulse 1.4s ease-in-out infinite; }
          @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
        `}</style>
      </div>
    );
  }

  if (notFound || !template) {
    return (
      <div className="page center">
        <LayoutTemplate size={48} style={{ color: 'var(--muted-foreground)', marginBottom: 16 }} />
        <h2>Template not found</h2>
        <p>This template may have been removed or is no longer public.</p>
        <button className="back-link" onClick={() => router.push('/')}>Go home</button>
        <style jsx>{`
          .page { min-height: 100vh; background: var(--background); }
          .center { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 48px 24px; text-align: center; }
          h2 { font-size: 20px; font-weight: 700; color: var(--foreground); margin: 0; }
          p { font-size: 14px; color: var(--muted-foreground); margin: 0; }
          .back-link { margin-top: 12px; padding: 10px 24px; border: none; background: var(--primary); color: white; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; }
        `}</style>
      </div>
    );
  }

  const cs = catStyle(template.category);

  return (
    <div className="page">
      {/* Header */}
      <div className="header">
        <button className="back-btn" onClick={() => router.back()}>
          <ArrowLeft size={20} />
        </button>
        <span className="header-title">Template</span>
        <button className="share-btn" onClick={handleShare}>
          {copied ? <Check size={16} /> : <Share2 size={16} />}
          {copied ? 'Copied!' : 'Share'}
        </button>
      </div>

      <div className="content">
        {/* Template info */}
        <div className="info-card">
          <div className="info-top">
            <span className="cat-badge" style={{ background: cs.bg, color: cs.color }}>
              {template.category}
            </span>
          </div>
          <h1 className="title">{template.title}</h1>
          {template.description && <p className="desc">{template.description}</p>}
          <div className="meta">
            <span className="meta-item"><User size={13} />{template.authorName}</span>
            <span className="meta-item"><BookOpen size={13} />{template.items.length} items</span>
          </div>
        </div>

        {/* Items by group */}
        {Object.entries(groups).map(([groupName, items]) => {
          const collapsed = collapsedGroups.has(groupName);
          return (
            <div key={groupName} className="group-card">
              <button className="group-header" onClick={() => toggleGroup(groupName)}>
                <span className="group-name">{groupName}</span>
                <span className="group-count">{items.length}</span>
                {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              </button>
              {!collapsed && (
                <ul className="item-list">
                  {items.map((item, idx) => (
                    <li key={idx} className="item-row">
                      <span className="item-dot" />
                      {item.title}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {/* Use CTA */}
      <div className="cta-bar">
        <button className="use-btn" onClick={handleUse}>
          Use this template
        </button>
        <button className="share-btn-cta" onClick={handleShare}>
          {copied ? <Check size={16} /> : <Share2 size={16} />}
        </button>
      </div>

      {/* Modal */}
      {session && (
        <CreateChecklistModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); router.push('/'); }}
          initialTemplateId={template.id}
        />
      )}

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: var(--background);
          padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 90px);
        }

        /* Header */
        .header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 16px 8px;
          position: sticky;
          top: 0;
          background: var(--background);
          z-index: 10;
          border-bottom: 1px solid var(--border);
        }
        .back-btn {
          width: 38px; height: 38px;
          display: flex; align-items: center; justify-content: center;
          border: none; background: var(--muted); border-radius: 10px;
          cursor: pointer; color: var(--foreground); flex-shrink: 0;
        }
        .header-title {
          flex: 1; font-size: 16px; font-weight: 600; color: var(--foreground);
        }
        .share-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 14px; border: 1px solid var(--border);
          background: var(--background); border-radius: 10px;
          font-size: 13px; font-weight: 500; color: var(--foreground);
          cursor: pointer; white-space: nowrap;
        }
        .share-btn:hover { background: var(--muted); }

        /* Content */
        .content { padding: 16px 16px 0; display: flex; flex-direction: column; gap: 12px; }

        /* Info card */
        .info-card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .info-top { display: flex; align-items: center; }
        .cat-badge {
          font-size: 11px; font-weight: 700; padding: 3px 10px;
          border-radius: 99px; text-transform: capitalize;
        }
        .title {
          font-size: 22px; font-weight: 800; color: var(--foreground);
          margin: 0; line-height: 1.25;
        }
        .desc {
          font-size: 14px; color: var(--muted-foreground); margin: 0; line-height: 1.5;
        }
        .meta { display: flex; gap: 16px; flex-wrap: wrap; }
        .meta-item {
          display: flex; align-items: center; gap: 5px;
          font-size: 13px; color: var(--muted-foreground);
        }

        /* Group card */
        .group-card {
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 14px;
          overflow: hidden;
        }
        .group-header {
          width: 100%; display: flex; align-items: center; gap: 8px;
          padding: 12px 14px; border: none; background: none;
          cursor: pointer; text-align: left;
          color: var(--foreground);
        }
        .group-header:hover { background: var(--muted); }
        .group-name { flex: 1; font-size: 14px; font-weight: 600; }
        .group-count {
          font-size: 12px; font-weight: 600; color: white;
          background: var(--primary); padding: 1px 7px; border-radius: 99px;
        }
        .item-list {
          list-style: none; margin: 0;
          padding: 4px 14px 12px;
          display: flex; flex-direction: column; gap: 0;
          border-top: 1px solid var(--border);
        }
        .item-row {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 0;
          font-size: 14px; color: var(--foreground);
          border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
        }
        .item-row:last-child { border-bottom: none; }
        .item-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: var(--primary); opacity: 0.6; flex-shrink: 0;
        }

        /* CTA bar */
        .cta-bar {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          display: flex; gap: 10px;
          padding: 12px 16px calc(env(safe-area-inset-bottom, 0px) + 12px);
          background: var(--background);
          border-top: 1px solid var(--border);
          z-index: 10;
        }
        .use-btn {
          flex: 1; padding: 14px;
          background: var(--primary); color: white;
          border: none; border-radius: 12px;
          font-size: 15px; font-weight: 700; cursor: pointer;
          transition: opacity 0.15s;
        }
        .use-btn:hover { opacity: 0.88; }
        .share-btn-cta {
          width: 50px; height: 50px;
          display: flex; align-items: center; justify-content: center;
          border: 1.5px solid var(--border); border-radius: 12px;
          background: var(--background); color: var(--foreground);
          cursor: pointer; flex-shrink: 0;
        }
        .share-btn-cta:hover { background: var(--muted); }
      `}</style>
    </div>
  );
}
