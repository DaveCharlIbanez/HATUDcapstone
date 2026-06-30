from flask import Blueprint, jsonify
from models import posts_db, comments_db

data_bp = Blueprint("data", __name__, url_prefix="/api/data")

@data_bp.route("/posts", methods=["GET"])
def get_posts():
    return jsonify({
        "posts": posts_db,
        "total": len(posts_db)
    }), 200

@data_bp.route("/comments", methods=["GET"])
def get_comments():
    post_id = None
    from flask import request
    post_id = request.args.get("post_id")

    if post_id:
        filtered = [c for c in comments_db if c["post_id"] == post_id]
        return jsonify({
            "comments": filtered,
            "total": len(filtered)
        }), 200

    return jsonify({
        "comments": comments_db,
        "total": len(comments_db)
    }), 200