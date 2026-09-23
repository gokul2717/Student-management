"""
app.py
------
The Flask web server for the Student Management System (MySQL version).

ROUTES:
    GET    /api/students           → list all
    GET    /api/students/<id>      → get one
    POST   /api/students           → create
    PUT    /api/students/<id>      → update
    DELETE /api/students/<id>      → delete
    GET    /api/stats              → summary

Run with:  python app.py
"""

from flask import Flask, request, jsonify
from flask_cors import CORS

import database


# ================================================================
# SETUP
# ================================================================
app = Flask(__name__)
CORS(app)

# Create table if it doesn't exist (safe on every startup)
database.init_db()


# ================================================================
# VALIDATION
# ================================================================
def validate_student_payload(data):
    """
    Returns (is_valid, error_message).
    """
    required = ["name", "rollNumber", "class", "section",
                "parentName", "parentMobile"]

    for field in required:
        value = data.get(field)
        if value is None or str(value).strip() == "":
            return False, f"Field '{field}' is required"

    mobile = str(data.get("parentMobile", "")).strip()
    if not mobile.isdigit() or len(mobile) != 10:
        return False, "Parent's mobile must be a 10-digit number"

    return True, None


# ================================================================
# ROUTES
# ================================================================

@app.route("/", methods=["GET"])
def home():
    """Health check."""
    return jsonify({
        "message": "🎓 Student Management API (MySQL) is running",
        "endpoints": [
            "GET    /api/students",
            "GET    /api/students/<id>",
            "POST   /api/students",
            "PUT    /api/students/<id>",
            "DELETE /api/students/<id>",
            "GET    /api/stats",
        ]
    })


# ---------- GET all ----------
@app.route("/api/students", methods=["GET"])
def list_students():
    students = database.get_all_students()
    return jsonify(students), 200


# ---------- GET one ----------
@app.route("/api/students/<int:student_id>", methods=["GET"])
def get_student(student_id):
    student = database.get_student_by_id(student_id)
    if student is None:
        return jsonify({"error": "Student not found"}), 404
    return jsonify(student), 200


# ---------- CREATE ----------
@app.route("/api/students", methods=["POST"])
def add_student():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    is_valid, error = validate_student_payload(data)
    if not is_valid:
        return jsonify({"error": error}), 400

    try:
        student = database.create_student(data)
        return jsonify(student), 201
    except ValueError as ve:
        # Duplicate roll number in same class
        return jsonify({"error": str(ve)}), 409


# ---------- UPDATE ----------
@app.route("/api/students/<int:student_id>", methods=["PUT"])
def edit_student(student_id):
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    is_valid, error = validate_student_payload(data)
    if not is_valid:
        return jsonify({"error": error}), 400

    try:
        updated = database.update_student(student_id, data)
        if updated is None:
            return jsonify({"error": "Student not found"}), 404
        return jsonify(updated), 200
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 409


# ---------- DELETE ----------
@app.route("/api/students/<int:student_id>", methods=["DELETE"])
def remove_student(student_id):
    deleted = database.delete_student(student_id)
    if not deleted:
        return jsonify({"error": "Student not found"}), 404
    return jsonify({"message": "Student deleted successfully", "id": student_id}), 200


# ---------- STATS ----------
@app.route("/api/stats", methods=["GET"])
def stats():
    return jsonify(database.get_stats()), 200


# ================================================================
# MAIN
# ================================================================
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)