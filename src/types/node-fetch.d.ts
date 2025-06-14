declare module 'node-fetch' {
    export default function fetch(url: string | Request, init?: RequestInit): Promise<Response>;
    export class Request extends Body {
        constructor(input: string | Request, init?: RequestInit);
        clone(): Request;
        context: RequestContext;
        headers: Headers;
        method: string;
        redirect: RequestRedirect;
        referrer: string;
        url: string;
    }
    export class Response extends Body {
        constructor(body?: BodyInit, init?: ResponseInit);
        static error(): Response;
        static redirect(url: string, status?: number): Response;
        clone(): Response;
        headers: Headers;
        ok: boolean;
        redirected: boolean;
        status: number;
        statusText: string;
        type: ResponseType;
        url: string;
    }
    export class Headers implements Iterable<[string, string]> {
        constructor(init?: HeadersInit);
        append(name: string, value: string): void;
        delete(name: string): void;
        get(name: string): string | null;
        has(name: string): boolean;
        set(name: string, value: string): void;
        forEach(callback: (value: string, name: string) => void): void;
        [Symbol.iterator](): Iterator<[string, string]>;
    }
    export class Body {
        constructor(body?: any);
        arrayBuffer(): Promise<ArrayBuffer>;
        blob(): Promise<Blob>;
        json(): Promise<any>;
        text(): Promise<string>;
        buffer(): Promise<Buffer>;
        bodyUsed: boolean;
    }
    export type RequestContext = 'audio' | 'beacon' | 'cspreport' | 'download' | 'embed' | 'eventsource' | 'favicon' | 'fetch' | 'font' | 'form' | 'frame' | 'hyperlink' | 'iframe' | 'image' | 'imageset' | 'import' | 'internal' | 'location' | 'manifest' | 'object' | 'ping' | 'plugin' | 'prefetch' | 'script' | 'serviceworker' | 'sharedworker' | 'style' | 'subresource' | 'track' | 'video' | 'worker' | 'xmlhttprequest' | 'xslt';
    export type RequestMode = 'navigate' | 'same-origin' | 'no-cors' | 'cors';
    export type RequestRedirect = 'follow' | 'error' | 'manual';
    export type RequestCredentials = 'omit' | 'same-origin' | 'include';
    export type ResponseType = 'basic' | 'cors' | 'default' | 'error' | 'opaque' | 'opaqueredirect';
    export interface HeadersInit {
        [key: string]: string | string[];
    }
    export interface RequestInit {
        method?: string;
        headers?: HeadersInit;
        body?: BodyInit;
        mode?: RequestMode;
        credentials?: RequestCredentials;
        cache?: RequestCache;
        redirect?: RequestRedirect;
        referrer?: string;
        integrity?: string;
        keepalive?: boolean;
        signal?: AbortSignal;
        follow?: number;
        compress?: boolean;
        size?: number;
        agent?: any;
        highWaterMark?: number;
        insecureHTTPParser?: boolean;
    }
    export interface ResponseInit {
        status?: number;
        statusText?: string;
        headers?: HeadersInit;
    }
    export type BodyInit = ArrayBuffer | ArrayBufferView | NodeJS.ReadableStream | string | URLSearchParams | FormData;
} 