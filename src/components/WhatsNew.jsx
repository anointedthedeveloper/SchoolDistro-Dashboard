import { useState, useEffect } from 'react';
import { Download, CheckCircle, X, Zap, Bug, Shield, Wrench } from 'lucide-react';

const TAG_ICONS = {
    fix:         { Icon: Bug,          color: '#ef4444', label: 'Fix' },
    feature:     { Icon: Zap,          color: '#11b37f', label: 'New' },
    security:    { Icon: Shield,       color: '#8b5cf6', label: 'Security' },
    improvement: { Icon: Wrench,       color: '#f59e0b', label: 'Improved' },
};

// Simulated update progress — replace with real Electron auto-updater events
function useUpdateProgress(isDownloading, total) {
    const [progress, setProgress] = useState(0);
    const [downloaded, setDownloaded] = useState(0);

    useEffect(() => {
        if (!isDownloading) return;
        const interval = setInterval(() => {
            setProgress(p => {
                if (p >= 100) { clearInterval(interval); return 100; }
                return p + Math.random() * 4;
            });
        }, 200);
        return () => clearInterval(interval);
    }, [isDownloading]);

    useEffect(() => {
        setDownloaded(((progress / 100) * total).toFixed(1));
    }, [progress, total]);

    return { progress: Math.min(progress, 100), downloaded };
}

export default function WhatsNew({ version, changelog, fileSizeMb, onClose, onUpdate }) {
    const [downloading, setDownloading] = useState(false);
    const [done, setDone] = useState(false);
    const total = fileSizeMb || 14;
    const { progress, downloaded } = useUpdateProgress(downloading, total);

    useEffect(() => {
        if (progress >= 100 && downloading) {
            setTimeout(() => { setDownloading(false); setDone(true); }, 400);
        }
    }, [progress, downloading]);

    function handleUpdate() {
        setDownloading(true);
        if (onUpdate) onUpdate();
    }

    return (
        <div className="modal-overlay" onClick={!downloading ? onClose : undefined}>
            <div className="modal whats-new-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <h3 style={{ fontSize: '1.05rem' }}>SchoolDistro Receipt</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                            <span className="badge" style={{ background: 'rgba(45,111,181,0.15)', color: '#7ab3e8', fontSize: '0.72rem' }}>
                                v{version}
                            </span>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>What's New</span>
                        </div>
                    </div>
                    {!downloading && (
                        <button className="modal-close" onClick={onClose}><X size={16} /></button>
                    )}
                </div>

                {/* Changelog list */}
                <div className="whats-new-list">
                    {(changelog || []).map((item, i) => {
                        const tag = TAG_ICONS[item.tag] || TAG_ICONS.improvement;
                        return (
                            <div className="whats-new-item" key={i}>
                                <span className="whats-new-tag" style={{ background: tag.color + '18', color: tag.color }}>
                                    <tag.Icon size={10} /> {tag.label}
                                </span>
                                <span className="whats-new-text">{item.text}</span>
                            </div>
                        );
                    })}
                </div>

                {/* Update progress */}
                {downloading && (
                    <div className="update-progress-wrap">
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 6 }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Downloading update…</span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                                {downloaded} MB / {total} MB
                            </span>
                        </div>
                        <div className="update-progress-track">
                            <div className="update-progress-fill" style={{ width: `${progress}%` }} />
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                            {progress.toFixed(0)}%
                        </div>
                    </div>
                )}

                {done && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', color: '#11b37f', fontSize: '0.85rem' }}>
                        <CheckCircle size={16} />
                        Download complete — restart to apply update
                    </div>
                )}

                <div className="modal-footer" style={{ marginTop: 16 }}>
                    {!downloading && !done && (
                        <>
                            <button className="btn-secondary" onClick={onClose}>Later</button>
                            <button className="btn-primary" onClick={handleUpdate}>
                                <Download size={13} /> Update Now
                            </button>
                        </>
                    )}
                    {done && (
                        <button className="btn-primary" style={{ width: '100%' }} onClick={() => window.location.reload()}>
                            Restart & Apply
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
