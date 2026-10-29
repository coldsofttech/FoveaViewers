import { afterEach, expect } from 'vitest';
import { cleanup, configure } from '@testing-library/react';
import * as axeMatchers from 'vitest-axe/matchers';
import '@testing-library/jest-dom/vitest';

expect.extend(axeMatchers);

// Render every test in StrictMode to surface unsafe effects.
// A busy machine (a CI runner with coverage on) running many test files at once can take much
// longer than the 1 s default. A wait only lasts this long when something is wrong.
configure({ reactStrictMode: true, asyncUtilTimeout: 10000 });

afterEach(() => cleanup());
