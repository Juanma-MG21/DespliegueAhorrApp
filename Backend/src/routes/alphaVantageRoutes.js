const express = require('express')
const router = express.Router()

const API_KEY = process.env.FINNHUB_API_KEY || 'd7v307pr01qp7l70r6i0d7v307pr01qp7l70r6ig'

router.get('/bolsa/:symbol', async (req, res) => {
  const { symbol } = req.params

  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${API_KEY}`
    )
    const data = await response.json()
    if (!response.ok) {
      return res.json({
        ok: false,
        mensaje: data?.error || data?.message || 'Finnhub rechazo la solicitud',
      })
    }
    return res.json(data)

  } catch (error) {
    console.error('Error al consultar Finnhub:', error.message)
    return res.status(500).json({ ok: false, mensaje: 'Error al consultar bolsa' })
  }
})

router.get('/bolsa/trm/usd-cop', async (_req, res) => {
  try {
    const response = await fetch(
      `https://finnhub.io/api/v1/forex/rates?base=USD&token=${API_KEY}`
    )
    const data = await response.json()

    if (!response.ok || !data.quote?.COP) {
      return res.json({
        ok: false,
        mensaje: data?.error || data?.message || 'No se pudo consultar la TRM',
        trm: 4200,
      })
    }

    return res.json({ ok: true, trm: data.quote.COP })
  } catch (error) {
    console.error('Error al consultar TRM:', error.message)
    return res.status(500).json({ ok: false, mensaje: 'Error al consultar TRM' })
  }
})

module.exports = router