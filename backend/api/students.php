<?php
/**
 * students.php
 * ------------
 * GET  → list all students
 * POST → create a new student
 */

require_once __DIR__ . '/../config/db.php';
enableCORS();

$method = $_SERVER['REQUEST_METHOD'];
$db = getDB();

// ================================================================
// GET — list all students (sorted by class, then roll number)
// ================================================================
if ($method === 'GET') {
    $stmt = $db->query("
        SELECT * FROM students
        ORDER BY CAST(class AS UNSIGNED) ASC,
                 CAST(roll_number AS UNSIGNED) ASC,
                 roll_number ASC
    ");
    $rows = $stmt->fetchAll();

    $students = array_map('studentRowToApi', $rows);
    jsonResponse($students);
}

// ================================================================
// POST — create a new student
// ================================================================
if ($method === 'POST') {
    $body = readJsonBody();

    [$ok, $err] = validateStudentPayload($body);
    if (!$ok) {
        jsonResponse(['error' => $err], 400);
    }

    try {
        $stmt = $db->prepare("
            INSERT INTO students
              (name, roll_number, class, section, blood_group,
               dob, parent_name, parent_mobile, address)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");

        $stmt->execute([
            trim($body['name']),
            trim($body['rollNumber']),
            trim($body['class']),
            trim($body['section']),
            !empty($body['bloodGroup'])   ? trim($body['bloodGroup'])   : null,
            !empty($body['dob'])          ? trim($body['dob'])          : null,
            trim($body['parentName']),
            trim($body['parentMobile']),
            !empty($body['address'])      ? trim($body['address'])      : null,
        ]);

        $newId = (int) $db->lastInsertId();

        $stmt = $db->prepare("SELECT * FROM students WHERE id = ?");
        $stmt->execute([$newId]);
        $student = studentRowToApi($stmt->fetch());

        jsonResponse($student, 201);

    } catch (PDOException $e) {
        // MySQL error 1062 = duplicate entry
        if ($e->errorInfo[1] === 1062) {
            jsonResponse([
                'error' => 'A student with this roll number already exists in this class'
            ], 409);
        }
        jsonResponse(['error' => 'Failed to create student'], 500);
    }
}

// Any other method
jsonResponse(['error' => 'Method not allowed'], 405);