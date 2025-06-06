<?php
// Incluye el autoloader de Composer, esencial para que las clases de librerías funcionen
require __DIR__ . '/vendor/autoload.php';

// Importa las clases necesarias con 'use' para simplificar su uso
use MercadoPago\MercadoPagoConfig;
use MercadoPago\Client\Preference\PreferenceClient;
use Dotenv\Dotenv;

$dotenv = Dotenv::createImmutable(__DIR__);
$dotenv->load();

MercadoPagoConfig::setAccessToken($_ENV['ACCESS_TOKEN']);

// --- INICIO DE LA CONFIGURACIÓN DE CORS (UNIFICADA Y CORREGIDA) ---
// Estas cabeceras se enviarán para TODAS las solicitudes (GET, POST, OPTIONS, etc.)
// ¡IMPORTANTE: Usar la URL EXACTA de tu frontend en producción!
header("Access-Control-Allow-Origin: https://frontend-fotos-kowa77-12fcae88.koyeb.app"); // <--- ¡RUTA CORREGIDA AQUÍ!
header("Access-Control-Allow-Methods: GET, POST, OPTIONS"); // Incluye todos los métodos que usarás
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With"); // Incluye los encabezados comunes
header("Access-Control-Max-Age: 86400"); // Cachear la respuesta OPTIONS por 24 horas

// Manejar explícitamente las solicitudes OPTIONS (preflight).
// Si la solicitud es OPTIONS, respondemos con 200 OK y terminamos el script.
// Esto es CRUCIAL para las solicitudes preflight CORS.
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200); // Envía un código de estado 200 OK
    exit(); // ¡CRUCIAL! Termina la ejecución del script aquí para las solicitudes OPTIONS.
}
// --- FIN DE LA CONFIGURACIÓN DE CORS ---


// Obtener la ruta de la solicitud HTTP (ej. /create_preference)
$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$requestMethod = $_SERVER['REQUEST_METHOD'];

// Función de ayuda para enviar respuestas JSON
function sendJsonResponse($data, $statusCode = 200) {
    header('Content-Type: application/json');
    http_response_code($statusCode);
    echo json_encode($data);
    exit();
}

// === LÓGICA DE ENRUTAMIENTO Y MANEJO DE SOLICITUDES ===
if ($requestMethod === 'GET' && $requestUri === '/') {
    sendJsonResponse(['message' => 'Hello World!']);
}

// Ruta POST /create_preference: Maneja la creación de preferencias de pago con Mercado Pago
if ($requestMethod === 'POST' && $requestUri === '/create_preference') {
    $input = file_get_contents('php://input');
    $requestData = json_decode($input, true); // Decodifica el JSON a un array asociativo de PHP

    // Verifica si hubo un error al decodificar el JSON
    if (json_last_error() !== JSON_ERROR_NONE) {
        sendJsonResponse(['error' => 'Invalid JSON input'], 400); // Responde con un error 400 si el JSON es inválido
    }
    try {
        $client = new PreferenceClient();
        $items = [
            [
                "title" => $requestData['title'] ?? 'Producto por defecto', // Título del producto
                "quantity" => (int)($requestData['quantity'] ?? 1),       // Cantidad, casteado a entero
                "unit_price" => (float)($requestData['price'] ?? 0),      // Precio unitario, casteado a flotante
                "currency_id" => "UYU",                                   // Moneda (ej. Pesos Uruguayos)
            ]
        ];
        $preferenceData = [
            "items" => $items, // Los ítems definidos anteriormente
            "back_urls" => [   // URLs a las que Mercado Pago redirigirá después del pago
                "success" => "https://www.elpais.com.uy/", // URL para pago exitoso
                "failure" => "https://www.elpais.com.uy/", // URL para pago fallido
                "pending" => "https://www.elpais.com.uy/"  // URL para pago pendiente
            ],
            "auto_return" => "approved", // Redirige automáticamente al usuario después de un pago aprobado
        ];

        // Crea la preferencia de pago en Mercado Pago
        $preference = $client->create($preferenceData);

        // Envía la ID de la preferencia creada de vuelta al frontend
        sendJsonResponse(['id' => $preference->id]);

    } catch (Exception $e) {
        error_log('Error creating preference: ' . $e->getMessage()); // Registra el error en los logs del servidor
        sendJsonResponse(['error' => 'Error al crear la preferencia ;(', 'details' => $e->getMessage()], 500);
    }
}

sendJsonResponse(['error' => 'Endpoint not found'], 404);

?>
