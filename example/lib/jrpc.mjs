import c from 'compact-encoding'

export default class JRPC {
  static get options () {
    return {
      requestEncoding: c.json,
      responseEncoding: c.json,
    }
  }
  constructor (rpc) {
    this.rpc = rpc
  }

  request (name, data) {
    return this.rpc.request(name, data, JRPC.options)
  }

  respond (name, handler) {
    return this.rpc.respond(name, JRPC.options, handler)
  }
}