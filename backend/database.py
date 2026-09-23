"""
database.py
-----------
Handles all MySQL operations for the Student Management System.

The rest of the app (app.py) NEVER writes SQL directly.
It only calls the functions defined here.
"""

import os
import mysql.connector
from mysql.connector import Error
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()


# ================================================================
# CONNECTION
# ================================================================
def get_connection():
    """
    Opens a new MySQL connection using credentials from .env.

    Returns a connection object (or raises an error).
    """
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", 3306)),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", ""),
        database=os.getenv("DB_NAME", "student_management"),
        autocommit=False,   # we control commits explicitly
    )


def init_db():
    """
    Checks that the students table exists.
    If your schema.sql was already run, this is a no-op.
    If not, it creates the table.
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS students (
                id              INT AUTO_INCREMENT PRIMARY KEY,
                name            VARCHAR(120) NOT NULL,
                roll_number     VARCHAR(20)  NOT NULL,
                class           VARCHAR(10)  NOT NULL,
                section         VARCHAR(5)   NOT NULL,
                blood_group     VARCHAR(5),
                dob             DATE,
                parent_name     VARCHAR(120) NOT NULL,
                parent_mobile   VARCHAR(15)  NOT NULL,
                address         TEXT,
                created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_roll_per_class (class, roll_number)
            ) ENGINE=InnoDB
        """)

        conn.commit()
        cursor.close()
        conn.close()
        print("✅ MySQL database initialized (students table ready)")

    except Error as e:
        print(f"❌ MySQL error: {e}")
        raise


# ================================================================
# HELPERS
# ================================================================
def row_to_dict(row, columns):
    """
    Converts a tuple row from MySQL into a Python dict
    with keys matching what the frontend expects.
    """
    if row is None:
        return None

    # mysql-connector returns each row as a tuple.
    # zip() pairs each column name with its value.
    raw = dict(zip(columns, row))

    return {
        "id":            raw["id"],
        "name":          raw["name"],
        "rollNumber":    raw["roll_number"],
        "class":         raw["class"],
        "section":       raw["section"],
        "bloodGroup":    raw["blood_group"] or "",
        "dob":           str(raw["dob"]) if raw["dob"] else "",
        "parentName":    raw["parent_name"],
        "parentMobile":  raw["parent_mobile"],
        "address":       raw["address"] or "",
        "createdAt":     str(raw["created_at"]) if raw["created_at"] else "",
    }


# Column order we always SELECT — keeps row_to_dict consistent
COLUMNS = [
    "id", "name", "roll_number", "class", "section",
    "blood_group", "dob", "parent_name", "parent_mobile",
    "address", "created_at"
]

SELECT_ALL = "SELECT " + ", ".join(COLUMNS) + " FROM students"


# ================================================================
# CRUD OPERATIONS
# ================================================================

def get_all_students():
    """Returns every student, sorted by class then roll number."""
    try:
        conn = get_connection()
        cursor = conn.cursor()

        # CAST(... AS UNSIGNED) makes "2" sort before "10"
        cursor.execute(f"""
            {SELECT_ALL}
            ORDER BY CAST(class AS UNSIGNED) ASC,
                     CAST(roll_number AS UNSIGNED) ASC,
                     roll_number ASC
        """)

        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        return [row_to_dict(row, COLUMNS) for row in rows]

    except Error as e:
        print(f"❌ get_all_students error: {e}")
        return []


def get_student_by_id(student_id):
    """Returns a single student by id, or None."""
    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute(f"{SELECT_ALL} WHERE id = %s", (student_id,))
        row = cursor.fetchone()

        cursor.close()
        conn.close()

        return row_to_dict(row, COLUMNS)

    except Error as e:
        print(f"❌ get_student_by_id error: {e}")
        return None


def create_student(data):
    """
    Inserts a new student.

    `data` is a dict with keys:
        name, rollNumber, class, section, bloodGroup,
        dob, parentName, parentMobile, address

    Returns the newly created student (with its MySQL id).
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()

        # %s placeholders protect against SQL injection
        cursor.execute("""
            INSERT INTO students (
                name, roll_number, class, section,
                blood_group, dob, parent_name, parent_mobile, address
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            data["name"],
            data["rollNumber"],
            data["class"],
            data["section"],
            data.get("bloodGroup") or None,
            data.get("dob") or None,
            data["parentName"],
            data["parentMobile"],
            data.get("address") or None,
        ))

        conn.commit()
        new_id = cursor.lastrowid
        cursor.close()
        conn.close()

        return get_student_by_id(new_id)

    except Error as e:
        print(f"❌ create_student error: {e}")
        # Duplicate roll number in same class → MySQL error 1062
        if e.errno == 1062:
            raise ValueError("A student with this roll number already exists in this class")
        raise


def update_student(student_id, data):
    """
    Updates a student's details.
    Returns the updated student, or None if not found.
    """
    # Check existence first
    if get_student_by_id(student_id) is None:
        return None

    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            UPDATE students
            SET name           = %s,
                roll_number    = %s,
                class          = %s,
                section        = %s,
                blood_group    = %s,
                dob            = %s,
                parent_name    = %s,
                parent_mobile  = %s,
                address        = %s
            WHERE id = %s
        """, (
            data["name"],
            data["rollNumber"],
            data["class"],
            data["section"],
            data.get("bloodGroup") or None,
            data.get("dob") or None,
            data["parentName"],
            data["parentMobile"],
            data.get("address") or None,
            student_id,
        ))

        conn.commit()
        cursor.close()
        conn.close()

        return get_student_by_id(student_id)

    except Error as e:
        print(f"❌ update_student error: {e}")
        if e.errno == 1062:
            raise ValueError("Another student already has this roll number in this class")
        raise


def delete_student(student_id):
    """
    Deletes a student by id.
    Returns True if a row was deleted, False otherwise.
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("DELETE FROM students WHERE id = %s", (student_id,))
        conn.commit()

        deleted = cursor.rowcount > 0
        cursor.close()
        conn.close()

        return deleted

    except Error as e:
        print(f"❌ delete_student error: {e}")
        return False


def get_stats():
    """
    Returns summary stats:
        {
          "totalStudents": 42,
          "totalClasses": 5,
          "classBreakdown": { "1": 8, "2": 10, ... }
        }
    """
    try:
        conn = get_connection()
        cursor = conn.cursor()

        # Total students
        cursor.execute("SELECT COUNT(*) FROM students")
        total = cursor.fetchone()[0]

        # Students per class
        cursor.execute("""
            SELECT class, COUNT(*) AS n
            FROM students
            GROUP BY class
            ORDER BY CAST(class AS UNSIGNED) ASC
        """)
        breakdown = {row[0]: row[1] for row in cursor.fetchall()}

        cursor.close()
        conn.close()

        return {
            "totalStudents": total,
            "totalClasses": len(breakdown),
            "classBreakdown": breakdown,
        }

    except Error as e:
        print(f"❌ get_stats error: {e}")
        return {"totalStudents": 0, "totalClasses": 0, "classBreakdown": {}}