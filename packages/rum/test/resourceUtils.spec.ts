import { Configuration, DEFAULT_CONFIGURATION, SPEC_ENDPOINTS } from '@datadog/browser-core'
import { RumPerformanceResourceTiming } from '../src/performanceCollection'
import {
  computePerformanceResourceDetails,
  computePerformanceResourceDuration,
  shouldTrackResource,
} from '../src/resourceUtils'
import { RumSession } from '../src/rumSession'

function generateResourceWith(overrides: Partial<RumPerformanceResourceTiming>) {
  const completeTiming: Partial<RumPerformanceResourceTiming> = {
    connectEnd: 17,
    connectStart: 15,
    domainLookupEnd: 14,
    domainLookupStart: 13,
    duration: 50,
    entryType: 'resource',
    fetchStart: 12,
    name: 'entry',
    redirectEnd: 11,
    redirectStart: 10,
    requestStart: 20,
    responseEnd: 60,
    responseStart: 50,
    secureConnectionStart: 16,
    startTime: 10,
    ...overrides,
  }
  return completeTiming as RumPerformanceResourceTiming
}

describe('computePerformanceResourceDetails', () => {
  it('should not compute entry without detailed timings', () => {
    expect(
      computePerformanceResourceDetails(
        generateResourceWith({
          connectEnd: 0,
          connectStart: 0,
          domainLookupEnd: 0,
          domainLookupStart: 0,
          redirectEnd: 0,
          redirectStart: 0,
          requestStart: 0,
          responseStart: 0,
          secureConnectionStart: 0,
        })
      )
    ).toBeUndefined()
  })

  it('should compute timings from entry', () => {
    expect(computePerformanceResourceDetails(generateResourceWith({}))).toEqual({
      connect: { start: 5e6, duration: 2e6 },
      dns: { start: 3e6, duration: 1e6 },
      download: { start: 40e6, duration: 10e6 },
      firstByte: { start: 10e6, duration: 30e6 },
      redirect: { start: 0, duration: 1e6 },
      ssl: { start: 6e6, duration: 1e6 },
    })
  })

  it('should not compute redirect timing when no redirect', () => {
    expect(
      computePerformanceResourceDetails(
        generateResourceWith({
          fetchStart: 10,
          redirectEnd: 0,
          redirectStart: 0,
        })
      )
    ).toEqual({
      connect: { start: 5e6, duration: 2e6 },
      dns: { start: 3e6, duration: 1e6 },
      download: { start: 40e6, duration: 10e6 },
      firstByte: { start: 10e6, duration: 30e6 },
      ssl: { start: 6e6, duration: 1e6 },
    })
  })

  it('should not compute dns timing when persistent connection or cache', () => {
    expect(
      computePerformanceResourceDetails(
        generateResourceWith({
          domainLookupEnd: 12,
          domainLookupStart: 12,
          fetchStart: 12,
        })
      )
    ).toEqual({
      connect: { start: 5e6, duration: 2e6 },
      download: { start: 40e6, duration: 10e6 },
      firstByte: { start: 10e6, duration: 30e6 },
      redirect: { start: 0, duration: 1e6 },
      ssl: { start: 6e6, duration: 1e6 },
    })
  })

  it('should not compute ssl timing when no secure connection', () => {
    expect(
      computePerformanceResourceDetails(
        generateResourceWith({
          secureConnectionStart: 0,
        })
      )
    ).toEqual({
      connect: { start: 5e6, duration: 2e6 },
      dns: { start: 3e6, duration: 1e6 },
      download: { start: 40e6, duration: 10e6 },
      firstByte: { start: 10e6, duration: 30e6 },
      redirect: { start: 0, duration: 1e6 },
    })
  })

  it('should not compute ssl timing when persistent connection', () => {
    expect(
      computePerformanceResourceDetails(
        generateResourceWith({
          connectEnd: 12,
          connectStart: 12,
          domainLookupEnd: 12,
          domainLookupStart: 12,
          fetchStart: 12,
          secureConnectionStart: 12,
        })
      )
    ).toEqual({
      download: { start: 40e6, duration: 10e6 },
      firstByte: { start: 10e6, duration: 30e6 },
      redirect: { start: 0, duration: 1e6 },
    })
  })

  it('should not compute connect timing when persistent connection', () => {
    expect(
      computePerformanceResourceDetails(
        generateResourceWith({
          connectEnd: 12,
          connectStart: 12,
          domainLookupEnd: 12,
          domainLookupStart: 12,
          fetchStart: 12,
          secureConnectionStart: 0,
        })
      )
    ).toEqual({
      download: { start: 40e6, duration: 10e6 },
      firstByte: { start: 10e6, duration: 30e6 },
      redirect: { start: 0, duration: 1e6 },
    })
  })
  ;[
    {
      connectEnd: 10,
      connectStart: 20,
      reason: 'connectStart > connectEnd',
    },
    {
      domainLookupEnd: 10,
      domainLookupStart: 20,
      reason: 'domainLookupStart > domainLookupEnd',
    },
    {
      reason: 'responseStart > responseEnd',
      responseEnd: 10,
      responseStart: 20,
    },
    {
      reason: 'requestStart > responseStart',
      requestStart: 20,
      responseStart: 10,
    },
    {
      reason: 'redirectStart > redirectEnd',
      redirectEnd: 10,
      redirectStart: 20,
    },
    {
      connectEnd: 10,
      reason: 'secureConnectionStart > connectEnd',
      secureConnectionStart: 20,
    },
  ].forEach(({ reason, ...overrides }) => {
    it(`should not compute entry when ${reason}`, () => {
      expect(computePerformanceResourceDetails(generateResourceWith(overrides))).toBeUndefined()
    })
  })

  it('should allow really fast document resource', () => {
    expect(
      computePerformanceResourceDetails(
        generateResourceWith({
          connectEnd: 10,
          connectStart: 10,
          domainLookupEnd: 10,
          domainLookupStart: 10,
          fetchStart: 10,
          redirectEnd: 0,
          redirectStart: 0,
          requestStart: 10,
          responseEnd: 50,
          responseStart: 40,
          secureConnectionStart: 0,
        })
      )
    ).toEqual({
      download: { start: 30e6, duration: 10e6 },
      firstByte: { start: 0, duration: 30e6 },
    })
  })

  it('should use startTime and fetchStart as fallback for redirectStart and redirectEnd', () => {
    expect(
      computePerformanceResourceDetails(
        generateResourceWith({
          redirectEnd: 0,
          redirectStart: 0,
        })
      )
    ).toEqual({
      connect: { start: 5e6, duration: 2e6 },
      dns: { start: 3e6, duration: 1e6 },
      download: { start: 40e6, duration: 10e6 },
      firstByte: { start: 10e6, duration: 30e6 },
      redirect: { start: 0, duration: 2e6 },
      ssl: { start: 6e6, duration: 1e6 },
    })
  })
})

describe('computePerformanceResourceDuration', () => {
  it('should return the entry duration', () => {
    expect(computePerformanceResourceDuration(generateResourceWith({}))).toBe(50e6)
  })

  it('should use other available timing if the duration is 0', () => {
    expect(computePerformanceResourceDuration(generateResourceWith({ duration: 0 }))).toBe(50e6)
  })
})

describe('shouldTrackResource', () => {
  const configuration: Partial<Configuration> = {
    ...DEFAULT_CONFIGURATION,
    ...SPEC_ENDPOINTS,
  }

  function createSession({ isTrackedWithResource }: { isTrackedWithResource: boolean }): RumSession {
    return {
      getId: () => '123',
      isTracked: () => true,
      isTrackedWithResource: () => isTrackedWithResource,
    }
  }

  it('should exclude requests on intakes endpoints', () => {
    expect(
      shouldTrackResource(
        'https://rum-intake.com/abcde?foo=bar',
        configuration as Configuration,
        createSession({ isTrackedWithResource: true })
      )
    ).toBe(false)
  })

  it('should exclude requests on intakes endpoints with different client parameters', () => {
    expect(
      shouldTrackResource(
        'https://rum-intake.com/wxyz?foo=qux',
        configuration as Configuration,
        createSession({ isTrackedWithResource: true })
      )
    ).toBe(false)
  })

  it('should allow requests on non intake domains', () => {
    expect(
      shouldTrackResource(
        'https://my-domain.com/hello?a=b',
        configuration as Configuration,
        createSession({ isTrackedWithResource: true })
      )
    ).toBe(true)
  })

  it('should exclude requests if session does not track requests', () => {
    expect(
      shouldTrackResource(
        'https://my-domain.com/hello?a=b',
        configuration as Configuration,
        createSession({ isTrackedWithResource: false })
      )
    ).toBe(false)
  })
})
