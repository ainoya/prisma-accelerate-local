import { DriverAdapter } from '@prisma/client/runtime/library';
import { getPrismaClient } from '@prisma/client/runtime/wasm.js';
export type CreateParams<Env extends Record<string, unknown>> = {
    runtime: Required<InstanceType<ReturnType<typeof getPrismaClient>>['_engineConfig']>['engineWasm']['getRuntime'];
    adapter: (datasourceUrl: string, env: Env) => DriverAdapter;
    queryEngineWasmModule: unknown;
    secret?: (env: Env) => string;
    singleInstance?: boolean;
};
export declare const createFetcher: <Env extends Record<string, unknown>>({ adapter, queryEngineWasmModule, secret, singleInstance, runtime, }: CreateParams<Env>) => (request: Request, env: Env) => Promise<Response>;
