// Route-scoped draft preservation for standard form fields.
// This survives reloads/build updates and clears after successful submits without touching page business logic.

const STORAGE_KEY = 'pakaja_form_drafts_v2';
const LEGACY_STORAGE_KEY = 'pakaja_form_preservation';
const NOTIFICATION_STYLE_ID = 'form-preservation-styles';
const DRAFT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const RESTORE_DELAYS_MS = [0, 250, 1000];
const SUBMIT_RECHECK_DELAYS_MS = [800, 2000, 5000];
const INPUT_SELECTOR = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]):not([type="file"]):not([type="password"]), textarea, select';

interface LegacyFormData {
    timestamp: number;
    url: string;
    fields: Record<string, string>;
}

interface FieldDescriptor {
    key: string;
    tagName: 'INPUT' | 'TEXTAREA' | 'SELECT';
    inputType?: string;
    id?: string;
    name?: string;
    placeholder?: string;
    label?: string;
    scopeKind: 'form' | 'page';
    scopeId?: string;
    scopeIndex: number;
    fieldIndex: number;
    radioValue?: string;
}

interface PreservedField {
    descriptor: FieldDescriptor;
    value: string;
    checked?: boolean;
}

interface RouteDraft {
    route: string;
    updatedAt: number;
    fields: PreservedField[];
}

interface DraftStore {
    version: 2;
    routes: Record<string, RouteDraft>;
}

let isInitialized = false;
let isRestoring = false;
let saveTimer: number | null = null;
let pendingRestoreTimers: number[] = [];
let mutationObserver: MutationObserver | null = null;
let previousRouteKey = getCurrentRouteKey();
let notificationRouteKey: string | null = null;
let disposeListeners: Array<() => void> = [];

function getCurrentRouteKey(): string {
    const hashRoute = window.location.hash || '#/';
    return hashRoute.split('?')[0];
}

function shouldSkipRoute(routeKey = getCurrentRouteKey()): boolean {
    return routeKey === '#/login' || routeKey === '/login';
}

function getEligibleFields(root: ParentNode = document): Array<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> {
    return Array.from(root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(INPUT_SELECTOR))
        .filter((field) => {
            if ((field as HTMLInputElement).type === 'password') return false;
            if ((field as HTMLInputElement).type === 'file') return false;
            if (field.hasAttribute('data-no-preserve')) return false;
            if (field.disabled) return false;
            return true;
        });
}

function isEligibleField(field: Element): field is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
    return (
        (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)
        && !field.hasAttribute('data-no-preserve')
        && !field.disabled
        && (!(field instanceof HTMLInputElement) || !['password', 'file', 'hidden', 'submit', 'button', 'reset', 'image'].includes(field.type))
    );
}

function normalizeText(value: string | null | undefined): string {
    return (value || '').replace(/\s+/g, ' ').trim();
}

function getLabelText(field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string {
    const ariaLabel = field.getAttribute('aria-label');
    if (ariaLabel) return normalizeText(ariaLabel);

    if (field.id) {
        const explicitLabel = document.querySelector(`label[for="${CSS.escape(field.id)}"]`);
        if (explicitLabel) {
            return normalizeText(explicitLabel.textContent);
        }
    }

    const nestedLabel = field.closest('label');
    if (nestedLabel) {
        return normalizeText(nestedLabel.textContent);
    }

    return '';
}

function getScopeMeta(field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): {
    kind: 'form' | 'page';
    id?: string;
    index: number;
} {
    const form = field.closest('form');
    if (form) {
        const forms = Array.from(document.querySelectorAll('form'));
        return {
            kind: 'form',
            id: form.id || form.getAttribute('name') || undefined,
            index: Math.max(forms.indexOf(form), 0),
        };
    }

    return {
        kind: 'page',
        index: 0,
    };
}

function getScopedFields(descriptor: FieldDescriptor): Array<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> {
    if (descriptor.scopeKind === 'form') {
        let form: HTMLFormElement | null = null;

        if (descriptor.scopeId) {
            const escapedId = CSS.escape(descriptor.scopeId);
            form = document.getElementById(descriptor.scopeId) as HTMLFormElement | null;
            if (!form) {
                form = document.querySelector(`form[name="${escapedId}"]`) as HTMLFormElement | null;
            }
        }

        if (!form) {
            const forms = Array.from(document.querySelectorAll('form'));
            form = (forms[descriptor.scopeIndex] as HTMLFormElement | undefined) || null;
        }

        return form ? getEligibleFields(form) : [];
    }

    return getEligibleFields().filter((field) => !field.closest('form'));
}

function buildFieldDescriptor(
    field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
    routeFields: Array<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
): FieldDescriptor {
    const scope = getScopeMeta(field);
    const scopedFields = scope.kind === 'form'
        ? getEligibleFields(field.closest('form') as HTMLFormElement)
        : routeFields.filter((candidate) => !candidate.closest('form'));

    const fieldIndex = Math.max(scopedFields.indexOf(field), 0);
    const tagName = field.tagName as FieldDescriptor['tagName'];
    const inputType = field instanceof HTMLInputElement ? field.type : undefined;
    const placeholder = 'placeholder' in field ? normalizeText(field.placeholder) : '';
    const label = getLabelText(field);
    const radioValue = field instanceof HTMLInputElement && field.type === 'radio' ? field.value : undefined;

    const descriptorKey = [
        scope.kind,
        scope.id || '',
        scope.index,
        fieldIndex,
        tagName,
        inputType || '',
        field.id || '',
        field.getAttribute('name') || '',
        placeholder,
        label,
        radioValue || '',
    ].join('::');

    return {
        key: descriptorKey,
        tagName,
        inputType,
        id: field.id || undefined,
        name: field.getAttribute('name') || undefined,
        placeholder: placeholder || undefined,
        label: label || undefined,
        scopeKind: scope.kind,
        scopeId: scope.id,
        scopeIndex: scope.index,
        fieldIndex,
        radioValue,
    };
}

function extractFieldState(
    field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
    routeFields: Array<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
): PreservedField {
    const descriptor = buildFieldDescriptor(field, routeFields);

    if (field instanceof HTMLInputElement && (field.type === 'checkbox' || field.type === 'radio')) {
        return {
            descriptor,
            value: field.value,
            checked: field.checked,
        };
    }

    return {
        descriptor,
        value: field.value,
    };
}

function readStore(): DraftStore {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return { version: 2, routes: {} };
        }

        const parsed = JSON.parse(raw) as Partial<DraftStore>;
        const routes = parsed.routes && typeof parsed.routes === 'object' ? parsed.routes : {};
        const now = Date.now();

        Object.keys(routes).forEach((routeKey) => {
            const routeDraft = routes[routeKey];
            if (!routeDraft || typeof routeDraft !== 'object') {
                delete routes[routeKey];
                return;
            }

            if (!routeDraft.updatedAt || now - routeDraft.updatedAt > DRAFT_RETENTION_MS) {
                delete routes[routeKey];
            }
        });

        return {
            version: 2,
            routes: routes as Record<string, RouteDraft>,
        };
    } catch {
        return { version: 2, routes: {} };
    }
}

function writeStore(store: DraftStore): void {
    try {
        if (Object.keys(store.routes).length === 0) {
            localStorage.removeItem(STORAGE_KEY);
            return;
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
        // Ignore storage quota or serialization failures.
    }
}

function clearRouteDraft(routeKey: string): void {
    const store = readStore();
    if (!store.routes[routeKey]) return;

    delete store.routes[routeKey];
    writeStore(store);
}

function clearPendingRestoreTimers(): void {
    pendingRestoreTimers.forEach((timerId) => window.clearTimeout(timerId));
    pendingRestoreTimers = [];
}

function saveCurrentRouteDraft(): void {
    const routeKey = getCurrentRouteKey();
    if (shouldSkipRoute(routeKey)) {
        clearRouteDraft(routeKey);
        return;
    }

    const routeFields = getEligibleFields();
    if (routeFields.length === 0) {
        clearRouteDraft(routeKey);
        return;
    }

    const preservedFields = routeFields.map((field) => extractFieldState(field, routeFields));

    const store = readStore();
    store.routes[routeKey] = {
        route: routeKey,
        updatedAt: Date.now(),
        fields: preservedFields,
    };

    writeStore(store);
}

function saveDraftForRoute(routeKey: string): void {
    if (shouldSkipRoute(routeKey)) {
        clearRouteDraft(routeKey);
        return;
    }

    const routeFields = getEligibleFields();
    if (routeFields.length === 0) {
        clearRouteDraft(routeKey);
        return;
    }

    const preservedFields = routeFields.map((field) => extractFieldState(field, routeFields));
    const store = readStore();
    store.routes[routeKey] = {
        route: routeKey,
        updatedAt: Date.now(),
        fields: preservedFields,
    };

    writeStore(store);
}

function scheduleSave(): void {
    if (saveTimer !== null) {
        window.clearTimeout(saveTimer);
    }

    saveTimer = window.setTimeout(() => {
        saveCurrentRouteDraft();
        saveTimer = null;
    }, 200);
}

function applyValueToField(
    field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
    preserved: PreservedField,
): boolean {
    if (field instanceof HTMLInputElement && (field.type === 'checkbox' || field.type === 'radio')) {
        const nextChecked = Boolean(preserved.checked);
        if (field.checked === nextChecked) {
            return false;
        }

        field.checked = nextChecked;
    } else {
        if (field.value === preserved.value) {
            return false;
        }

        field.value = preserved.value;
    }

    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
}

function findFieldByDescriptor(descriptor: FieldDescriptor): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null {
    if (descriptor.id) {
        const byId = document.getElementById(descriptor.id) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
        if (byId && !byId.hasAttribute('data-no-preserve')) {
            return byId;
        }
    }

    const scopedFields = getScopedFields(descriptor);
    const scopedRoot = descriptor.scopeKind === 'form'
        ? (() => {
            if (descriptor.scopeId) {
                return document.getElementById(descriptor.scopeId) || document.querySelector(`form[name="${CSS.escape(descriptor.scopeId)}"]`);
            }
            const forms = Array.from(document.querySelectorAll('form'));
            return forms[descriptor.scopeIndex] || null;
        })()
        : document;

    if (descriptor.name && scopedRoot) {
        const candidates = Array.from(scopedRoot.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[name="${CSS.escape(descriptor.name)}"]`));

        if (descriptor.inputType === 'radio' && descriptor.radioValue !== undefined) {
            const radioMatch = candidates.find((candidate) => candidate instanceof HTMLInputElement && candidate.type === 'radio' && candidate.value === descriptor.radioValue);
            if (radioMatch) return radioMatch;
        }

        if (candidates.length === 1) {
            return candidates[0];
        }

        const indexedCandidate = candidates.find((candidate, index) => index === descriptor.fieldIndex);
        if (indexedCandidate) {
            return indexedCandidate;
        }
    }

    const indexed = scopedFields[descriptor.fieldIndex];
    if (indexed) {
        return indexed;
    }

    return null;
}

function restoreRouteDraft(routeKey = getCurrentRouteKey()): number {
    if (shouldSkipRoute(routeKey)) return 0;

    const store = readStore();
    const draft = store.routes[routeKey];
    if (!draft?.fields?.length) return 0;

    let restoredCount = 0;
    isRestoring = true;

    try {
        draft.fields.forEach((preserved) => {
            const field = findFieldByDescriptor(preserved.descriptor);
            if (!field) return;

            if (applyValueToField(field, preserved)) {
                restoredCount += 1;
            }
        });
    } finally {
        isRestoring = false;
    }

    if (restoredCount > 0 && notificationRouteKey !== routeKey) {
        showRestoredNotification(restoredCount);
        notificationRouteKey = routeKey;
    }

    return restoredCount;
}

function nodeContainsEligibleField(node: Node): boolean {
    if (!(node instanceof Element)) {
        return false;
    }

    return isEligibleField(node) || getEligibleFields(node).length > 0;
}

function shouldRestoreForMutations(mutations: MutationRecord[]): boolean {
    return mutations.some((mutation) => (
        mutation.type === 'childList'
        && (
            Array.from(mutation.addedNodes).some(nodeContainsEligibleField)
            || Array.from(mutation.removedNodes).some(nodeContainsEligibleField)
        )
    ));
}

function scheduleRestore(routeKey = getCurrentRouteKey()): void {
    clearPendingRestoreTimers();

    RESTORE_DELAYS_MS.forEach((delayMs) => {
        const timerId = window.setTimeout(() => {
            restoreRouteDraft(routeKey);
        }, delayMs);

        pendingRestoreTimers.push(timerId);
    });
}

function removeSubmittedFields(routeKey: string, submittedFields: PreservedField[]): void {
    const store = readStore();
    const draft = store.routes[routeKey];
    if (!draft) return;

    const submittedKeys = new Set(submittedFields.map((field) => field.descriptor.key));
    draft.fields = draft.fields.filter((field) => !submittedKeys.has(field.descriptor.key));

    if (draft.fields.length === 0) {
        delete store.routes[routeKey];
    } else {
        draft.updatedAt = Date.now();
    }

    writeStore(store);
}

function shouldClearSubmittedDraft(
    form: HTMLFormElement,
    routeKey: string,
    submittedFields: PreservedField[],
): boolean {
    if (getCurrentRouteKey() !== routeKey) {
        return true;
    }

    if (!form.isConnected) {
        return true;
    }

    const currentFields = getEligibleFields(form);
    if (currentFields.length === 0) {
        return true;
    }

    const currentSnapshot = currentFields.map((field) => extractFieldState(field, currentFields));
    const meaningfulSubmittedFields = submittedFields.filter((field) => field.checked === true || field.value !== '');
    const fieldsToCheck = meaningfulSubmittedFields.length > 0 ? meaningfulSubmittedFields : submittedFields;

    return fieldsToCheck.some((submittedField) => {
        const currentField = currentSnapshot.find((field) => field.descriptor.key === submittedField.descriptor.key);
        if (!currentField) return true;

        if (submittedField.checked !== undefined || currentField.checked !== undefined) {
            return currentField.checked !== submittedField.checked;
        }

        return currentField.value !== submittedField.value;
    });
}

function reconcileAfterSubmit(form: HTMLFormElement, routeKey: string, submittedFields: PreservedField[]): void {
    if (shouldClearSubmittedDraft(form, routeKey, submittedFields)) {
        removeSubmittedFields(routeKey, submittedFields);

        if (getCurrentRouteKey() === routeKey) {
            saveCurrentRouteDraft();
        }
    }
}

function maybeRestoreLegacySnapshot(): void {
    try {
        const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (!raw) return;

        const legacyData = JSON.parse(raw) as LegacyFormData;
        const isRecent = legacyData.timestamp && Date.now() - legacyData.timestamp < 5 * 60 * 1000;
        const currentUrl = window.location.href;

        if (!isRecent || legacyData.url !== currentUrl) {
            localStorage.removeItem(LEGACY_STORAGE_KEY);
            return;
        }

        let restoredCount = 0;
        Object.entries(legacyData.fields || {}).forEach(([key, value]) => {
            let field = document.getElementById(key) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
            if (!field) {
                field = document.querySelector(`[name="${CSS.escape(key)}"]`) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
            }

            if (!field) return;

            if (field instanceof HTMLInputElement && (field.type === 'checkbox' || field.type === 'radio')) {
                const nextChecked = value === 'true';
                if (field.checked === nextChecked) return;
                field.checked = nextChecked;
            } else {
                if (field.value === value) return;
                field.value = value;
            }

            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
            restoredCount += 1;
        });

        if (restoredCount > 0 && notificationRouteKey !== getCurrentRouteKey()) {
            showRestoredNotification(restoredCount);
            notificationRouteKey = getCurrentRouteKey();
        }

        localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
        localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
}

function showRestoredNotification(count: number): void {
    const existing = document.getElementById('form-preservation-notice');
    existing?.remove();

    const notification = document.createElement('div');
    notification.id = 'form-preservation-notice';
    notification.className = 'fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-40';
    notification.innerHTML = `
    <div class="bg-slate-800 text-white rounded-lg shadow-lg p-3 flex items-center gap-3" style="animation: slideUp 0.3s ease-out">
      <div class="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-emerald-400">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <div class="flex-1">
        <p class="text-sm font-medium">Draft Restored</p>
        <p class="text-xs text-slate-400">${count} field${count > 1 ? 's' : ''} recovered after reload/update</p>
      </div>
    </div>
  `;

    if (!document.getElementById(NOTIFICATION_STYLE_ID)) {
        const style = document.createElement('style');
        style.id = NOTIFICATION_STYLE_ID;
        style.textContent = `
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
        document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    window.setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s ease-out';
        window.setTimeout(() => notification.remove(), 300);
    }, 4000);
}

export function initializeFormPreservation(): () => void {
    if (isInitialized) {
        return () => undefined;
    }

    isInitialized = true;
    previousRouteKey = getCurrentRouteKey();

    const handleInputLikeEvent = (event: Event) => {
        if (isRestoring) return;

        const target = event.target;
        if (!(target instanceof Element) || !isEligibleField(target)) {
            return;
        }

        clearPendingRestoreTimers();
        scheduleSave();
    };

    const handleSubmit = (event: Event) => {
        const target = event.target;
        if (!(target instanceof HTMLFormElement)) return;

        const routeKey = getCurrentRouteKey();
        if (shouldSkipRoute(routeKey)) return;

        const currentFormFields = getEligibleFields(target);
        const submittedFormFields = currentFormFields.map((field) => extractFieldState(field, currentFormFields));
        if (submittedFormFields.length === 0) {
            clearRouteDraft(routeKey);
            return;
        }

        SUBMIT_RECHECK_DELAYS_MS.forEach((delayMs) => {
            window.setTimeout(() => reconcileAfterSubmit(target, routeKey, submittedFormFields), delayMs);
        });
    };

    const handleRouteChange = () => {
        const nextRouteKey = getCurrentRouteKey();
        if (nextRouteKey === previousRouteKey) return;

        saveDraftForRoute(previousRouteKey);
        previousRouteKey = nextRouteKey;
        notificationRouteKey = null;
        scheduleRestore(nextRouteKey);
    };

    const handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
            saveCurrentRouteDraft();
        }
    };

    const handleBeforeUnload = () => {
        saveCurrentRouteDraft();
    };

    document.addEventListener('input', handleInputLikeEvent, true);
    document.addEventListener('change', handleInputLikeEvent, true);
    document.addEventListener('submit', handleSubmit, true);
    window.addEventListener('hashchange', handleRouteChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    mutationObserver = new MutationObserver((mutations) => {
        if (!shouldRestoreForMutations(mutations)) {
            return;
        }

        scheduleRestore();
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    maybeRestoreLegacySnapshot();
    scheduleRestore();

    disposeListeners = [
        () => document.removeEventListener('input', handleInputLikeEvent, true),
        () => document.removeEventListener('change', handleInputLikeEvent, true),
        () => document.removeEventListener('submit', handleSubmit, true),
        () => window.removeEventListener('hashchange', handleRouteChange),
        () => window.removeEventListener('beforeunload', handleBeforeUnload),
        () => document.removeEventListener('visibilitychange', handleVisibilityChange),
        () => mutationObserver?.disconnect(),
    ];

    return () => {
        if (saveTimer !== null) {
            window.clearTimeout(saveTimer);
            saveTimer = null;
        }

        clearPendingRestoreTimers();

        disposeListeners.forEach((dispose) => dispose());
        disposeListeners = [];
        mutationObserver = null;
        isInitialized = false;
    };
}

export function saveFormData(): void {
    saveCurrentRouteDraft();
}

export function restoreFormData(): void {
    maybeRestoreLegacySnapshot();
    restoreRouteDraft();
}

export function clearFormData(): void {
    clearRouteDraft(getCurrentRouteKey());
}
