/**
 * Certain tests copied verbatim from: 
 * 
 *     https://github.com/holepunchto/framed-stream/blob/main/test.js
 * 
 * Copyright 2024 Holepunch
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const ram = require('random-access-memory')
const Corestore = require('corestore')
const NotSecretStream = require('./index.js')
const test = require('brittle')
const duplexThrough = require('duplex-through')
const b4a = require('b4a')

test('close event if raw stream is destroyed', function (t) {
  t.plan(5)

  const [a, b] = create()

  a.rawStream.on('close', () => t.pass('a rawStream closed'))
  b.rawStream.on('close', () => t.pass('b rawStream closed'))

  a.on('error', (err) => t.is(err.message, 'Pair was destroyed', err.message))

  a.on('close', () => t.pass('a closed'))
  b.on('close', () => t.pass('b closed'))

  b.rawStream.destroy()
})

test('forward errors when both sides are destroyed', function (t) {
  t.plan(8)

  const [a, b] = create()

  const errorA = new Error('error-a')
  const errorB = new Error('error-b')
  a.destroy(errorA)
  b.destroy(errorB)

  a.rawStream.on('error', (err) => t.is(err, errorA, 'a rawStream: ' + err.message))
  b.rawStream.on('error', (err) => t.is(err.message, 'Pair was destroyed', 'b rawStream: ' + err.message))

  a.on('error', (err) => t.is(err, errorA, 'a error: ' + err.message))
  b.on('error', (err) => t.is(err, errorB, 'b error: ' + err.message))

  a.rawStream.on('close', () => t.pass('a rawStream closed'))
  b.rawStream.on('close', () => t.pass('b rawStream closed'))

  a.on('close', () => t.pass('a closed'))
  b.on('close', () => t.pass('b closed'))
})

test('forward errors when one side is destroyed', function (t) {
  t.plan(8)

  const [a, b] = create()

  const errorA = new Error('error-a')
  a.destroy(errorA)

  a.rawStream.on('error', (err) => t.is(err, errorA, 'a rawStream: ' + err.message))
  b.rawStream.on('error', (err) => t.is(err.message, 'Pair was destroyed', 'b rawStream: ' + err.message))

  a.on('error', (err) => t.is(err, errorA, 'a error: ' + err.message))
  b.on('error', (err) => t.is(err.message, 'Pair was destroyed', 'b error: ' + err.message))

  a.rawStream.on('close', () => t.pass('a rawStream closed'))
  b.rawStream.on('close', () => t.pass('b rawStream closed'))

  a.on('close', () => t.pass('a closed'))
  b.on('close', () => t.pass('b closed'))
})

test('replicate hyperocres', async function (t) {
  t.plan(1)
  const [nss1, nss2] = create()
  const [cs1, cs2] = stores()

  cs1.replicate(nss1)
  cs2.replicate(nss2)

  const c1 = cs1.get({ name: 'test' })
  await c1.ready()
  const c2 = cs2.get(c1.key)
  await c2.ready()

  await c1.append(Buffer.from('hello'))
  const v1 = await c1.get(0)
  const v2 = await c2.get(0)

  t.ok(!b4a.compare(v1, v2))
})

function create (opts = {}) {
  const pair = duplexThrough()

  const a = new NotSecretStream(pair[0], opts)
  const b = new NotSecretStream(pair[1], opts)

  return [a, b]
}

function stores () {
  const a = new Corestore(ram)
  const b = new Corestore(ram)
  return [a, b]
}
