import '@testing-library/jest-dom';

// jsdom does not define TextEncoder/TextDecoder; polyfill them from Node's
// built-in 'util' module so packages that use them at module-load time work.
import { TextEncoder, TextDecoder } from 'util';
Object.assign(global, { TextEncoder, TextDecoder });

// Mantine's SegmentedControl/FloatingIndicator uses ResizeObserver internally.
// jsdom does not implement it, so provide a no-op stub.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.assign(global, { ResizeObserver: ResizeObserverStub });

// jsdom's URLSearchParams omits the .size getter (added in browsers/Node 19+).
// The api-client uses params.size to decide whether to append a query string.
if (!Object.getOwnPropertyDescriptor(URLSearchParams.prototype, 'size')) {
  Object.defineProperty(URLSearchParams.prototype, 'size', {
    get(this: URLSearchParams) {
      let count = 0;
      this.forEach(() => {
        count++;
      });
      return count;
    },
    configurable: true,
  });
}
