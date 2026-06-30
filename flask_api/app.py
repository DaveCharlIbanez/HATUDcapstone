from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from config import Config
from routes.auth import auth_bp
from routes.data import data_bp
from routes.aggregation import agg_bp

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(app)
    JWTManager(app)

    app.register_blueprint(auth_bp)
    app.register_blueprint(data_bp)
    app.register_blueprint(agg_bp)

    @app.route("/health", methods=["GET"])
    def health():
        return {"status": "healthy"}, 200

    return app

if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000, debug=True)