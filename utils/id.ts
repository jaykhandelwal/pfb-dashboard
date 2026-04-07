const hex = (value: number) => value.toString(16).padStart(2, '0');

const buildUuidFromBytes = (bytes: Uint8Array): string => {
    const clone = new Uint8Array(bytes);

    clone[6] = (clone[6] & 0x0f) | 0x40;
    clone[8] = (clone[8] & 0x3f) | 0x80;

    return [
        Array.from(clone.slice(0, 4), hex).join(''),
        Array.from(clone.slice(4, 6), hex).join(''),
        Array.from(clone.slice(6, 8), hex).join(''),
        Array.from(clone.slice(8, 10), hex).join(''),
        Array.from(clone.slice(10, 16), hex).join(''),
    ].join('-');
};

export const generateId = (): string => {
    const cryptoApi = globalThis.crypto;

    if (cryptoApi?.randomUUID) {
        return cryptoApi.randomUUID();
    }

    if (cryptoApi?.getRandomValues) {
        return buildUuidFromBytes(cryptoApi.getRandomValues(new Uint8Array(16)));
    }

    return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};
