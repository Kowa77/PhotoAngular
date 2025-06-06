<?php
// Incluye el autoloader de Composer, esencial para que las clases de librerías funcionen
require __DIR__ . '/vendor/autoload.php';

// Importa las clases necesarias con 'use' para simplificar su uso
use MercadoPago\MercadoPagoConfig;
use MercadoPago\Client\Preference\PreferenceClient;
use Dotenv\Dotenv;

// ** AÑADE ESTAS LÍNEAS DE DEPURACIÓN **
error_log("DEBUG: index.php script started."); // Un log al inicio
// Si ves este log pero no los de las cabeceras, algo falla antes.

// Esto asegura que la variable $_ENV se llene si .env existe.
// En Koyeb, las variables de entorno se inyectan directamente, por lo que Dotenv podría ser redundante
// para variables de entorno del sistema, pero no hace daño si el .env no está.
$dotenv = Dotenv::createImmutable(__DIR__);
$dotenv->load();

// Verifica si ACCESS_TOKEN está disponible, si no, el script fallará aquí o más abajo.
// Puedes agregar un log temporal: error_log("MP_ACCESS_TOKEN: " . getenv('ACCESS_TOKEN'));
MercadoPagoConfig::setAccessToken($_ENV['ACCESS_TOKEN']);

// --- INICIO DE LA CONFIGURACIÓN DE CORS (UNIFICADA Y CORREGIDA) ---

// ** AÑADE ESTOS LOGS ANTES DE CADA CABECERA CORS **
error_log("DEBUG: Setting Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Origin: *"); // Permite solicitudes desde el frontend específico

error_log("DEBUG: Setting Access-Control-Allow-Methods...");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS"); // Incluye todos los métodos que usarás

error_log("DEBUG: Setting Access-Control-Allow-Headers...");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With"); // Incluye los encabezados comunes

error_log("DEBUG: Setting Access-Control-Max-Age...");
header("Access-Control-Max-Age: 86400"); // Cachear la respuesta OPTIONS por 24 horas

// Manejar explícitamente las solicitudes OPTIONS (preflight).
error_log("DEBUG: Checking request method: " . $_SERVER['REQUEST_METHOD']);
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    error_log("DEBUG: OPTIONS request received, sending 200 OK and exiting.");
    http_response_code(200); // Envía un código de estado 200 OK
    exit(); // ¡CRUCIAL! Termina la ejecución del script aquí para las solicitudes OPTIONS.
}
error_log("DEBUG: Not an OPTIONS request, continuing script.");
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
    error_log("DEBUG: GET / request received.");
    sendJsonResponse(['message' => 'Hello World!']);
}

// Ruta POST /create_preference: Maneja la creación de preferencias de pago con Mercado Pago
if ($requestMethod === 'POST' && $requestUri === '/create_preference') {
    error_log("DEBUG: POST /create_preference request received.");
    $input = file_get_contents('php://input');
    // Verifica si se recibió algún input
    if (!$input) {
        error_log("DEBUG: No input provided.");
        sendJsonResponse(['error' => 'No input provided'], 400);
    }
    $requestData = json_decode($input, true); // Decodifica el JSON a un array asociativo de PHP

    // Verifica si hubo un error al decodificar el JSON
    if (json_last_error() !== JSON_ERROR_NONE) {
        error_log("DEBUG: Invalid JSON input: " . json_last_error_msg());
        sendJsonResponse(['error' => 'Invalid JSON input'], 400);
    }
    try {
        error_log("DEBUG: Attempting to create Mercado Pago Preference.");
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

        // Crea la preferencia de pago en Mercado Pago
        $preference = $client->create($preferenceData);
        error_log("DEBUG: Mercado Pago Preference created successfully: " . $preference->id);

        // Envía la ID de la preferencia creada de vuelta al frontend
        sendJsonResponse(['id' => $preference->id]);

    } catch (Exception $e) {
        error_log('Error creating preference: ' . $e->getMessage()); // Registra el error en los logs del servidor
        sendJsonResponse(['error' => 'Error al crear la preferencia ;(', 'details' => $e->getMessage()], 500);
    }
} else {
    error_log("DEBUG: Endpoint not found for method " . $requestMethod . " and URI " . $requestUri);
    sendJsonResponse(['error' => 'Endpoint not found'], 404);
}
?>
