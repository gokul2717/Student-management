<?php
/**
 * student.php
 * -----------
 * GET    ?id=N → fetch one student
 * PUT    ?id=N → update student
 * DELETE ?id=N → delete student
 */

require_once __DIR__ . '/../config/db.php';
enableCORS();

$method = $_SERVER['REQUEST_METHOD'];
$id = (int) ($_GET['id'] ?? 0);

if ($id <= 0) {
    jsonResponse(['error' => 'Valid student id is required'], 400);
}

$db = getDB();

// ================================================================
// GET — fetch one
// ================================================================
if ($method === 'GET') {
    $stmt = $db->prepare("SELECT * FROM students WHERE id = ?");
    $stmt->execute([$id]);
    $row = $stmt->fetch();

    if (!$row) {
        jsonResponse(['error' => 'Student not found'], 404);
    }

    jsonResponse(studentRowToApi($row));
}

// ================================================================
// PUT — update
// ================================================================
if ($method === 'PUT') {
    $body = readJsonBody();

    [$ok, $err] = validateStudentPayload($body);
    if (!$ok) {
        jsonResponse(['error' => $err], 400);
    }

    // Check existence first
    $stmt = $db->prepare("SELECT id FROM students WHERE id = ?");
    $stmt->execute([$id]);
    if (!$stmt->fetch()) {
        jsonResponse(['error' => 'Student not found'], 404);
    }

    try {
        $stmt = $db->prepare("
            UPDATE students
            SET name           = ?,
                roll_number    = ?,
                class          = ?,
                section        = ?,
                blood_group    = ?,
                dob            = ?,
                parent_name    = ?,
                parent_mobile  = ?,
                address        = ?
            WHERE id = ?
        ");

        $stmt->execute([
            trim($body['name']),
            trim($body['rollNumber']),
            trim($body['class']),
            trim($body['section']),
            !empty($body['bloodGroup']) ? trim($body['bloodGroup']) : null,
            !empty($body['dob'])        ? trim($body['dob'])        : null,
            trim($body['parentName']),
            trim($body['parentMobile']),
            !empty($body['address'])    ? trim($body['address'])    : null,
            $id,
        ]);

        // Return the updated row
        $stmt = $db->prepare("SELECT * FROM students WHERE id = ?");
        $stmt->execute([$id]);
        $student = studentRowToApi($stmt->fetch());

        jsonResponse($student);

    } catch (PDOException $e) {
        if ($e->errorInfo[1] === 1062) {
            jsonResponse([
                'error' => 'Another student already has this roll number in this class'
            ], 409);
        }
        jsonResponse(['error' => 'Failed to update student'], 500);
    }
}

// ================================================================
// DELETE — remove
// ================================================================
if ($method === 'DELETE') {
    $stmt = $db->prepare("DELETE FROM students WHERE id = ?");
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        jsonResponse(['error' => 'Student not found'], 404);
    }

    jsonResponse([
        'message' => 'Student deleted successfully',
        'id'      => $id
    ]);
}

jsonResponse(['error' => 'Method not allowed'], 405);