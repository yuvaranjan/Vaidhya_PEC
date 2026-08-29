import paho.mqtt.client as paho
import time

def on_connect(client, userdata, flags, reason_code, properties=None):
    print("Connected with result code " + str(reason_code))

def on_disconnect(client, userdata, flags, reason_code, properties=None):
    print("Disconnected with result code " + str(reason_code))

client = paho.Client(
    paho.CallbackAPIVersion.VERSION2,
    client_id="test_script_123",
    clean_session=True,
    transport="websockets",
)
client.on_connect = on_connect
client.on_disconnect = on_disconnect
client.ws_set_options(path="/mqtt")

url = "wss://broker.hivemq.com:8884/mqtt"

# If I don't set TLS, will it fail? Let's NOT set TLS and see.
host = "broker.hivemq.com"
port = 8884

print("Connecting...")
try:
    client.connect(host, port, keepalive=60)
    client.loop_start()
    time.sleep(2)
    client.loop_stop()
except Exception as e:
    print(f"Exception: {e}")
