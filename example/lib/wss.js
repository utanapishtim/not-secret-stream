import { Duplex } from 'streamx'
import buffer from 'b4a'

export default class WebsocketStream extends Duplex {
  constructor (socket) {
    super()

    const isWeb = typeof socket.addEventListener === 'function'
    const listen = (socket, ev, listener) => {
      socket[isWeb ? 'addEventListener' : 'on'](ev, listener)
    }

    const unlisten = (socket, ev, listener) => {
      socket[isWeb ? 'removeEventListener' : 'off'](ev, listener)
    }

    this._socket = socket
    this._socket.binaryType = 'arraybuffer'

    this._opening = null

    this._onError = onError.bind(this)
    this._onClose = onClose.bind(this, unlisten)
    this._onOpen = onOpen.bind(this)
    this._onMessage = onMessage.bind(this)

    listen(this._socket, 'error', this._onError)
    listen(this._socket, 'close', this._onClose)
    listen(this._socket, 'open', this._onOpen)
    listen(this._socket, 'message', this._onMessage)
  }

  _open (cb) {
    if (this._socket.readyState > 1) cb(new Error('Socket is closed'))
    else if (this._socket.readyState < 1) this._opening = cb
    else cb(null)
  }

  _continueOpen (err) {
    if (err) this.destroy(err)

    const cb = this._opening

    if (cb) {
      this._opening = null
      this._open(cb)
    }
  }

  _write (data, cb) {
    this._socket.send(data)
    cb(null)
  }

  _predestroy () {
    this._continueOpen(new Error('Socket was destroyed'))
  }

  _destroy (cb) {
    this._socket.close()
    cb(null)
  }
}

function onError (err) {
  this.destroy(err)
}

function onClose (unlisten, reason) {
  unlisten(this._socket, 'error', this._onError)
  unlisten(this._socket, 'close', this._onClose)
  unlisten(this._socket, 'open', this._onOpen)
  unlisten(this._socket, 'message', this._onMessage)

  this.destroy(reason)
}

function onOpen () {
  this._continueOpen()
}

function onMessage (event) {
  this.push(buffer.from(event.data))
}
