"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHandler = exports.importModule = void 0;
const wasm_js_1 = require("@prisma/client/runtime/wasm.js");
const prisma_accelerate_js_1 = require("./prisma-accelerate.js");
const importModule = (name, metaUrl) => {
    return fetch(new URL(`../../node_modules/${name}`, metaUrl))
        .then((r) => r.arrayBuffer())
        .catch(() => fetch(new URL(`../node_modules/${name}`, metaUrl)).then((r) => r.arrayBuffer()))
        .then((buffer) => new WebAssembly.Module(buffer));
};
exports.importModule = importModule;
const createHandler = ({ adapter, queryEngineWasmModule, secret, runtime, }) => {
    let prismaAccelerate;
    const getPrismaAccelerate = async ({ secret, onRequestSchema, onChangeSchema, }) => {
        if (prismaAccelerate) {
            return prismaAccelerate;
        }
        prismaAccelerate = new prisma_accelerate_js_1.PrismaAccelerate({
            singleInstance: true,
            secret,
            adapter,
            getRuntime: runtime,
            getQueryEngineWasmModule: async () => {
                return queryEngineWasmModule;
            },
            getPrismaClient: wasm_js_1.getPrismaClient,
            onRequestSchema,
            onChangeSchema,
        });
        return prismaAccelerate;
    };
    return async (request) => {
        const prismaAccelerate = await getPrismaAccelerate({
            secret,
            onRequestSchema: async ({ engineVersion, hash, datasourceUrl }) => {
                const cache = await caches.open('schema');
                return cache
                    .match(`http://localhost/schema-${engineVersion}:${hash}:${datasourceUrl}`)
                    .then((r) => r?.text());
            },
            onChangeSchema: async ({ inlineSchema, engineVersion, hash, datasourceUrl }) => {
                const cache = await caches.open('schema');
                return cache.put(`http://localhost/schema-${engineVersion}:${hash}:${datasourceUrl}`, new Response(inlineSchema, {
                    headers: { contentType: 'text/plain', 'cache-control': 'public, max-age=604800' },
                }));
            },
        });
        const url = new URL(request.url);
        const paths = url.pathname.split('/');
        const [_, version, hash, command] = paths;
        const headers = Object.fromEntries(request.headers.entries());
        const createResponse = (result) => result
            .then((r) => {
            return new Response(JSON.stringify(r), {
                headers: { 'content-type': 'application/json' },
            });
        })
            .catch((e) => {
            if (e instanceof prisma_accelerate_js_1.ResultError) {
                console.error(e.value);
                return new Response(JSON.stringify(e.value), {
                    status: e.code,
                    headers: { 'content-type': 'application/json' },
                });
            }
            return new Response(JSON.stringify(e), {
                status: 500,
                headers: { 'content-type': 'application/json' },
            });
        });
        if (request.method === 'POST') {
            const body = await request.text();
            switch (command) {
                case 'graphql':
                    return createResponse(prismaAccelerate.query({ body, hash, headers }));
                case 'transaction':
                    return createResponse(prismaAccelerate.startTransaction({
                        body,
                        hash,
                        headers,
                        version,
                    }));
                case 'itx': {
                    const id = paths[4];
                    switch (paths[5]) {
                        case 'commit':
                            return createResponse(prismaAccelerate.commitTransaction({
                                id,
                                hash,
                                headers,
                            }));
                        case 'rollback':
                            return createResponse(prismaAccelerate.rollbackTransaction({
                                id,
                                hash,
                                headers,
                            }));
                    }
                }
            }
        }
        else if (request.method === 'PUT') {
            const body = await request.text();
            switch (command) {
                case 'schema':
                    return createResponse(prismaAccelerate.updateSchema({
                        body,
                        hash,
                        headers,
                    }));
            }
        }
        return new Response('Not Found', { status: 404 });
    };
};
exports.createHandler = createHandler;
