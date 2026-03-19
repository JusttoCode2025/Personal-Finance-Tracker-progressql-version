from flask import Flask, request, jsonify, render_template
import psycopg2
import os
from datetime import datetime

app = Flask(__name__)

# DATABASE CONNECTION (Render PostgreSQL)
DATABASE_URL = os.environ.get("DATABASE_URL")


if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

def db_connection():
    conn = psycopg2.connect(DATABASE_URL)
    return conn


def init_db():
    conn = db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS spending_limits (
        id SERIAL PRIMARY KEY,
        category TEXT UNIQUE NOT NULL,
        limit_amount REAL NOT NULL,
        remaining REAL NOT NULL
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS purchases (
        id SERIAL PRIMARY KEY,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        date TIMESTAMP NOT NULL
    )
    """)

    conn.commit()
    cursor.close()
    conn.close()

init_db()


#ROUTES


@app.route("/")
@app.route("/login")
def login():
    return render_template("login.html")

@app.route("/budget")
def budget():
    return render_template("budget.html")

@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")

@app.route("/about")
def about():
    return render_template("about.html")

@app.route("/contact")
def contact():
    return render_template("contact.html")

@app.route("/signup")
def signup():
    return render_template("signup.html")

@app.route("/home")
def home():
    return render_template("home.html")

@app.route("/travel-goal")
def travel_goal():
    return render_template("travel_goal.html")


# API ROUTES

@app.route("/recent_purchases")
def recent_purchases():
    conn = db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT category, amount, date
        FROM purchases
        ORDER BY date DESC
        LIMIT 5
    """)

    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    purchases = [
        {
            "category": r[0],
            "amount": float(r[1]),
            "date": str(r[2])
        }
        for r in rows
    ]

    return jsonify(purchases)


@app.route("/limit", methods=["POST"])
def set_limit():
    data = request.get_json()

    category = data.get("category", "").strip().lower()
    limit_amount = float(data.get("limit_amount", 0))

    if limit_amount <= 0:
        return jsonify({"error": "Limit must be positive"}), 400

    conn = db_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT id FROM spending_limits WHERE category=%s",
        (category,)
    )
    row = cursor.fetchone()

    if row:
        cursor.execute(
            "UPDATE spending_limits SET limit_amount=%s, remaining=%s WHERE id=%s",
            (limit_amount, limit_amount, row[0])
        )
    else:
        cursor.execute(
            "INSERT INTO spending_limits (category, limit_amount, remaining) VALUES (%s, %s, %s)",
            (category, limit_amount, limit_amount)
        )

    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({"message": f"Limit set for {category}"}), 200


@app.route("/purchase", methods=["POST"])
def add_purchase():
    data = request.get_json()

    category = data.get("category", "").strip().lower()
    amount = float(data.get("amount", 0))
    confirm = data.get("confirm", False)

    if amount <= 0:
        return jsonify({"error": "Amount must be positive"}), 400

    conn = db_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT remaining FROM spending_limits WHERE category=%s",
        (category,)
    )
    row = cursor.fetchone()

    if not row:
        cursor.close()
        conn.close()
        return jsonify({"error": f"No limit set for {category}"}), 400

    remaining = float(row[0])
    new_remaining = remaining - amount

    if new_remaining < 0 and not confirm:
        cursor.close()
        conn.close()
        return jsonify({
            "warning": "This purchase exceeds the limit. Continue?"
        }), 200

    cursor.execute(
        "UPDATE spending_limits SET remaining=%s WHERE category=%s",
        (new_remaining, category)
    )

    cursor.execute(
        "INSERT INTO purchases (category, amount, date) VALUES (%s, %s, %s)",
        (category, amount, datetime.now())
    )

    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({
        "message": "Purchase recorded",
        "remaining": new_remaining
    })


@app.route("/limits")
def view_limits():
    conn = db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT category, limit_amount, remaining
        FROM spending_limits
    """)

    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    limits = [
        {
            "category": r[0],
            "limit_amount": float(r[1]),
            "remaining": float(r[2]),
            "spent": float(r[1]) - float(r[2])
        }
        for r in rows
    ]

    return jsonify(limits)


@app.route("/dashboard_data")
def dashboard_data():
    conn = db_connection()
    cursor = conn.cursor()

    # Total spent
    cursor.execute("SELECT COALESCE(SUM(amount), 0) FROM purchases")
    total_spent = float(cursor.fetchone()[0])

    # Category totals
    cursor.execute("""
        SELECT category, SUM(amount)
        FROM purchases
        GROUP BY category
    """)
    category_rows = cursor.fetchall()

    categories = [
        {"category": r[0], "total": float(r[1])}
        for r in category_rows
    ]

    # Monthly totals 
    cursor.execute("""
        SELECT TO_CHAR(date, 'YYYY-MM') as month, SUM(amount)
        FROM purchases
        GROUP BY month
        ORDER BY month DESC
        LIMIT 12
    """)
    monthly_rows = cursor.fetchall()

    monthly = [
        {"month": r[0], "total": float(r[1])}
        for r in monthly_rows
    ]

    cursor.close()
    conn.close()

    return jsonify({
        "total_spent": total_spent,
        "categories": categories,
        "monthly": monthly
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
