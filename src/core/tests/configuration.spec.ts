import { expect } from 'chai'

import { buildConfiguration } from '../configuration'

describe('configuration module', () => {
  const clientToken = 'some_client_token'

  it('build the configuration correct endpoints', () => {
    let configuration = buildConfiguration({ clientToken })
    expect(configuration.logsEndpoint).includes(clientToken)

    // TO KISS we check that rum and internal monitoring endpoints can NOT be overridden with the regular bundle
    // (a.k.a not "e2e-test"). It's not ideal since we don't test the other behavior but there's no easy way to
    // mock the `buildEnv` since it's provided by Webpack and having an extra series of tests on the other bundle
    // seems overkill given the few lines of code involved.
    const endpoint = 'bbbbbbbbbbbbbbb'
    configuration = buildConfiguration({ clientToken, rumEndpoint: endpoint, internalMonitoringEndpoint: endpoint })
    expect(configuration.rumEndpoint).not.equal(endpoint)
    expect(configuration.internalMonitoringEndpoint).not.equal(endpoint)
  })

  it('build the configuration correct monitoring endpoint', () => {
    let configuration = buildConfiguration({ clientToken })
    expect(configuration.internalMonitoringEndpoint).undefined

    configuration = buildConfiguration({ clientToken, internalMonitoringApiKey: clientToken })
    expect(configuration.internalMonitoringEndpoint).includes(clientToken)
  })

  it('build the configuration isCollectingError', () => {
    let configuration = buildConfiguration({ clientToken })
    expect(configuration.isCollectingError).true

    configuration = buildConfiguration({ clientToken, isCollectingError: false })
    expect(configuration.isCollectingError).false
  })
})
