/**
 * Download (with progress) and decompress the DPD web database.
 *
 * @param {function(number): void} [onProgress] - callback with 0-100
 * @returns {Promise<ArrayBuffer>} decompressed database buffer
 */
export class Loader {
    constructor(url) {
        this.url = url;
    }

    async load(onProgress) {
        const resp = await fetch(this.url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const total = Number(resp.headers.get("Content-Length")) || 0;
        const reader = resp.body.getReader();
        const chunks = [];
        let received = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            received += value.length;
            if (total && onProgress) {
                onProgress(Math.round((received / total) * 100));
            }
        }

        const compressed = new Uint8Array(received);
        let offset = 0;
        for (const chunk of chunks) {
            compressed.set(chunk, offset);
            offset += chunk.length;
        }

        const decompressed = pako.ungzip(compressed);
        return decompressed.buffer;
    }
}
