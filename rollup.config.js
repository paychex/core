const { nodeResolve } = require("@rollup/plugin-node-resolve");
const { terser } = require("rollup-plugin-terser");
const polyfills = require('rollup-plugin-node-polyfills');
const commonjs = require('@rollup/plugin-commonjs');
const { babel } = require("@rollup/plugin-babel");

const pkg = require('./package.json');
const external = ['lodash-es'];

module.exports = [
    {
        // UMD
        external,
        input: 'index.js',
        plugins: [
            nodeResolve({
                browser: true,
                preferBuiltins: false,
            }),
            commonjs({
                include: /node_modules/,
            }),
            babel({
                babelHelpers: "bundled",
            }),
            polyfills(),
            terser(),
        ],
        output: {
            file: `dist/paychex.core.min.js`,
            format: "umd",
            name: pkg.name,
            esModule: false,
            exports: "named",
            sourcemap: true,
            globals: {
                'lodash-es': 'lodash',
            },
            paths: {
                'lodash-es': 'lodash',
            }
        },
    },
    // ESM
    {
        input: 'index.js',
        external,
        plugins: [
            nodeResolve(),
            commonjs({
                include: /node_modules/,
            })
        ],
        output: {
            dir: "dist/esm",
            format: "esm",
            exports: "named",
            sourcemap: true,
        },
    },
    // CJS
    {
        input: 'index.js',
        external,
        plugins: [
            nodeResolve(),
            commonjs({
                include: /node_modules/,
            })
        ],
        output: {
            dir: "dist/cjs",
            format: "cjs",
            exports: "named",
            sourcemap: true,
            paths: {
                'lodash-es': 'lodash'
            }
        },
    },
    // Types
    {
        input: 'types/index.js',
        plugins: [
            nodeResolve(),
            commonjs({
                include: /node_modules/,
            })
        ],
        output: [
            {
                format: "esm",
                exports: "named",
                sourcemap: true,
                file: 'dist/esm/types.mjs',
            },
            {
                format: "cjs",
                exports: "named",
                sourcemap: true,
                file: 'dist/cjs/types.js',
            },
        ],
    },
];