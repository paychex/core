const path = require('path');

const copy = require('rollup-plugin-copy');

const typescript = require('@rollup/plugin-typescript');
const { nodeResolve } = require("@rollup/plugin-node-resolve");
const { terser } = require("rollup-plugin-terser");
const polyfills = require('rollup-plugin-node-polyfills');
const commonjs = require('@rollup/plugin-commonjs');
const { babel } = require("@rollup/plugin-babel");

const pkg = require('./package.json');
const external = ['lodash'];

const output = {
    format: "umd",
    name: pkg.name,
    esModule: false,
    exports: "named",
    sourcemap: true,
    banner: `/*! ${pkg.name} v${pkg.version} */`,
    sourcemapPathTransform: (relativeSourcePath, sourcemapPath) => {
        return `${pkg.name}/${path.relative(path.resolve('.'), path.resolve(path.dirname(sourcemapPath), relativeSourcePath))}`;
    },
    globals: {
        'lodash': '_',
    },
    paths: {
        'lodash': 'lodash',
    }
};

module.exports = [
    {
        // umd
        external,
        input: 'index.ts',
        plugins: [
            nodeResolve({
                browser: true,
                preferBuiltins: false,
            }),
            commonjs({
                include: /node_modules/,
            }),
            typescript({
                tsconfig: './tsconfig.json',
            }),
            babel({
                babelHelpers: "bundled",
            }),
            polyfills(),
        ],
        output: [{
            ...output,
            plugins: [terser()],
            file: pkg.browser.replace('.js', '.min.js'),
        },{
            ...output,
            file: pkg.browser,
        }],
    },
    {
        // esm
        input: 'index.ts',
        external,
        plugins: [
            typescript({
                tsconfig: './tsconfig.json',
            }),
            nodeResolve(),
            commonjs({
                include: /node_modules/,
            }),
        ],
        output: {
            file: pkg.module,
            format: "esm",
            exports: "named",
            sourcemap: true,
        },
    },
    {
        // commonjs
        input: 'index.ts',
        external,
        plugins: [
            typescript({
                tsconfig: './tsconfig.json',
            }),
            nodeResolve(),
            commonjs({
                include: /node_modules/,
            }),
        ],
        output: {
            file: pkg.main,
            format: "cjs",
            exports: "named",
            sourcemap: true,
            paths: {
                'lodash-es': 'lodash'
            }
        },
    },
    {
        // test bundles
        input: 'spec/index.ts',
        plugins: [
            typescript({
                tsconfig: './tsconfig.test.json',
                declaration: true,
                declarationDir: '.',
            }),
            copy({
                targets: [
                    { src: './package-test.json', dest: 'test', rename: 'package.json' },
                ]
            })
        ],
        output: [
            { format: 'cjs', file: 'test/index.js' },
            { format: 'esm', file: 'test/index.mjs' },
        ]
    }
];