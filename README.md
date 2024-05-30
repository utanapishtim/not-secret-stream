# Not Secret Stream

An **unencrypted** interface compatible, drop-in replacement for [`SecretStream`](https://github.com/holepunchto/hyperswarm-secret-stream) when you don't need the encryption and want to replicate hypercores (corestores) to/from the browser.

Some cryptographic primitives needed to implement noise encryption in the browser are not implemented in `sodium-javascript` preventing easy replication of hypercores in that environment, while `dht-relay` exists it is marked experimental and **do not use in production**. This is a simpler and explicitly unsafe alternative that allows replicating hypercores in the browser over websockets (ssl/tls) or webrtc (SRTP) using their standard encryption protocols. 

YMMV.

## Install

`npm i -S not-secret-stream`

## Usage

```js
const NotSecretStream = require('not-secret-stream')
const duplexThrough = require('duplex-through')
const Corestore = require('corestore')
const ram = require('random-access-memory')
const b4a = require('b4a')

const [a, b] = duplexThrough()

const fst = new NotSecretStream(a)
const snd = new NotSecretStream(b)

const storeA = new Corestore(ram)
const storeB = new Corestore(ram)

storeA.replicate(fst)
storeB.replicate(snd)

const primary = storeA.get({ name: 'test' })
await primary.ready()
const replica = storeB.get(primary.key)

await primary.append(b4a.from('hello, world!'))
const buf = await replica.get(0)
console.log(b4a.toString(buf, 'utf8')) // 'hello, world!'
```

## API

`const s = new NotSecretStream(rawStream, [options])`

Make a new not secret stream instance that is interface compatible with `SecretStream` from `@hyperswarm/secret-stream`.

Options include:

```js
{
  keyPair: { publicKey, secretKey }, // if you want to use your own keyPair for the "handshake", secretKey is not leaked but publicKey is,
  bits: 32 // the frame size of the underlying FramedStream, see https://github.com/holepunchto/framed-stream
}
```
