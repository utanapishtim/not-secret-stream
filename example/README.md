# Not Secret Stream Example

An example of replicating hypercores across websockets using `not-secret-stream`. Wraps the websocket with a `not-secret-stream` and wraps the `not-secret-stream` in a protomux instance. Replicates a `corestore` over the mux instance as well as runs `protomux-rpc` to signal which cores to open.

## Usage
`npm run dev`

## TODO
- would love to refactor this out in a template for web-based projects in the `pear` world.
