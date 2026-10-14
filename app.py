import logging
import os

import requests
from flask import Flask, jsonify, request
from flask_cors import CORS
from requests.exceptions import RequestException

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Configure the frontend origin through FRONTEND_ORIGIN if needed.
# During development, Vite proxies /api requests to Flask, so browser
# requests normally appear to originate from the Vite server.
CORS(
    app,
    resources={
        r"/api/*": {
            "origins": os.environ.get(
                "FRONTEND_ORIGIN",
                "http://localhost:5173",
            )
        }
    },
)

DEFAULT_RASA_BASE_URL = "http://localhost:5005"
MAX_SENDER_ID_LENGTH = 128


def get_rasa_base_url() -> str:
    """Return the base URL of the Rasa server."""
    return os.environ.get(
        "RASA_URL",
        DEFAULT_RASA_BASE_URL,
    ).rstrip("/")


@app.route("/api/check_rasa", methods=["GET"])
def check_rasa():
    try:
        # Health check of the REST channel Flask talks to. Rasa runs without
        # --enable-api, so /version and /status are not available.
        response = requests.get(
            f"{get_rasa_base_url()}/webhooks/rest/",
            timeout=3,
        )
        response.raise_for_status()

        return jsonify({"status": "available"})

    except RequestException as exc:
        logger.warning("Failed to connect to Rasa: %s", exc)

        return jsonify({
            "status": "unavailable",
            "reason": str(exc),
        }), 503


@app.route("/api/send_message", methods=["POST"])
def send_message():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Request body must be a JSON object."}), 400

    message = data.get("message")
    sender_id = data.get("sender_id")

    if not isinstance(message, str) or not message.strip():
        return jsonify({"error": "A non-empty message is required."}), 400

    # Rasa keeps a separate tracker per sender, so every conversation needs
    # its own ID. A shared fallback would mix up conversations and users.
    if (
        not isinstance(sender_id, str)
        or not sender_id.strip()
        or len(sender_id) > MAX_SENDER_ID_LENGTH
    ):
        return jsonify({"error": "A valid sender_id is required."}), 400

    payload = {
        "sender": sender_id,
        "message": message,
    }

    try:
        response = requests.post(
            f"{get_rasa_base_url()}/webhooks/rest/webhook",
            json=payload,
            timeout=30,
        )
        response.raise_for_status()

        return jsonify(process_rasa_response(response.json()))

    except RequestException as exc:
        logger.exception("Error communicating with Rasa")

        return jsonify({
            "error": f"Error communicating with Rasa: {exc}",
            "messages": [
                {
                    "text": (
                        "I'm sorry, I encountered an error processing "
                        "your request. Please try again later."
                    )
                }
            ],
        }), 502

    except ValueError:
        logger.exception("Rasa returned an invalid JSON response")

        return jsonify({
            "error": "Rasa returned an invalid response.",
            "messages": [
                {"text": "The chatbot returned an invalid response. Please try again."}
            ],
        }), 502


def process_rasa_response(response):
    result = {"messages": []}

    if not isinstance(response, list) or not response:
        result["messages"].append({
            "text": "I didn't receive a proper response. Please try again."
        })
        return result

    for item in response:
        if not isinstance(item, dict):
            continue

        if item.get("text"):
            result["messages"].append({"text": item["text"]})

        if item.get("image"):
            result["messages"].append({
                "type": "image",
                "url": item["image"],
            })

        if item.get("buttons"):
            if result["messages"]:
                result["messages"][-1]["buttons"] = item["buttons"]
            else:
                result["messages"].append({
                    "text": "",
                    "buttons": item["buttons"],
                })

    return result


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3000))
    debug = os.environ.get("FLASK_DEBUG", "").lower() in {"1", "true", "yes"}

    logger.info("Chatbot API running on http://localhost:%s", port)
    # Only the Vite dev server (which proxies /api) needs to reach Flask.
    app.run(host="127.0.0.1", port=port, debug=debug)
