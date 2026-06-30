from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from services.aggregator import aggregate_dashboard_data

agg_bp = Blueprint("aggregate", __name__, url_prefix="/api/aggregate")

@agg_bp.route("/dashboard", methods=["GET"])
@jwt_required()
def get_dashboard():
    user_id = get_jwt_identity()
    result = aggregate_dashboard_data(user_id)
    return jsonify(result), 200