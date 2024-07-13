'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import crypto from 'hypercore-crypto'
import WebSocketStream from '@/lib/wss'
import NotSecretStream from 'not-secret-stream'
import b4a from 'b4a'
import Corestore from 'corestore'
import ram from 'random-access-memory'
import Protomux from 'protomux'
import RPC from 'protomux-rpc'
import JRPC from '@/lib/jrpc'
import BufferMap from 'tiny-buffer-map'
import clsx from 'clsx'

const keyPair = crypto.keyPair()
const keystr = b4a.toString(keyPair.publicKey, 'hex')
const store = new Corestore(ram.reusable())
const core = store.get({ keyPair, valueEncoding: 'json' })
const conns = new BufferMap()

export default function Home() {
  const [count, setCount] = useState(0)
  const [counts, setCounts] = useState([])

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3000/pear')
    const wss = new WebSocketStream(ws)
    const framed = new NotSecretStream(wss, { keyPair })
    const mux = Protomux.from(framed)
    const rpc = new JRPC(new RPC(mux))

    store.replicate(mux)

    const stream = core.createReadStream({ live: true })
    stream.on('data', ondata)

    function ondata ({ count }) { setCount(count) }

    rpc.respond('announce', async ({ publicKey: keystr }) => {
      console.log('hi 🍐!', keystr)
      const publicKey = b4a.from(keystr, 'hex')
      const core = store.get({ keyPair: { publicKey }, valueEncoding: 'json' })
      await core.ready()
      const stream = core.createReadStream({ live: true })
      stream.on('data', ondata)
      stream.on('error', noop)

      conns.set(publicKey, core)

      counts.push({ keystr, count })
      setCounts([...counts])

      function ondata ({ count }) {
        const counter = counts.find((count) => count.keystr === keystr)
        console.log('found', count)
        counter.count = count
        setCounts([ ...counts])
      }

      return { ok: true }
    })

    rpc.respond('unannounce', async ({ publicKey: keystr }) => {
      console.log('bye 🍐!', keystr)
      const publicKey = b4a.from(keystr, 'hex')
      const core = conns.get(publicKey, { valueEncoding: 'json' })
      await core?.close()

      conns.delete(publicKey)
      const index = counts.findIndex((c) => c.keystr === keystr)
      counts.splice(index, 1)
      setCounts([...counts])

      return { ok: true }
    })
  }, [])

  function onclick () {
    core.append({ count: count + 1 })
  }

  console.log('counts', counts)
  
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24 gap-4">
      <div className="w-full mb-8">
        <h1 className="mb-2 w-full text-2xl">Leaderboard</h1>
        <p>Click the green one to stay in the lead, open more tabs to add players!</p>
      </div>
      {
        counts
          .filter(({ count }) => count !== null)
          .concat({ keystr, count })
          .sort(({ count: fst }, { count: snd }) => snd - fst)
          .map((counter, i) => {
            return (
              <div key={i} className={clsx(
                'select-none cursor-pointer rounded-xl relative p-2 w-full h-24 white text-wrap flex justify-around items-center',
                (counter.keystr === keystr) ? 'bg-green-500 active:bg-green-400' :'bg-red-500',
              )} onClick={(counter.keystr === keystr) ? onclick : noop}>
                <h1 className="break-all" suppressHydrationWarning>{counter.keystr}</h1>
                <code className="text-4xl">{counter.count}</code>
              </div>
            )
          })
      }
    </main>
  );
}

function noop () {}
