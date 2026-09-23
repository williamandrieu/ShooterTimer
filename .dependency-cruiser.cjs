/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'domain-no-outer-layers',
      comment: 'domain must stay pure',
      severity: 'error',
      from: { path: '^src/domain' },
      to: { path: '^src/(infra|ui|application|hooks|app|i18n)' },
    },
    {
      name: 'application-no-infra',
      severity: 'error',
      from: { path: '^src/application' },
      to: { path: '^src/infra' },
    },
    {
      name: 'ui-no-infra',
      severity: 'error',
      from: { path: '^src/ui' },
      to: { path: '^src/infra' },
    },
    {
      name: 'domain-no-react',
      severity: 'error',
      from: { path: '^src/domain' },
      to: { path: 'node_modules/react(/|$)' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.app.json' },
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.js'],
    },
  },
};
