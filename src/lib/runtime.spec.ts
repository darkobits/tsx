/**
 * @jest-environment jsdom
 */


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


jest.mock('react-dom/client', () => {
  const render = jest.fn();
  const createRoot = jest.fn(() => ({ render, unmount: jest.fn() }));
  return { createRoot, _render: render };
});


beforeEach(() => {
  jest.resetModules();
  // console.warn('hej!');
});


describe('injectScript', () => {
  let injectScript: typeof import('./runtime').injectScript;

  beforeAll(async () => {
    injectScript = (await import('./runtime')).injectScript;
  });

  it('should add a script tag to the document', async () => {
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
  let assertIsBrowser: typeof import('./runtime').assertIsBrowser;

  beforeAll(async () => {
    assertIsBrowser = (await import('./runtime')).assertIsBrowser;
  });

  describe('when in a browser', () => {
    beforeAll(() => {
      setUserAgent();
    });

    it('should not throw', () => {
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

    it('should throw', () => {
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
  let render: typeof import('./runtime').render;
  let createRootMock: jest.Mocked<typeof import('react-dom/client').createRoot>;
  let renderMock: jest.Mocked<ReturnType<typeof createRootMock>['render']>;

  beforeAll(async () => {
    setUserAgent();
    render = (await import('./runtime')).render;
    createRootMock = Reflect.get(await import('react-dom/client'), 'createRoot');
    renderMock = Reflect.get(await import('react-dom/client'), '_render');
  });

  describe('when provided a non-existent DOM node', () => {
    it('should throw', () => {
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

    it('should not throw', () => {
      expect(() => {
        render('#root', REACT_APP);
      }).not.toThrow();

      expect(createRootMock).toHaveBeenCalledWith(ROOT_EL);
      expect(renderMock).toHaveBeenLastCalledWith(REACT_APP);
    });
  });
});


describe('getPlatformDetails', () => {
  let getPlatformDetails: typeof import('./runtime').getPlatformDetails;

  beforeAll(async () => {
    setUserAgent(USER_AGENTS.CHROME_DESKTOP);
    getPlatformDetails = Reflect.get(await import('./runtime'), 'getPlatformDetails');
  });

  it('should return platform details', () => {
    const details = getPlatformDetails();
    expect(details.browser.name).toBe('Chrome');
    expect(details.os.name).toBe('macOS');
    expect(details.platform.type).toBe('desktop');
  });
});


describe('isMobile', () => {
  let isMobile: typeof import('./runtime').isMobile;

  describe('when on a mobile platform', () => {
    beforeAll(async () => {
      setUserAgent(USER_AGENTS.MOBILE_SAFARI);
      isMobile = Reflect.get(await import('./runtime'), 'isMobile');
    });

    it('should return true', () => {
      expect(isMobile()).toBe(true);
    });
  });

  describe('when not on a mobile platform', () => {
    beforeAll(async () => {
      setUserAgent(USER_AGENTS.CHROME_DESKTOP);
      isMobile = Reflect.get(await import('./runtime'), 'isMobile');
    });

    it('should return false', () => {
      expect(isMobile()).toBe(false);
    });
  });
});


describe('isStandalone', () => {
  let isStandalone: typeof import('./runtime').isStandalone;

  beforeAll(async () => {
    isStandalone = Reflect.get(await import('./runtime'), 'isStandalone');
  });

  describe('when in standalone mode', () => {
    it('should return true', () => {
      Object.defineProperty(navigator, 'standalone', {
        value: true,
        configurable: true
      });

      expect(isStandalone()).toBe(true);
    });
  });

  describe('when not in standalone mode', () => {
    it('should return false', () => {
      Object.defineProperty(navigator, 'standalone', {
        value: false,
        configurable: true
      });

      expect(isStandalone()).toBe(false);
    });
  });
});
