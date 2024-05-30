const FramedStream = require('framed-stream')
const crypto = require('hypercore-crypto')
const b4a = require('b4a')
const { Duplex, getStreamError } = require('streamx')
const cenc = require('compact-encoding')

module.exports = class NotSecretStream extends Duplex {
  publicKey = null        // hss compat
  remotePublicKey = null  // hss compat
  handshakeHash = null    // hss compat
  userData = null         // hss compat
  opened = null           // hss compat
  noiseStream = null      // hss compat

  rawStream = null        
  framedStream = null

  _writeCallback = null
  _resolveOpened = null
  _ended = 2
  _handshakeState = 0

  constructor (rawStream, { bits = 32, keyPair = {} } = {}) {
    super()
    this.rawStream = rawStream
    this.framedStream = new FramedStream(this.rawStream, { bits }) 
    this.noiseStream = this
    this.publicKey = keyPair?.publicKey ?? crypto.keyPair().publicKey
    this.handshakeHash = b4a.allocUnsafeSlow(64) // got to be buf size 64 and the same on both sides
    this.opened = new Promise((_resolveOpened) => Object.assign(this, { _resolveOpened }))
    this.handshaker = this._handshaker.bind(this)

    this.framedStream.on('end', this._onend.bind(this))
    this.framedStream.on('error', this._onerror.bind(this))
    this.framedStream.on('close', this._onclose.bind(this))
  }

  get setKeepAlive () { return noop }

  async _open (cb) {
    this.framedStream.on('data', this.handshaker)
    this.framedStream.write(cenc.encode(cenc.fixed32, this.publicKey))
    this.once('handshake', cb)
  }

  _handshaker (buf) {
    switch (this._handshakeState) {
      case 0:
        this.remotePublicKey = cenc.decode(cenc.fixed32, buf)
        const [fst, snd] = ([this.publicKey, this.remotePublicKey]).sort((x, y) => b4a.compare(x, y))
        this.handshakeHash.set(fst, 0)
        this.handshakeHash.set(snd, 32)
        this.framedStream.write(cenc.encode(cenc.fixed64, this.handshakeHash))
        this._handshakeState = 1
        break
      case 1:
        const remoteHandshakeHash = cenc.decode(cenc.fixed64, buf)
        if (b4a.compare(remoteHandshakeHash, this.handshakeHash) !== 0) {
          this._resolveOpened(false)
          this.emit('handshake', new Error(`handshake failed`))
          this._handshakeState = 2
        }
        this.framedStream.off('data', this.handshaker)
        this._attach()
        this._resolveOpened(true)
        this.emit('handshake', null)
        this._handshakeState = 2
      default:
        this.emit('handshake', new Error(`the unreachable was reached`))
    }
  }

  _attach () {
    this.framedStream.on('data', this._ondata.bind(this))
    this.framedStream.on('drain', this._ondrain.bind(this))
  }

  _maybeContinue (err) {
    const cb = this._writeCallback
    this._writeCallback = null
    if (cb !== null) cb(err)
  }

  // stream method implementations

  _predestroy () {
    this.framedStream.destroy(getStreamError(this))

    this._maybeContinue(new Error('Stream destroyed'))
  }

  _read (cb) {
    this.framedStream.resume()
    return cb(null)
  }

  _write (data, cb) {
    if (this.framedStream.write(data) === true) return cb(null)
    this._writeCallback = cb
  }

  _final (cb) {
    this._ended--
    this.framedStream.end()
    return cb(null)
  }

  // inner stream handlers

  _onend () {
    this._ended--
    this.push(null)
  }

  _onclose () {
    if (this._ended !== 0) this.destroy()
  }

  _onerror (err) {
    this.destroy(err)
  }

  _ondata (data) {
    this.push(data)
  }

  _ondrain () {
    this._maybeContinue(null)
  }
}

function noop () {}
