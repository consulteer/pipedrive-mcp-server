import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
    {
        files: ['src/**/*.ts'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                project: './tsconfig.json',
            },
        },
        plugins: {
            '@typescript-eslint': tsPlugin,
        },
        rules: {
            ...tsPlugin.configs.recommended.rules,
            '@typescript-eslint/no-explicit-any': 'off', // Allow 'any' for Pipedrive SDK
            '@typescript-eslint/ban-ts-comment': 'off', // Allow @ts-ignore for incomplete SDK types
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
            '@typescript-eslint/no-unsafe-function-type': 'off', // Allow Function type in Bottleneck proxy
        },
    },
    {
        ignores: ['build/**', 'node_modules/**', '*.js', '!eslint.config.js'],
    },
];
