import uuid
from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from models import users_db, User

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json()

    if not data or not data.get("username") or not data.get("email") or not data.get("password"):
        return jsonify({"error": "Missing required fields: username, email, password"}), 400

    username = data["username"]
    email = data["email"]
    password = data["password"]

    for user in users_db.values():
        if user["username"] == username:
            return jsonify({"error": "Username already exists"}), 409
        if user["email"] == email:
            return jsonify({"error": "Email already registered"}), 409

    user_id = str(uuid.uuid4())
    new_user: User = {
        "id": user_id,
        "username": username,
        "email": email,
        "password_hash": generate_password_hash(password),
        "created_at": datetime.utcnow().isoformat() + "Z"
    }

    users_db[user_id] = new_user

    return jsonify({
        "message": "User registered successfully",
        "user": {
            "id": user_id,
            "username": username,
            "email": email,
            "created_at": new_user["created_at"]
        }
    }), 201

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()

    if not data or not data.get("username") or not data.get("password"):
        return jsonify({"error": "Missing required fields: username, password"}), 400

    username = data["username"]
    password = data["password"]

    user = None
    for u in users_db.values():
        if u["username"] == username:
            user = u
            break

    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Invalid username or password"}), 401

    access_token = create_access_token(identity=user["id"])

    return jsonify({
        "access_token": access_token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"]
        }
    }), 200

@auth_bp.route("/profile", methods=["GET"])
@jwt_required()
def get_profile():
    user_id = get_jwt_identity()
    user = users_db.get(user_id)

    if not user:
        return jsonify({"error": "User not found"}), 404

    return jsonify({
        "id": user["id"],
        "username": user["username"],
        "email": user["email"],
        "created_at": user["created_at"]
    }), 200