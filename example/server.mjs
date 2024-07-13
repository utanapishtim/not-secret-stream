import Fastify from 'fastify'
import pino from 'pino'
import FastifyWebsocket from '@fastify/websocket'
import httpProxy from 'http-proxy'
import { parse } from 'url'
import createNext from 'next'
import NotSecretStream from 'not-secret-stream'
import Corestore from 'corestore'
import ram from 'random-access-memory'
import crypto from 'hypercore-crypto'
import Protomux from 'protomux'
import RPC from 'protomux-rpc'
import { once } from 'events'
import JRPC from './lib/jrpc.mjs'
import BufferMap from 'tiny-buffer-map'
import b4a from 'b4a'
import ws from 'ws'

const host = 'localhost'
const keyPair = crypto.keyPair()
const store = new Corestore(ram.reusable())
const conns = new BufferMap()

const next = createNext({ 
  dev: process.env.NODE_ENV !== 'production', 
  hostname: host, 
  port: 3000 
})

const handle = next.getRequestHandler()
await next.prepare()

const app = Fastify({ logger: pino({ name: 'app' })  })
app.server.on('upgrade', onupgrade)
app.get('/*', onrequest)
await app.listen({ port: 3000 })

const svc = Fastify({ logger: pino({ name: 'service' }) })
await svc.register(FastifyWebsocket, { options: { maxPayload: 1024 * 1024 } })
svc.get('/*', { websocket: true }, onwebsocket)
await svc.listen({ port: 3001 })

const proxy = new httpProxy.createProxyServer({ target: { host, port: 3001 } })

function onupgrade (req, ...args) {
  const parsed = parse(req.url, true)
  const { pathname } = parsed
  if (pathname.startsWith('/pear')) proxy.ws(req, ...args)
}

async function onrequest (req, reply) {
  try {
    const parsed = parse(req.raw.url, true)
    const { pathname } = parsed
    if (!pathname.startsWith('/pear')) await handle(req.raw, reply.raw, parsed)
  } catch (err) {
    console.error(err)
    reply.status(500).send('internal server error')
  }
}

async function onwebsocket (conn) {
  const wss = ws.createWebSocketStream(conn)
  const framed = new NotSecretStream(wss, { keyPair })
  const mux = Protomux.from(framed)
  const rpc = new JRPC(new RPC(mux))
  
  store.replicate(mux)
  
  const [err] = await once(framed, 'handshake') 

  if (err) {
    console.error('handshake error', err)
    return conn.end(err)
  }

  const { remotePublicKey: publicKey } = framed
  const peer = { publicKey, conn, wss, framed, mux, rpc }
  conns.set(publicKey, peer)
  conn.on('close', async () => {
    const peer = conns.get(publicKey)
    conns.delete(publicKey)
    try { await unannounce(conns, peer) } catch {}
    for (const key in peer) peer[key] = null
  })

  try { await announce(conns, peer) } catch {}

  store.get(publicKey).createReadStream({ live: true }).on('data', noop) // mirror
}

async function announce (conns, conn) {
  for (const peer of conns.values()) {
    if (b4a.compare(peer.publicKey, conn.publicKey) === 0) continue
    await peer.rpc.request('announce', { publicKey: b4a.toString(conn.publicKey, 'hex') })
    await conn.rpc.request('announce', { publicKey: b4a.toString(peer.publicKey, 'hex') })
  }
}

async function unannounce (conns, conn) {
  for (const peer of conns.values()) {
    await peer.rpc.request('unannounce', { publicKey: b4a.toString(conn.publicKey, 'hex') })
  }
}

function noop () {}
