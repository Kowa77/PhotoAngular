
    import express, { json } from 'express';
    import cors from 'cors';
    const app = express();
    const PORT = 4200;

    app.use(cors());
    app.use(json());

    app.post("/contacto", (req, res) => {
        console.log("Petición a /contacto recibida:", req.body);
        res.status(200).send({ message: "Petición recibida correctamente" });
    });

    app.listen(PORT, () => {
        console.log(`Test server is running on http://localhost:${PORT}`);
    });
