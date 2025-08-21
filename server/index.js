
import express from 'express';
import cors  from 'cors';

//SDK de Mercado Pago
import { MercadoPagoConfig, Preference } from 'mercadopago';
// Agregando credenciales
const client = new MercadoPagoConfig({ accessToken: 'APP_USR-2512641808428898-051222-d1c09ec2d6085bb498be7ef0c4dacf14-55966984' });

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());


app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.post('/create_preference', async (req, res) => {
    try {
        const body = {
            items:[
                {
                title: req.body.title,
                quantity: Number(req.body.quantity),
                unit_price: Number(req.body.price),
                currency_id: "UYU",
                },
            ],
            back_urls: {
                success: "https://www.elpais.com.uy/",
                failure: "https://www.elpais.com.uy/",
                pending: "https://www.elpais.com.uy/"
            },
            auto_return: "approved",
        };
        const preference = new Preference(client);
        const result = await preference.create({body});
        res.json({
            id: result.id,
        });
    } catch (error) {
        console.error('Error creating preference:', error);
        res.status(500).json({ error: 'Error al crear la preferencia ;(' });
        return;
    }
});


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

