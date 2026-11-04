const axios = require('axios');

const chat = async (req, res) => {
  const { messages, system } = req.body || {};
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  const MODEL = process.env.MODEL;

  // Antes: sin "messages" el spread lanzaba TypeError y respondía 500.
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Debes enviar 'messages' como un arreglo con al menos un mensaje" });
  }
  if (!OPENROUTER_API_KEY) {
    return res.status(503).json({ error: "El asistente no está configurado en el servidor" });
  }

  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: MODEL || "google/gemini-3.1-flash-lite", // Modelo por defecto si el .env falla
        // Reducir tokens para evitar el error 402 (créditos/token insuficientes)
        max_tokens: 800,
        messages: [
          { role: "system", content: system || "Asistente de AhorrApp" },
          ...messages,
        ],
      },
      {
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.choices && response.data.choices[0]) {
      res.json({ reply: response.data.choices[0].message.content });
    } else {
      console.log("Cuerpo de respuesta de OpenRouter:", response.data);
      res.status(500).json({ error: "OpenRouter no devolvió una respuesta válida" });
    }

  } catch (err) {
    // Esto nos dirá el error REAL en la terminal
    console.error("ERROR REAL DE OPENROUTER:", err.response ? err.response.data : err.message);
    
    // Antes: err.response.data.error.message lanzaba TypeError si la forma del error variaba.
    const detailedError = err.response?.data?.error?.message || "Error de conexión con el asistente";
    res.status(502).json({ error: detailedError });
  }
};

module.exports = { chat };