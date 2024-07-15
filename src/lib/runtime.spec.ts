/**
 * @vitest-environment jsdom
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  vi
} from 'vitest';

const USER_AGENTS = {
  CHROME_DESKTOP: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36',
  MOBILE_SAFARI: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.5 Mobile/15E148 Safari/604.1'
};

function setUserAgent(value = '') {
  Object.defineProperty(navigator, 'userAgent', {
    value,
    configurable: true
  });
}

vi.mock('react-dom/client', () => {
  const render = vi.fn();
  const createRoot = vi.fn(() => ({ render, unmount: vi.fn() }));
  return { createRoot, _render: render };
});

beforeEach(() => {
  vi.resetModules();
});

describe('injectScript', () => {
  it('should add a script tag to the document', async () => {
    const { injectScript } = await import('lib/runtime');
    const src = 'https://src.foo/';
    const promise = injectScript(src);
    const scriptTag = document.head.querySelector('script');
    if (!scriptTag) throw new Error('No <script> tag found.');
    scriptTag.dispatchEvent(new Event('load'));
    await promise;
    expect(scriptTag.src).toBe(src);
    expect(scriptTag.async).toBe(true);
  });
});

describe('assertIsBrowser', () => {
  describe('when in a browser', () => {
    beforeAll(() => {
      setUserAgent();
    });
    it('should not throw', async () => {
      const { assertIsBrowser } = await import('lib/runtime');
      expect(() => {
        assertIsBrowser();
      }).not.toThrow();
    });
  });
  describe('when not in a browser', () => {
    beforeAll(() => {
      Object.defineProperty(navigator, 'userAgent', {
        value: undefined,
        configurable: true
      });
    });
    it('should throw', async () => {
      const { assertIsBrowser } = await import('lib/runtime');
      expect(() => {
        assertIsBrowser();
      }).toThrow();
      const label = 'label';
      expect(() => {
        assertIsBrowser(label);
      }).toThrow('label');
    });
  });
});

describe('render', () => {
  beforeAll(() => {
    setUserAgent();
  });
  describe('when provided a non-existent DOM node', () => {
    it('should throw', async () => {
      const { render } = await import('lib/runtime');
      expect(() => {
        render('foo', {} as JSX.Element);
      }).toThrow('could not be found');
    });
  });
  describe('when provided an existing DOM node', () => {
    const REACT_APP = {} as JSX.Element;
    const ROOT_EL = document.createElement('div');
    ROOT_EL.id = 'root';
    beforeAll(() => {
      document.body.append(ROOT_EL);
    });
    it('should not throw', async () => {
      const { render } = await import('lib/runtime');
      const reactDomMock = await import('react-dom/client');
      const {
        createRoot: createRootMock,
        // @ts-expect-error - This member only exists on our mock.
        _render: renderMock
      } = reactDomMock;
      expect(() => {
        render('#root', REACT_APP);
      }).not.toThrow();
      expect(createRootMock).toHaveBeenCalledWith(ROOT_EL);
      expect(renderMock).toHaveBeenLastCalledWith(REACT_APP);
    });
  });
});

describe('getPlatformDetails', () => {
  beforeAll(() => {
    setUserAgent(USER_AGENTS.CHROME_DESKTOP);
  });
  it('should return platform details', async () => {
    const { getPlatformDetails } = await import('lib/runtime');
    const details = getPlatformDetails();
    expect(details.browser.name).toBe('Chrome');
    expect(details.os.name).toBe('macOS');
    expect(details.platform.type).toBe('desktop');
  });
});

describe('isMobile', () => {
  describe('when on a mobile platform', () => {
    beforeAll(() => {
      setUserAgent(USER_AGENTS.MOBILE_SAFARI);
    });
    it('should return true', async () => {
      const { isMobile } = await import('lib/runtime');
      expect(isMobile()).toBe(true);
    });
  });
  describe('when not on a mobile platform', () => {
    beforeAll(() => {
      setUserAgent(USER_AGENTS.CHROME_DESKTOP);
    });
    it('should return false', async () => {
      const { isMobile } = await import('lib/runtime');
      expect(isMobile()).toBe(false);
    });
  });
});

describe('isStandalone', () => {
  describe('when in standalone mode', () => {
    it('should return true', async () => {
      const { isStandalone } = await import('lib/runtime');
      Object.defineProperty(navigator, 'standalone', {
        value: true,
        configurable: true
      });
      expect(isStandalone()).toBe(true);
    });
  });
  describe('when not in standalone mode', () => {
    it('should return false', async () => {
      const { isStandalone } = await import('lib/runtime');
      Object.defineProperty(navigator, 'standalone', {
        value: false,
        configurable: true
      });
      expect(isStandalone()).toBe(false);
    });
  });
});
