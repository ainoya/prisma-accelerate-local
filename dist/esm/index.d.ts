import { type Server } from 'node:https';
import { type FastifyHttpsOptions } from 'fastify';
export * from './prisma-accelerate.js';
export declare const createKey: () => {
    cert: string;
    key: string;
};
export declare const createServer: ({ datasourceUrl, https, wasm, secret, fastifySeverOptions, singleInstance, onRequestSchema, onChangeSchema, }: {
    datasourceUrl?: string;
    https?: {
        cert: string;
        key: string;
    } | null;
    wasm?: boolean;
    secret?: string;
    fastifySeverOptions?: Omit<FastifyHttpsOptions<Server>, "https"> | FastifyHttpsOptions<Server>;
    singleInstance?: boolean;
    onRequestSchema?: ({ engineVersion, hash, datasourceUrl, }: {
        engineVersion: string;
        hash: string;
        datasourceUrl: string;
    }) => Promise<string | undefined | null>;
    onChangeSchema?: ({ inlineSchema, engineVersion, hash, datasourceUrl, }: {
        inlineSchema: string;
        engineVersion: string;
        hash: string;
        datasourceUrl: string;
    }) => Promise<void>;
}) => import("fastify").FastifyInstance<Server<typeof import("http").IncomingMessage, typeof import("http").ServerResponse>, import("http").IncomingMessage, import("http").ServerResponse<import("http").IncomingMessage>, import("fastify").FastifyBaseLogger, import("fastify").FastifyTypeProviderDefault> & PromiseLike<import("fastify").FastifyInstance<Server<typeof import("http").IncomingMessage, typeof import("http").ServerResponse>, import("http").IncomingMessage, import("http").ServerResponse<import("http").IncomingMessage>, import("fastify").FastifyBaseLogger, import("fastify").FastifyTypeProviderDefault>> & {
    __linterBrands: "SafePromiseLike";
};
