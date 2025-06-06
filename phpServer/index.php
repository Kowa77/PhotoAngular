<?php
require __DIR__ . '/vendor/autoload.php';

use MercadoPago\MercadoPagoConfig;
use MercadoPago\Client\Preference\PreferenceClient;
use Dotenv\Dotenv;

// Cargar variables de entorno
$dotenv = Dotenv::createImmutable(__DIR__);
$dotenv->load();

// Configurar credenciales de Mercado Pago
MercadoPagoConfig::setAccessToken($_ENV['ACCESS_TOKEN']);

// --- INICIO DE LA CONFIGURACIÓN DE CORS (AJUSTADA) ---
// Obtener el origen de la solicitud
$origin = getenv('HTTP_ORIGIN') ?: '*'; // Utiliza el origin de la solicitud o '*'

// Define los orígenes permitidos (puedes hacer esto más estricto en producción)
// Para producción, idealmente sería:
// $allowed_origins = [
//     'https://cold-ailina-kowa77-12fcae88.koyeb.app'
// ];
// if (in_array($origin, $allowed_origins)) {
//     header("Access-Control-Allow-Origin: " . $origin);
// } else {
//     header("Access-Control-Allow-Origin: *"); // O no enviar el header si no es permitido
// }

// Por ahora, para depurar y que funcione, mantengamos '*'
header("Access-Control-Allow-Origin: " . $origin); // Permitir el origen que envió la solicitud




// Habilitar CORS (ajusta para tu entorno de producción)
header("Access-Control-Allow-Origin: *"); // Permite solicitudes desde cualquier origen
header("Access-Control-Allow-Methods: POST, GET, OPTIONS"); // Permite los métodos que usarás
header("Access-Control-Allow-Headers: Content-Type, Authorization"); // Permite los encabezados comunes


// // Manejar solicitudes OPTIONS (preflight requests)
// if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
//     http_response_code(200);
//     exit();
// }

// Obtener la ruta de la solicitud
$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$requestMethod = $_SERVER['REQUEST_METHOD'];

// Función para enviar respuestas JSON
function sendJsonResponse($data, $statusCode = 200) {
    header('Content-Type: application/json');
    http_response_code($statusCode);
    echo json_encode($data);
    exit();
}

// Ruta GET /
if ($requestMethod === 'GET' && $requestUri === '/') {
    sendJsonResponse(['message' => 'Hello World!']);
}

// Ruta POST /create_preference
if ($requestMethod === 'POST' && $requestUri === '/create_preference') {
    // Obtener el cuerpo de la solicitud JSON
    $input = file_get_contents('php://input');
    $requestData = json_decode($input, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        sendJsonResponse(['error' => 'Invalid JSON input'], 400);
    }

    try {
        $client = new PreferenceClient();

        $items = [
            [
                "title" => $requestData['title'] ?? 'Producto por defecto',
                "quantity" => (int)($requestData['quantity'] ?? 1),
                "unit_price" => (float)($requestData['price'] ?? 0),
                "currency_id" => "UYU",
            ]
        ];

        $preferenceData = [
            "items" => $items,
            "back_urls" => [
                "success" => "https://www.elpais.com.uy/",
                "failure" => "https://www.elpais.com.uy/",
                "pending" => "https://www.elpais.com.uy/"
            ],
            "auto_return" => "approved",
        ];

        $preference = $client->create($preferenceData);

        sendJsonResponse(['id' => $preference->id]);

    } catch (Exception $e) {
        error_log('Error creating preference: ' . $e->getMessage());
        sendJsonResponse(['error' => 'Error al crear la preferencia ;(', 'details' => $e->getMessage()], 500);
    }
}

// Ruta no encontrada
sendJsonResponse(['error' => 'Endpoint not found'], 404);

?>
