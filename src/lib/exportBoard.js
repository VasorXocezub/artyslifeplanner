// Draw the vision board to a PNG (cover images that block cross-origin reads are skipped, not fatal)
function loadImg(src) {
  return new Promise((resolve) => {
    const i = new Image()
    i.crossOrigin = 'anonymous'
    i.onload = () => resolve(i)
    i.onerror = () => resolve(null)
    i.src = src
  })
}

export async function exportBoardPng(items, { cols = 3, tile = 360, title = 'My Dream Board' } = {}) {
  const gap = 16, pad = 32, head = 90
  const h = Math.round(tile * 1.25)
  const rows = Math.max(1, Math.ceil(items.length / cols))
  const c = document.createElement('canvas')
  c.width = pad * 2 + cols * tile + (cols - 1) * gap
  c.height = head + pad + rows * h + (rows - 1) * gap
  const x = c.getContext('2d')
  x.fillStyle = '#FFF7F2'; x.fillRect(0, 0, c.width, c.height)
  x.fillStyle = '#6B1B3D'; x.font = 'bold 40px Georgia, serif'; x.textBaseline = 'middle'
  x.fillText(`${title} ✨`, pad, 50)
  for (let n = 0; n < items.length; n++) {
    const it = items[n]
    const tx = pad + (n % cols) * (tile + gap), ty = head + Math.floor(n / cols) * (h + gap)
    x.save()
    x.beginPath(); x.roundRect(tx, ty, tile, h, 24); x.clip()
    x.fillStyle = it.color || '#F6D0C8'; x.fillRect(tx, ty, tile, h)
    const img = it.image ? await loadImg(it.image) : null
    if (img) {
      const s = Math.max(tile / img.width, h / img.height)
      x.drawImage(img, tx + (tile - img.width * s) / 2, ty + (h - img.height * s) / 2, img.width * s, img.height * s)
    } else {
      x.font = '110px serif'; x.textAlign = 'center'; x.fillStyle = '#000'
      x.fillText(it.emoji || '✨', tx + tile / 2, ty + h / 2 - 20); x.textAlign = 'left'
    }
    const g = x.createLinearGradient(0, ty + h - 120, 0, ty + h)
    g.addColorStop(0, 'rgba(60,20,30,0)'); g.addColorStop(1, 'rgba(60,20,30,.75)')
    x.fillStyle = g; x.fillRect(tx, ty + h - 120, tile, 120)
    x.fillStyle = '#fff'; x.font = 'bold 26px sans-serif'
    x.fillText(it.title.length > 24 ? it.title.slice(0, 23) + '…' : it.title, tx + 20, ty + h - 44)
    x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(tx + 20, ty + h - 24, tile - 40, 8)
    x.fillStyle = '#fff'; x.fillRect(tx + 20, ty + h - 24, ((tile - 40) * it.pct) / 100, 8)
    x.restore()
  }
  const blob = await new Promise((res) => c.toBlob(res, 'image/png'))
  if (!blob) throw new Error("Couldn't build the image — try again without cover photos.")
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = 'dream-board.png'
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}
