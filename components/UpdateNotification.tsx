import React, { useState, useEffect } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { saveFormData } from '../utils/formPreservation';

import { APP_VERSION } from '../version';

interface UpdateNotificationProps {
    className?: string;
}

const UpdateNotification: React.FC<UpdateNotificationProps> = ({ className = '' }) => {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    // Get the build version from the generated file
    const currentVersion = APP_VERSION;

    useEffect(() => {
        // Skip update checks when running inside an iframe (Samsung/Android WebView compatibility)
        const isInIframe = window !== window.top;
        if (!isInIframe) {

            const checkVersion = async () => {
                try {
                    // Fetch version.json with cache busting and explicit no-cache headers
                    const response = await fetch(`/version.json?t=${Date.now()}`, {
                        cache: 'no-store',
                        headers: {
                            'Pragma': 'no-cache',
                            'Cache-Control': 'no-cache'
                        }
                    });

                    if (response.ok) {
                        const data = await response.json();
                        const serverVersion = data.version;

                        // Compare versions
                        if (serverVersion && serverVersion !== currentVersion) {
                            console.log(`[Update] Version mismatch detected. Current: ${currentVersion}, Server: ${serverVersion}`);
                            setUpdateAvailable(true);
                        } else {
                            // console.log(`[Update] App is up to date (v${currentVersion})`);
                        }
                    } else {
                        console.warn('[Update] Failed to fetch version info:', response.status);
                    }
                } catch (error) {
                    console.error('[Update] Error checking for updates:', error);
                }
            };

            // Check immediately
            checkVersion();

            // Periodically check for updates (every 5 minutes)
            const checkInterval = setInterval(checkVersion, 5 * 60 * 1000);

            return () => clearInterval(checkInterval);
        }
    }, []);

    const handleUpdate = () => {
        setIsUpdating(true);
        saveFormData();
        // Simple reload to fetch new HTML/JS
        window.location.reload();
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
