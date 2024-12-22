"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServer = exports.createKey = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const fetch_engine_1 = require("@prisma/fetch-engine");
const fastify_1 = require("fastify");
const node_forge_1 = __importDefault(require("node-forge"));
const prisma_accelerate_js_1 = require("./prisma-accelerate.js");
__exportStar(require("./prisma-accelerate.js"), exports);
const createKey = () => {
    const keys = node_forge_1.default.pki.rsa.generateKeyPair(2048);
    const cert = node_forge_1.default.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    const now = new Date();
    cert.validity.notBefore = now;
    cert.validity.notAfter.setFullYear(now.getFullYear() + 1);
    const attrs = [
        {
            name: 'commonName',
            value: 'example.com',
        },
        {
            name: 'countryName',
            value: 'EXAMPLE',
        },
        {
            shortName: 'ST',
            value: 'Example State',
        },
        {
            name: 'localityName',
            value: 'Example Locality',
        },
        {
            name: 'organizationName',
            value: 'Example Org',
        },
        {
            shortName: 'OU',
            value: 'Example Org Unit',
        },
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.sign(keys.privateKey);
    return {
        cert: node_forge_1.default.pki.certificateToPem(cert),
        key: node_forge_1.default.pki.privateKeyToPem(keys.privateKey),
    };
};
exports.createKey = createKey;
const getAdapter = (datasourceUrl) => {
    const url = new URL(datasourceUrl);
    const schema = url.searchParams.get('schema');
    const { PrismaPg } = require('@prisma/adapter-pg');
    const pg = require('pg');
    const pool = new pg.Pool({
        connectionString: url.toString(),
    });
    return new PrismaPg(pool, {
        schema: schema ?? undefined,
    });
};
const createServer = ({ datasourceUrl, https, wasm, secret, fastifySeverOptions, singleInstance, onRequestSchema, onChangeSchema, }) => {
    const { getPrismaClient } = require('@prisma/client/runtime/library.js');
    const prismaAccelerate = new prisma_accelerate_js_1.PrismaAccelerate({
        secret,
        datasourceUrl,
        activeProvider: 'postgresql',
        adapter: wasm ? getAdapter : undefined,
        getRuntime: () => require(`@prisma/client/runtime/query_engine_bg.postgresql.js`),
        getPrismaClient,
        singleInstance,
        onRequestSchema,
        onChangeSchema,
        getQueryEngineWasmModule: wasm
            ? async () => {
                const runtimePath = './node_modules/@prisma/client/runtime/query_engine_bg.postgresql.wasm';
                const queryEngineWasmFilePath = fs_1.default.existsSync(runtimePath)
                    ? runtimePath
                    : path_1.default.resolve(__dirname, fs_1.default.existsSync(path_1.default.resolve(__dirname, '../node_modules')) ? '..' : '../..', 'node_modules', '@prisma/client/runtime', 'query_engine_bg.postgresql.wasm');
                const queryEngineWasmFileBytes = fs_1.default.readFileSync(queryEngineWasmFilePath);
                return new WebAssembly.Module(queryEngineWasmFileBytes);
            }
            : undefined,
        getEnginePath: async (adapter, engineVersion) => {
            const baseDir = adapter ? '@prisma/client/runtime' : '.prisma/client';
            const dirname = path_1.default.resolve(__dirname, fs_1.default.existsSync(path_1.default.resolve(__dirname, '../node_modules')) ? '..' : '../..', 'node_modules', baseDir, adapter ? '' : engineVersion);
            if (!adapter) {
                fs_1.default.mkdirSync(dirname, { recursive: true });
                const engine = await (0, fetch_engine_1.download)({
                    binaries: {
                        'libquery-engine': dirname,
                    },
                    version: engineVersion,
                }).catch(() => undefined);
                if (!engine) {
                    return undefined;
                }
            }
            return dirname;
        },
    });
    const _fastify = (0, fastify_1.fastify)({
        https: https === undefined ? (0, exports.createKey)() : https,
        ...fastifySeverOptions,
    });
    _fastify.addContentTypeParser('*', { parseAs: 'string' }, function (_req, body, done) {
        done(null, body);
    });
    _fastify
        .post('/:version/:hash/graphql', async ({ body, params, headers }, reply) => {
        const { hash } = params;
        return prismaAccelerate.query({ hash, headers, body }).catch((e) => {
            return reply.status(e.code).send(e.value);
        });
    })
        .post('/:version/:hash/transaction/start', async ({ body, params, headers }, reply) => {
        const { version, hash } = params;
        const result = await prismaAccelerate
            .startTransaction({ version, hash, headers, body })
            .catch((e) => {
            return reply.status(e.code).send(e.value);
        });
        return result;
    })
        .post('/:version/:hash/itx/:id/graphql', async ({ body, params, headers }, reply) => {
        const { hash, id } = params;
        return prismaAccelerate.queryTransaction({ hash, headers, body, id }).catch((e) => {
            return reply.status(e.code).send(e.value);
        });
    })
        .post('/:version/:hash/itx/:id/commit', async ({ params, headers }, reply) => {
        const { hash, id } = params;
        return prismaAccelerate.commitTransaction({ hash, headers, id }).catch((e) => {
            return reply.status(e.code).send(e.value);
        });
    })
        .post('/:version/:hash/itx/:id/rollback', async ({ params, headers }, reply) => {
        const { hash, id } = params;
        return prismaAccelerate.rollbackTransaction({ hash, headers, id }).catch((e) => {
            return reply.status(e.code).send(e.value);
        });
    })
        .put('/:version/:hash/schema', async ({ body, params, headers }, reply) => {
        const { hash } = params;
        return prismaAccelerate.updateSchema({ hash, headers, body }).catch((e) => {
            return reply.status(e.code).send(e.value);
        });
    })
        .all('*', async (req, reply) => {
        return reply.status(404).send('Not found');
    });
    return _fastify;
};
exports.createServer = createServer;
