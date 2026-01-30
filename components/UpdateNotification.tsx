import React, { useState, useEffect } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { saveFormData } from '../utils/formPreservation';

interface UpdateNotificationProps {
    className?: string;
}

const UpdateNotification: React.FC<UpdateNotificationProps> = ({ className = '' }) => {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        // Skip update checks when running inside an iframe (Samsung/Android WebView compatibility)
        const isInIframe = window !== window.top;
        if ('serviceWorker' in navigator && !isInIframe) {
            // Check for updates on page load
            navigator.serviceWorker.ready.then((registration) => {
                // Check if there's already a waiting worker
                if (registration.waiting) {
                    setWaitingWorker(registration.waiting);
                    setUpdateAvailable(true);
                }

                // Listen for new workers
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                // New content is available
                                setWaitingWorker(newWorker);
                                setUpdateAvailable(true);
                            }
                        });
                    }
                });
            });

            // Handle controller change (when new SW takes over)
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (isUpdating) {
                    window.location.reload();
                }
            });

            // Periodically check for updates (every 5 minutes)
            const checkInterval = setInterval(() => {
                navigator.serviceWorker.ready.then((registration) => {
                    registration.update();
                });
            }, 5 * 60 * 1000);

            return () => clearInterval(checkInterval);
        }
    }, [isUpdating]);

    const handleUpdate = () => {
        if (waitingWorker) {
            // Save any form data before updating
            saveFormData();

            setIsUpdating(true);
            // Tell the waiting service worker to activate
            waitingWorker.postMessage({ type: 'SKIP_WAITING' });
        }
    };

    const handleDismiss = () => {
        setUpdateAvailable(false);
    };

    if (!updateAvailable) {
        return null;
    }

    return (
        <div className={`fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 ${className}`}>
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-xl shadow-2xl p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <RefreshCw size={20} className={isUpdating ? 'animate-spin' : ''} />
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm">Update Available</h4>
                    <p className="text-emerald-100 text-xs">A new version is ready. Click to refresh.</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                        onClick={handleUpdate}
                        disabled={isUpdating}
                        className="px-4 py-2 bg-white text-emerald-700 font-semibold text-sm rounded-lg hover:bg-emerald-50 transition-colors disabled:opacity-50"
                    >
                        {isUpdating ? 'Updating...' : 'Update'}
                    </button>
                    {!isUpdating && (
                        <button
                            onClick={handleDismiss}
                            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                            title="Dismiss"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UpdateNotification;
