"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mercadopago_1 = require("mercadopago");
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
// Middleware para parsear el cuerpo de las peticiones como JSON
app.use(express_1.default.json());
// Obtén el Access Token de las variables de entorno (así lo configuraremos en Railway)
const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
// Inicializa el SDK de Mercado Pago
const client = new mercadopago_1.MercadoPagoConfig({ accessToken: accessToken }); // El '!' asegura a TS que accessToken no será undefined aquí
const preference = new mercadopago_1.Preference(client);
const createPreferenceHandler = async (req, res) => {
    try {
        const items = req.body.items;
        if (!items || items.length === 0) {
            res.status(400).json({ error: 'No hay items en el carrito.' });
            return; // Importante el 'return' después de enviar la respuesta
        }
        const preferencePayload = {
            body: {
                items: items.map((item) => ({
                    title: item.nombre,
                    quantity: item.cantidad || 1,
                    unit_price: String(Number(item.precio)),
                    currency_id: 'UYU',
                })),
                back_urls: {
                    success: 'TU_URL_DE_ÉXITO',
                    pending: 'TU_URL_DE_PENDIENTE',
                    failure: 'TU_URL_DE_FALLO',
                },
                // notification_url: 'TU_URL_DE_NOTIFICACIÓN', // Opcional
                // external_reference: 'TU_REFERENCIA_ÚNICA', // Opcional
            },
        };
        const mpResponse = await preference.create(preferencePayload);
        res.json({ id: mpResponse.id });
        return; // Aseguramos un retorno después de enviar la respuesta exitosa
    }
    catch (error) {
        console.error("Error al crear la preferencia:", error);
        res.status(500).json({ error: 'Error al crear la preferencia en Mercado Pago.' });
        return; // Aseguramos un retorno después de enviar la respuesta de error
    }
};
app.post('/create-preference', createPreferenceHandler);
app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});
