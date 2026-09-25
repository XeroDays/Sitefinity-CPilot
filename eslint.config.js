const js = require("@eslint/js");

const RENDERER_GLOBALS = {
    window: "readonly",
    document: "readonly",
    navigator: "readonly",
    console: "readonly",
    setTimeout: "readonly",
    clearTimeout: "readonly",
    Event: "readonly",
    KeyboardEvent: "readonly",
    MouseEvent: "readonly",
    HTMLElement: "readonly"
};

const NODE_GLOBALS = {
    module: "writable",
    require: "readonly",
    process: "readonly",
    __dirname: "readonly",
    __filename: "readonly",
    console: "readonly",
    Buffer: "readonly",
    setTimeout: "readonly",
    clearTimeout: "readonly",
    setImmediate: "readonly",
    globalThis: "readonly",
    exports: "writable"
};

const BASE_RULES = {
    ...js.configs.recommended.rules,
    "no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrors: "none"
    }],
    "no-empty": ["error", { allowEmptyCatch: true }],
    "no-console": "off",
    eqeqeq: ["warn", "smart"],
    "prefer-const": "warn",
    "no-var": "error"
};

module.exports = [
    {
        ignores: [
            "node_modules/**",
            "dist/**",
            "build/**",
            "src/renderer/vendor/**"
        ]
    },
    {
        files: ["src/preload/**/*.js"],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: "commonjs",
            globals: {
                ...NODE_GLOBALS,
                fetch: "readonly",
                AbortSignal: "readonly",
            }
        },
        rules: BASE_RULES
    },
    {
        files: ["src/main/**/*.js", "scripts/**/*.js"],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: "commonjs",
            globals: NODE_GLOBALS
        },
        rules: BASE_RULES
    },
    {
        files: ["src/shared/**/*.js"],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: "commonjs",
            globals: { ...NODE_GLOBALS, ...RENDERER_GLOBALS, module: "writable" }
        },
        rules: BASE_RULES
    },
    {
        files: ["src/renderer/**/*.js"],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: "script",
            globals: RENDERER_GLOBALS
        },
        rules: BASE_RULES
    },
    {
        files: ["tests/**/*.js"],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: "commonjs",
            globals: { ...NODE_GLOBALS, ...RENDERER_GLOBALS }
        },
        rules: { ...BASE_RULES, "no-unused-vars": "off" }
    }
];
