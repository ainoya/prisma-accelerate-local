"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaAccelerate = exports.ResultError = void 0;
const jose_1 = require("jose");
const BaseConfig = {
    runtimeDataModel: { models: {}, enums: {}, types: {} },
    relativeEnvPaths: {
        rootEnvPath: '',
        schemaEnvPath: '',
    },
    relativePath: '',
    datasourceNames: ['db'],
    inlineSchema: '',
    dirname: '',
    clientVersion: '',
    engineVersion: '',
    activeProvider: '',
    inlineDatasources: {},
    inlineSchemaHash: '',
};
class ResultError extends Error {
    code;
    value;
    constructor(code, value) {
        super();
        this.code = code;
        this.value = value;
    }
}
exports.ResultError = ResultError;
class PrismaAccelerate {
    config;
    prismaMap = {};
    static createApiKey = async ({ secret, datasourceUrl, }) => {
        return new jose_1.SignJWT({ datasourceUrl })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setIssuer('prisma-accelerate')
            .sign(new TextEncoder().encode(secret));
    };
    constructor(config) {
        this.config = config;
    }
    getDatasourceUrl(headers) {
        if (!this.config.secret)
            return this.config.datasourceUrl;
        const authorization = headers['authorization'];
        const key = authorization?.replace('Bearer ', '') ?? '';
        return (0, jose_1.jwtVerify)(key, new TextEncoder().encode(this.config.secret))
            .then((v) => v.payload.datasourceUrl)
            .catch(() => undefined);
    }
    // deno-lint-ignore require-await
    async getPrisma({ headers, hash, ignoreSchemaError, }) {
        const datasourceUrl = await this.getDatasourceUrl(headers);
        if (!datasourceUrl) {
            throw new ResultError(401, { Unauthorized: { reason: 'InvalidKey' } });
        }
        const engineVersion = headers['prisma-engine-hash'];
        if (!engineVersion) {
            throw new ResultError(404, {
                EngineNotStarted: { reason: 'VersionMissing' },
            });
        }
        const prisma = this.prismaMap[`${engineVersion}-${hash}-${datasourceUrl}`];
        if (!prisma) {
            const inlineSchema = await this.config.onRequestSchema?.({
                engineVersion,
                hash,
                datasourceUrl,
            });
            if (inlineSchema) {
                return this.createPrismaClient({
                    inlineSchema,
                    engineVersion,
                    hash,
                    datasourceUrl,
                });
            }
        }
        if (!prisma && !ignoreSchemaError) {
            throw new ResultError(404, {
                EngineNotStarted: { reason: 'SchemaMissing' },
            });
        }
        return prisma;
    }
    async query({ hash, headers, body, }) {
        const prisma = await this.getPrisma({ hash, headers });
        if (!prisma)
            return;
        const query = JSON.parse(body);
        try {
            if (query.batch) {
                const result = await prisma._engine
                    .requestBatch(query.batch, {
                    containsWrite: true,
                    transaction: query.transaction
                        ? {
                            kind: 'batch',
                            options: query.transaction,
                        }
                        : undefined,
                })
                    .then((batchResult) => {
                    return {
                        batchResult: batchResult.map((v) => ('data' in v ? v.data : v)),
                        extensions: {
                            traces: [],
                            logs: [],
                        },
                    };
                })
                    .catch((e) => {
                    return {
                        errors: [
                            {
                                error: String(e),
                                user_facing_error: {
                                    is_panic: false,
                                    message: e.message,
                                    meta: e.meta,
                                    error_code: e.code,
                                    batch_request_idx: 1,
                                },
                            },
                        ],
                    };
                });
                return result;
            }
            return await prisma._engine
                .request(query, { isWrite: true })
                .catch((e) => {
                return {
                    errors: [
                        {
                            error: String(e),
                            user_facing_error: {
                                message: e.message,
                                error_code: e.code,
                                is_panic: false,
                                meta: e.meta,
                            },
                        },
                    ],
                };
            });
        }
        finally {
            if (this.config.singleInstance)
                await prisma.$disconnect();
        }
    }
    async startTransaction({ version, hash, headers, body, }) {
        const prisma = await this.getPrisma({ hash, headers });
        if (!prisma)
            return;
        const arg = JSON.parse(body);
        const { id } = await prisma._engine.transaction('start', {}, {
            timeout: arg.timeout,
            maxWait: arg.max_wait,
            isolationLevel: arg.isolation_level,
        });
        const host = headers['x-forwarded-host'] ?? headers['host'];
        if (this.config.singleInstance)
            await prisma.$disconnect();
        return {
            id,
            extensions: {},
            'data-proxy': {
                endpoint: `https://${host}/${version}/${hash}/itx/${id}`,
            },
        };
    }
    async queryTransaction({ hash, headers, body, id, }) {
        const prisma = await this.getPrisma({ hash, headers });
        if (!prisma)
            return;
        const query = JSON.parse(body);
        const result = await prisma._engine
            .request(query, {
            isWrite: true,
            interactiveTransaction: { id, payload: {} },
        })
            .catch((e) => {
            return {
                errors: [
                    {
                        error: String(e),
                        user_facing_error: {
                            message: e.message,
                            error_code: e.code,
                            is_panic: false,
                            meta: e.meta,
                        },
                    },
                ],
            };
        });
        if (this.config.singleInstance)
            await prisma.$disconnect();
        return result;
    }
    async commitTransaction({ hash, headers, id, }) {
        const prisma = await this.getPrisma({ hash, headers });
        if (!prisma)
            return;
        return prisma._engine.transaction('commit', {}, { id, payload: {} });
    }
    async rollbackTransaction({ hash, headers, id, }) {
        const prisma = await this.getPrisma({ hash, headers });
        if (!prisma)
            return;
        const result = await prisma._engine.transaction('rollback', {}, { id, payload: {} });
        if (this.config.singleInstance)
            await prisma.$disconnect();
        return result;
    }
    async getPath(engineVersion) {
        if (!this.config.getEnginePath)
            return '';
        const path = await this.config.getEnginePath(!!this.config.adapter, engineVersion);
        if (!path) {
            throw new ResultError(404, {
                EngineNotStarted: { reason: 'EngineMissing' },
            });
        }
        return path;
    }
    createPrismaClient({ inlineSchema, engineVersion, hash, datasourceUrl, }) {
        const resolve = async () => {
            const dirname = await this.getPath(engineVersion);
            const PrismaClient = this.config.getPrismaClient({
                ...BaseConfig,
                inlineSchema: atob(inlineSchema),
                dirname,
                engineVersion,
                activeProvider: this.config.activeProvider ?? 'postgresql',
                generator: this.config.adapter
                    ? {
                        name: '',
                        provider: {
                            fromEnvVar: '',
                            value: 'prisma-client-js',
                        },
                        output: {
                            value: '',
                            fromEnvVar: '',
                        },
                        config: {
                            engineType: 'wasm',
                        },
                        binaryTargets: [
                            {
                                fromEnvVar: '',
                                value: 'native',
                                native: true,
                            },
                        ],
                        previewFeatures: ['driverAdapters'],
                        sourceFilePath: 'schema.prisma',
                    }
                    : undefined,
                engineWasm: this.config.getQueryEngineWasmModule && this.config.getRuntime
                    ? {
                        getRuntime: this.config.getRuntime,
                        getQueryEngineWasmModule: this.config.getQueryEngineWasmModule,
                    }
                    : undefined,
            });
            return this.config.adapter
                ? new PrismaClient({ adapter: this.config.adapter(datasourceUrl) })
                : new PrismaClient({ datasourceUrl });
        };
        const prisma = resolve();
        prisma.catch(() => {
            delete this.prismaMap[`${engineVersion}-${hash}-${datasourceUrl}`];
        });
        if (!this.config.singleInstance) {
            this.prismaMap[`${engineVersion}-${hash}-${datasourceUrl}`] = prisma;
        }
        return prisma;
    }
    async updateSchema({ hash, headers, body, }) {
        if (await this.getPrisma({ hash, headers, ignoreSchemaError: true }).catch(() => null))
            return;
        const engineVersion = headers['prisma-engine-hash'];
        const datasourceUrl = await this.getDatasourceUrl(headers);
        if (!datasourceUrl) {
            throw new ResultError(401, { Unauthorized: { reason: 'InvalidKey' } });
        }
        const inlineSchema = String(body);
        if (!this.config.singleInstance) {
            await this.createPrismaClient({
                inlineSchema,
                engineVersion,
                hash,
                datasourceUrl,
            });
        }
        await this.config.onChangeSchema?.({ inlineSchema, engineVersion, hash, datasourceUrl });
    }
}
exports.PrismaAccelerate = PrismaAccelerate;
