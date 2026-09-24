<?php
/**
 * stats.php
 * ---------
 * Returns:
 *   {
 *     "totalStudents": 42,
 *     "totalClasses": 5,
 *     "classBreakdown": { "1": 8, "2": 10, ... }
 *   }
 */

require_once __DIR__ . '/../config/db.php';
enableCORS();

$db = getDB();

// Total students
$total = (int) $db->query("SELECT COUNT(*) FROM students")->fetchColumn();

// Breakdown per class
$stmt = $db->query("
    SELECT class, COUNT(*) AS n
    FROM students
    GROUP BY class
    ORDER BY CAST(class AS UNSIGNED) ASC
");
$rows = $stmt->fetchAll();

$breakdown = [];
foreach ($rows as $r) {
    $breakdown[(string) $r['class']] = (int) $r['n'];
}

jsonResponse([
    'totalStudents'  => $total,
    'totalClasses'   => count($breakdown),
    'classBreakdown' => $breakdown,
]);