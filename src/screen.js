'use strict'

function termwidth (stream) {
  if (!stream.isTTY) return 80
  let width = stream.getWindowSize()[0]
  return width < 30 ? 30 : width
}

module.exports = {
  stdtermwidth: termwidth(process.stdout),
  errtermwidth: termwidth(process.stderr)
}
