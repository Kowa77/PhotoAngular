<?php

// Require the Composer autoloader
require __DIR__ . '/vendor/autoload.php';

// Import the Mercado Pago class
use MercadoPago\MercadoPagoConfig;

echo "--- Iniciando prueba de carga de MercadoPagoConfig ---\n";

try {
    // Intenta instanciar la clase (no necesita credenciales reales solo para cargarla)
    $dummyConfig = new MercadoPagoConfig(['access_token' => 'DUMMY_ACCESS_TOKEN']);
    echo "¡Éxito! La clase MercadoPago\\MercadoPagoConfig se cargó correctamente.\n";
} catch (Throwable $e) {
    echo "Error: La clase MercadoPago\\MercadoPagoConfig NO se encontró.\n";
    echo "Mensaje de error: " . $e->getMessage() . "\n";
    echo "Tipo de error: " . get_class($e) . "\n";
}

echo "--- Prueba finalizada ---\n";

?>
