<?php
/**
 * db.php
 * ------
 * Central database connection + shared helper functions.
 * Every API file includes this.
 */

// ---- Database credentials ----
// XAMPP defaults: user = root, password = "" (empty)
define('DB_HOST', 'localhost');
define('DB_NAME', 'student_management');
define('DB_USER', 'root');
define('DB_PASS', '');       // change if you set a MySQL password
define('DB_CHARSET', 'utf8mb4');


/**
 * Returns a single PDO connection (reused per request).
 */
function getDB() {
    static $pdo = null;

    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST
             . ';dbname='    . DB_NAME
             . ';charset='   . DB_CHARSET;

        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];

        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            jsonResponse(['error' => 'Database connection failed'], 500);
        }
    }

    return $pdo;
}


/**
 * Sends a JSON response and stops the script.
 */
function jsonResponse($data, $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}


/**
 * Reads JSON body from POST / PUT request.
 */
function readJsonBody() {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}


/**
 * Enables CORS so the browser can call this API from anywhere.
 */
function enableCORS() {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');

    // Preflight request — short-circuit
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }
}


/**
 * Converts a raw DB row into the shape your frontend expects.
 */
function studentRowToApi(array $row): array {
    return [
        'id'           => (int)   $row['id'],
        'name'         =>         $row['name'],
        'rollNumber'   =>         $row['roll_number'],
        'class'        =>         $row['class'],
        'section'      =>         $row['section'],
        'bloodGroup'   =>         $row['blood_group'] ?? '',
        'dob'          =>         $row['dob'] ?? '',
        'parentName'   =>         $row['parent_name'],
        'parentMobile' =>         $row['parent_mobile'],
        'address'      =>         $row['address'] ?? '',
        'createdAt'    =>         $row['created_at'] ?? '',
    ];
}


/**
 * Validates the incoming student payload.
 * Returns [isValid, errorMessage].
 */
function validateStudentPayload(array $data): array {
    $required = ['name', 'rollNumber', 'class', 'section', 'parentName', 'parentMobile'];

    foreach ($required as $field) {
        if (!isset($data[$field]) || trim((string) $data[$field]) === '') {
            return [false, "Field '$field' is required"];
        }
    }

    $mobile = trim((string) $data['parentMobile']);
    if (!preg_match('/^\d{10}$/', $mobile)) {
        return [false, "Parent's mobile must be a 10-digit number"];
    }

    return [true, null];
}