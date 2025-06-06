<?php
// Incluye el autoloader de Composer, esencial para que las clases de librerías funcionen
require __DIR__ . '/vendor/autoload.php';

// Importa las clases necesarias con 'use' para simplificar su uso
use MercadoPago\MercadoPagoConfig;
use MercadoPago\Client\Preference\PreferenceClient;
use Dotenv\Dotenv;

// Cargar variables de entorno desde el archivo .env
// Asegúrate de que tu archivo .env esté en la misma carpeta que index.php
$dotenv = Dotenv::createImmutable(__DIR__);
$dotenv->load();

// Configurar las credenciales de Mercado Pago usando el token de acceso de tus variables de entorno
MercadoPagoConfig::setAccessToken($_ENV['ACCESS_TOKEN']);



// Manejar explícitamente las solicitudes OPTIONS (preflight requests).
// El navegador envía una solicitud OPTIONS antes de una solicitud "real" (como POST) para verificar los permisos CORS.
// Si el método de la solicitud es OPTIONS, respondemos con 200 OK y salimos del script.
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200); // Envía un código de estado 200 OK
    header("Access-Control-Allow-Origin: https://frontend-fotos-kowa77-12fcae88.koyeb.app");
    header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
    header("Access-Control-Max-Age: 86400"); // 24 horas
    exit(); // ¡CRUCIAL! Termina la ejecución del script aquí para las solicitudes OPTIONS.
}
// --- FIN DE LA CONFIGURACIÓN DE CORS ---
header('Access-Control-Allow-Origin: *'); //para permitir solicitudes desde cualquier origen local
header('Content-Type: application/json'); // Establece el tipo de contenido de la respuesta como JSON

// Obtener la ruta de la solicitud HTTP (ej. /create_preference)
$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
// Obtener el método HTTP de la solicitud (ej. GET, POST)
$requestMethod = $_SERVER['REQUEST_METHOD'];

// Función de ayuda para enviar respuestas JSON
function sendJsonResponse($data, $statusCode = 200) {
    // Establece el encabezado Content-Type para indicar que la respuesta es JSON
    header('Content-Type: application/json');
    // Establece el código de estado HTTP de la respuesta
    http_response_code($statusCode);
    // Codifica los datos a formato JSON y los imprime
    echo json_encode($data);
    // Termina la ejecución del script después de enviar la respuesta
    exit();
}

// === LÓGICA DE ENRUTAMIENTO Y MANEJO DE SOLICITUDES ===

// Ruta GET /: Responde con un mensaje simple "Hello World!"
if ($requestMethod === 'GET' && $requestUri === '/') {
    sendJsonResponse(['message' => 'Hello World!']);
}

// Ruta POST /create_preference: Maneja la creación de preferencias de pago con Mercado Pago
if ($requestMethod === 'POST' && $requestUri === '/create_preference') {
    // Obtener el cuerpo de la solicitud JSON enviada por el frontend
    $input = file_get_contents('php://input');
    $requestData = json_decode($input, true); // Decodifica el JSON a un array asociativo de PHP

    // Verifica si hubo un error al decodificar el JSON
    if (json_last_error() !== JSON_ERROR_NONE) {
        sendJsonResponse(['error' => 'Invalid JSON input'], 400); // Responde con un error 400 si el JSON es inválido
    }

    try {
        // Crea una nueva instancia del cliente de preferencias de Mercado Pago
        $client = new PreferenceClient();

        // Prepara los ítems para la preferencia de pago
        // Usa operadores de fusión de null (??) para proporcionar valores por defecto si no se reciben en la solicitud
        $items = [
            [
                "title" => $requestData['title'] ?? 'Producto por defecto', // Título del producto
                "quantity" => (int)($requestData['quantity'] ?? 1),       // Cantidad, casteado a entero
                "unit_price" => (float)($requestData['price'] ?? 0),      // Precio unitario, casteado a flotante
                "currency_id" => "UYU",                                   // Moneda (ej. Pesos Uruguayos)
            ]
        ];

        // Prepara los datos de la preferencia de pago
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
        // Captura cualquier excepción que ocurra durante el proceso
        error_log('Error creating preference: ' . $e->getMessage()); // Registra el error en los logs del servidor
        // Envía una respuesta de error al frontend
        sendJsonResponse(['error' => 'Error al crear la preferencia ;(', 'details' => $e->getMessage()], 500);
    }
}

// Si ninguna de las rutas anteriores coincide, envía una respuesta de "Endpoint not found"
sendJsonResponse(['error' => 'Endpoint not found'], 404);

?>
