module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    moduleFileExtensions: ['ts', 'tsx', 'js'],
    transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest',
    },
    testMatch: ['**/tests/**/*.test.(ts|js)'],
    collectCoverageFrom: [
        'tests/**/*.{ts,js}',
        '!tests/**/*.d.ts',
    ],
    transformIgnorePatterns: [
        'node_modules/(?!(chai)/)',
    ],
    globals: {
        'ts-jest': {
            useESM: false,
            tsconfig: {
                module: 'commonjs',
                esModuleInterop: true,
                allowSyntheticDefaultImports: true,
            },
        },
    },
    testTimeout: 60000, // 60 seconds for blockchain tests
}; 