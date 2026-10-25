import { afterEach, expect } from 'vitest';
import { cleanup, configure } from '@testing-library/react';
import * as axeMatchers from 'vitest-axe/matchers';
import '@testing-library/jest-dom/vitest';

expect.extend(axeMatchers);

// Render every test in StrictMode to surface unsafe effects.
// A busy machine running many test files at once can take longer than the 1 s default.
configure({ reactStrictMode: true, asyncUtilTimeout: 3000 });

afterEach(() => cleanup());
