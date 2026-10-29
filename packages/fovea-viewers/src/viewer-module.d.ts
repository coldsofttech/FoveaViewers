// The viewers are optional peer dependencies and depend on this package, so their types are not
// followed when this package is type-checked (see `paths` in tsconfig.build.json).
declare const viewer: Record<string, any>;
export = viewer;
