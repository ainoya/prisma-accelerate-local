#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const minimist_1 = __importDefault(require("minimist"));
const __1 = require("..");
require("@colors/colors");
const readPackage = () => {
    try {
        return require(path_1.default.resolve(__dirname, '../../../package.json'));
    }
    catch (e) { }
    return require(path_1.default.resolve(__dirname, '../../package.json'));
};
const main = async () => {
    const argv = (0, minimist_1.default)(process.argv.slice(2), {
        alias: {
            t: 'http',
            p: 'port',
            h: 'host',
            c: 'cert',
            k: 'key',
            a: 'apiKey',
            w: 'wasm',
            s: 'secret',
            m: 'make',
            b: 'bodyLimit',
        },
        boolean: ['wasm', 'make', 'http'],
    });
    const datasourceUrl = argv._[0];
    const http = argv.http;
    const port = argv.p ?? 4000;
    const host = argv.h;
    const cert = argv.c;
    const key = argv.k;
    const wasm = argv.w;
    const secret = argv.s;
    const make = argv.m;
    const bodyLimit = argv.b ?? '16';
    if ((!datasourceUrl && !secret) || (make && !secret)) {
        const pkg = readPackage();
        console.log(`${pkg.name} ${pkg.version}\n`.blue);
        console.log('USAGE'.bold);
        console.log('\tcommand <path>');
        console.log('ARGUMENTS'.bold);
        console.log(`\t<url> Datasource Url`);
        console.log('OPTIONS'.bold);
        console.log(`\t-t, --http Accepted at http`);
        console.log(`\t-p, --port <port> Port to listen on`);
        console.log(`\t-p, --host <host> Host to listen on`);
        console.log(`\t-c, --cert <path> Path to ssl cert file`);
        console.log(`\t-k, --key <path> Path to ssl key file`);
        console.log(`\t-w, --wasm Use wasm as the run-time engine`);
        console.log(`\t-s, --secret <secret>`);
        console.log(`\t-m, --make make api key`);
        console.log(`\t-b, --bodyLimit <size(MB)> body limit size(default: 16MB)`);
    }
    else {
        if (secret && make) {
            const token = await __1.PrismaAccelerate.createApiKey({ datasourceUrl, secret });
            console.log(token);
            return;
        }
        const https = cert && key
            ? {
                cert: fs_1.default.readFileSync(cert).toString('utf8'),
                key: fs_1.default.readFileSync(key).toString('utf8'),
            }
            : undefined;
        (0, __1.createServer)({
            datasourceUrl,
            https: http ? null : https,
            wasm,
            secret,
            fastifySeverOptions: { bodyLimit: Number(bodyLimit) * 1024 * 1024 },
        })
            .listen({ port, host })
            .then((url) => console.log(`🚀  Server ready at ${url} `));
    }
};
main();
