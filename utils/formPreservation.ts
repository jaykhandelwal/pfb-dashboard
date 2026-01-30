// Form data preservation utilities for app updates
// Saves all form field values to localStorage before update and restores them after

const STORAGE_KEY = 'pakaja_form_preservation';

interface FormData {
    timestamp: number;
    url: string;
    fields: Record<string, string>;
}

/**
 * Saves all form input values on the current page to localStorage
 * Called before triggering an app update
 */
export function saveFormData(): void {
    const fields: Record<string, string> = {};

    // Get all input elements
    const inputs = document.querySelectorAll<HTMLInputElement>('input:not([type="hidden"]):not([type="submit"]):not([type="button"])');
    inputs.forEach((input, index) => {
        const key = input.id || input.name || `input-${index}-${input.type}`;
        if (input.type === 'checkbox' || input.type === 'radio') {
            if (input.checked) {
                fields[key] = input.checked.toString();
            }
        } else if (input.value && input.value.trim()) {
            fields[key] = input.value;
        }
    });

    // Get all textarea elements
    const textareas = document.querySelectorAll<HTMLTextAreaElement>('textarea');
    textareas.forEach((textarea, index) => {
        const key = textarea.id || textarea.name || `textarea-${index}`;
        if (textarea.value && textarea.value.trim()) {
            fields[key] = textarea.value;
        }
    });

    // Get all select elements
    const selects = document.querySelectorAll<HTMLSelectElement>('select');
    selects.forEach((select, index) => {
        const key = select.id || select.name || `select-${index}`;
        if (select.value) {
            fields[key] = select.value;
        }
    });

    // Only save if there's data to preserve
    if (Object.keys(fields).length > 0) {
        const formData: FormData = {
            timestamp: Date.now(),
            url: window.location.href,
            fields
        };

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
            console.log('[FormPreservation] Saved form data:', Object.keys(fields).length, 'fields');
        } catch (e) {
            console.error('[FormPreservation] Failed to save form data:', e);
        }
    }
}

/**
 * Restores form data from localStorage if available
 * Called on app initialization after an update
 */
export function restoreFormData(): void {
    try {
        const savedData = localStorage.getItem(STORAGE_KEY);
        if (!savedData) return;

        const formData: FormData = JSON.parse(savedData);

        // Only restore if data is recent (within 5 minutes) and on same page
        const isRecent = Date.now() - formData.timestamp < 5 * 60 * 1000;
        const isSamePage = window.location.href === formData.url;

        if (!isRecent || !isSamePage) {
            clearFormData();
            return;
        }

        let restoredCount = 0;

        // Restore values with a small delay to ensure React has rendered
        setTimeout(() => {
            Object.entries(formData.fields).forEach(([key, value]) => {
                // Try to find element by id first, then by name
                let element = document.getElementById(key) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
                if (!element) {
                    element = document.querySelector(`[name="${key}"]`) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
                }

                if (element) {
                    if (element instanceof HTMLInputElement) {
                        if (element.type === 'checkbox' || element.type === 'radio') {
                            element.checked = value === 'true';
                        } else {
                            element.value = value;
                        }
                        // Trigger input event so React picks up the change
                        element.dispatchEvent(new Event('input', { bubbles: true }));
                        element.dispatchEvent(new Event('change', { bubbles: true }));
                        restoredCount++;
                    } else if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
                        element.value = value;
                        element.dispatchEvent(new Event('input', { bubbles: true }));
                        element.dispatchEvent(new Event('change', { bubbles: true }));
                        restoredCount++;
                    }
                }
            });

            if (restoredCount > 0) {
                console.log('[FormPreservation] Restored', restoredCount, 'form fields');
                // Show a brief toast notification
                showRestoredNotification(restoredCount);
            }

            // Clear the saved data after restoration attempt
            clearFormData();
        }, 500);

    } catch (e) {
        console.error('[FormPreservation] Failed to restore form data:', e);
        clearFormData();
    }
}

/**
 * Clears any saved form data from localStorage
 */
export function clearFormData(): void {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        // Ignore errors
    }
}

/**
 * Shows a brief notification that form data was restored
 */
function showRestoredNotification(count: number): void {
    const notification = document.createElement('div');
    notification.className = 'fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-40';
    notification.innerHTML = `
    <div class="bg-slate-800 text-white rounded-lg shadow-lg p-3 flex items-center gap-3" style="animation: slideUp 0.3s ease-out">
      <div class="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-emerald-400">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <div class="flex-1">
        <p class="text-sm font-medium">Form Data Restored</p>
        <p class="text-xs text-slate-400">${count} field${count > 1 ? 's' : ''} recovered from before update</p>
      </div>
    </div>
  `;

    // Add animation keyframes if not already present
    if (!document.getElementById('form-preservation-styles')) {
        const style = document.createElement('style');
        style.id = 'form-preservation-styles';
        style.textContent = `
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
        document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    // Remove after 4 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}
