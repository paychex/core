const path = require('path');

const { nodeResolve } = require("@rollup/plugin-node-resolve");
const { terser } = require("rollup-plugin-terser");
const polyfills = require('rollup-plugin-node-polyfills');
const commonjs = require('@rollup/plugin-commonjs');
const { babel } = require("@rollup/plugin-babel");

const pkg = require('./package.json');
const external = ['lodash-es'];

const output = {
    format: "umd",
    name: pkg.name,
    esModule: false,
    exports: "named",
    sourcemap: true,
    sourcemapPathTransform: (relativeSourcePath, sourcemapPath) => {
        return `${pkg.name}/${path.relative(path.resolve('.'), path.resolve(path.dirname(sourcemapPath), relativeSourcePath))}`;
    },
    globals: {
        'lodash-es': '_',
    },
    paths: {
        'lodash-es': 'lodash',
    }
};

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
        ],
        output: [{
            ...output,
            plugins: [terser()],
            file: `dist/paychex.core.min.js`,
        },{
            ...output,
            file: `dist/paychex.core.js`,
        }],
    },
    // ESM
    {
        input: 'index.js',
        external,
        treeshake: false,
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
        treeshake: false,
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
];