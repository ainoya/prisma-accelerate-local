import type { DriverAdapter, getPrismaClient } from '@prisma/client/runtime/library';
import type { IncomingHttpHeaders } from 'node:http';
export declare class ResultError extends Error {
    code: number;
    value: unknown;
    constructor(code: number, value: unknown);
}
export type ActiveConnectorType = 'mysql' | 'mongodb' | 'sqlite' | 'postgresql' | 'sqlserver' | 'cockroachdb';
export type PrismaAccelerateConfig = ConstructorParameters<typeof PrismaAccelerate>[0];
export declare class PrismaAccelerate {
    private config;
    prismaMap: {
        [key: string]: Promise<InstanceType<ReturnType<typeof getPrismaClient>> | undefined>;
    };
    static createApiKey: ({ secret, datasourceUrl, }: {
        secret: string;
        datasourceUrl: string;
    }) => Promise<string>;
    constructor(config: {
        activeProvider?: ActiveConnectorType;
        singleInstance?: boolean;
        getQueryEngineWasmModule?: () => Promise<unknown>;
        getPrismaClient: typeof getPrismaClient;
        getRuntime?: Required<InstanceType<ReturnType<typeof getPrismaClient>>['_engineConfig']>['engineWasm']['getRuntime'];
        adapter?: (datasourceUrl: string) => DriverAdapter;
        secret?: string;
        datasourceUrl?: string;
        getEnginePath?: (adapter: boolean, engineVersion: string) => Promise<string | undefined>;
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
    });
    private getDatasourceUrl;
    private getPrisma;
    query({ hash, headers, body, }: {
        hash: string;
        headers: IncomingHttpHeaders;
        body: unknown;
    }): Promise<{
        data: unknown;
    } | {
        batchResult: unknown[];
        extensions: {
            traces: never[];
            logs: never[];
        };
    } | {
        errors: {
            error: string;
            user_facing_error: {
                is_panic: boolean;
                message: any;
                meta: any;
                error_code: any;
                batch_request_idx: number;
            };
        }[];
    } | {
        errors: {
            error: string;
            user_facing_error: {
                message: string;
                error_code: number;
                is_panic: boolean;
                meta: unknown;
            };
        }[];
    } | undefined>;
    startTransaction({ version, hash, headers, body, }: {
        version: string;
        hash: string;
        headers: IncomingHttpHeaders;
        body: unknown;
    }): Promise<{
        id: string;
        extensions: {};
        'data-proxy': {
            endpoint: string;
        };
    } | undefined>;
    queryTransaction({ hash, headers, body, id, }: {
        hash: string;
        headers: IncomingHttpHeaders;
        body: unknown;
        id: string;
    }): Promise<{
        data: unknown;
    } | {
        errors: {
            error: string;
            user_facing_error: {
                message: string;
                error_code: number;
                is_panic: boolean;
                meta: unknown;
            };
        }[];
    } | undefined>;
    commitTransaction({ hash, headers, id, }: {
        hash: string;
        headers: IncomingHttpHeaders;
        id: string;
    }): Promise<void>;
    rollbackTransaction({ hash, headers, id, }: {
        hash: string;
        headers: IncomingHttpHeaders;
        id: string;
    }): Promise<void>;
    getPath(engineVersion: string): Promise<string>;
    createPrismaClient({ inlineSchema, engineVersion, hash, datasourceUrl, }: {
        inlineSchema: string;
        engineVersion: string;
        hash: string;
        datasourceUrl: string;
    }): Promise<InstanceType<ReturnType<typeof getPrismaClient>>>;
    updateSchema({ hash, headers, body, }: {
        hash: string;
        headers: IncomingHttpHeaders;
        body: unknown;
    }): Promise<void>;
}
