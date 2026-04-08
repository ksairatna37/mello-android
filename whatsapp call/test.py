import requests
from flask import Flask, request, jsonify

# ==============================
# 🔐 CONFIG
# ==============================
PHONE_NUMBER_ID = "1057824980740751"

ACCESS_TOKEN = "EAAnqZAETwIu0BRK8NwxPlx1XHp2vMFyZB7lLeX5yCLVR7qKmWapjNCilX2ZAnOhKpQdsu1syTTw9P3n7qgvut8W00wmWYsGo9ZC75MdjuCENNQiD0rZCxaZAmxacMJjMLaaIZA99vAhUIcIl4R2GLyjkbPmI3ZA6VSxLELVHV4Ef7nMPsJSiXvpenLSZBw3deoPBk8QZDZD"

VERIFY_TOKEN = "mello_verify_123"

# 🔥 FIXED Kavita   NUMBER
#RECIPIENT_PHONE = "919325084522"

#kavita mom
RECIPIENT_PHONE = "919834815951"

#RECIPIENT_PHONE = "917745015384"

app = Flask(__name__)

# ==============================
# 🗂️ STORAGE
# ==============================
message_store = {}

# ==============================
# 📤 SEND TEMPLATE MESSAGE
# ==============================
def send_template():
    url = f"https://graph.facebook.com/v22.0/{PHONE_NUMBER_ID}/messages"

    payload = {
        "messaging_product": "whatsapp",
        "to": RECIPIENT_PHONE,
        "type": "template",
        "template": {
            "name": "mello_intro",
            "language": {
                "code": "en"
            },
            "components": [
                {
                    "type": "header",
                    "parameters": [
                        {
                            "type": "image",
                            "image": {
                                "link": "https://melloai.health/assets/mello-AhpwP9D0.png"
                            }
                        }
                    ]
                }
            ]
        }
    }

    headers = {
        "Authorization": f"Bearer {ACCESS_TOKEN}",
        "Content-Type": "application/json",
    }

    response = requests.post(url, json=payload, headers=headers)

    print(response.json())


# ==============================
# 🔐 WEBHOOK VERIFY
# ==============================
@app.route("/webhook", methods=["GET"])
def verify():
    mode = request.args.get("hub.mode")
    token = request.args.get("hub.verify_token")
    challenge = request.args.get("hub.challenge")

    if mode == "subscribe" and token == VERIFY_TOKEN:
        print("✅ Webhook verified")
        return challenge, 200
    return "❌ Verification failed", 403


# ==============================
# 📥 WEBHOOK RECEIVE
# ==============================
@app.route("/webhook", methods=["POST"])
def webhook():
    data = request.get_json()
    print("\n📩 WEBHOOK:", data)

    try:
        entry = data["entry"][0]["changes"][0]["value"]

        # ==============================
        # 📊 STATUS UPDATES
        # ==============================
        if "statuses" in entry:
            status = entry["statuses"][0]

            message_id = status.get("id")
            status_type = status.get("status")
            recipient = status.get("recipient_id")

            print("\n📊 STATUS UPDATE")
            print(f"Message ID: {message_id}")
            print(f"Status: {status_type}")
            print(f"To: {recipient}")

            if message_id in message_store:
                message_store[message_id] = status_type

        # ==============================
        # 💬 INCOMING MESSAGE (optional log)
        # ==============================
        if "messages" in entry:
            msg = entry["messages"][0]
            sender = msg["from"]

            print(f"\n👤 USER (who replied): {sender}")

            if "text" in msg:
                print(f"💬 MESSAGE: {msg['text']['body']}")

    except Exception as e:
        print("❌ ERROR:", e)

    return jsonify({"status": "ok"}), 200


# ==============================
# 🚀 RUN SERVER
# ==============================
if __name__ == "__main__":
    print("🚀 Mello WhatsApp Agent Running...")

    # 🔥 SEND TEMPLATE IMMEDIATELY
    send_template()

    app.run(port=5000, debug=True)

#https://mello-whatsapp-agent.braveflower-12a7c0ca.centralindia.azurecontainerapps.io/webhook