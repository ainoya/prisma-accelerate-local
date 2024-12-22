import { DriverAdapter } from '@prisma/client/runtime/library';
import { getPrismaClient } from '@prisma/client/runtime/wasm.js';
export type CreateParams = {
    runtime: Required<InstanceType<ReturnType<typeof getPrismaClient>>['_engineConfig']>['engineWasm']['getRuntime'];
    adapter: (datasourceUrl: string) => DriverAdapter;
    queryEngineWasmModule: unknown;
    secret: string;
};
export declare const importModule: (name: string, metaUrl: string) => Promise<WebAssembly.Module>;
export declare const createHandler: ({ adapter, queryEngineWasmModule, secret, runtime, }: CreateParams) => (request: Request) => Promise<Response>;
