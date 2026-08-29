"""
MQTT client — the edge side of Seam B (T1 task 11).

The EDGE SERVICE holds this connection, not the patient browser, because an
incoming doctor question has to drive the voicebot (translate + TTS) and all of
that lives here in FastAPI.

Non-negotiable settings, because they buy the delivery guarantee for free:
    qos=1, clean_session=False, stable client_id (vaidhya-edge-{jurisdiction})
The broker then queues undelivered QoS-1 messages across a disconnect.

De-dup on message_id with a capped set — QoS 1 is at-least-once, so duplicates
are expected, not a bug.

Threading note: paho runs its network loop on its own thread, so `_on_message`
is NOT on the event loop. It hands work back with run_coroutine_threadsafe
against the loop captured at startup. Doing async work directly in the callback
would block paho's loop and stall keepalives.
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections import deque

import paho.mqtt.client as paho

from config import get_settings
from contracts import edge_client_id

logger = logging.getLogger(__name__)

_seen_ids: deque[str] = deque(maxlen=200)
_seen_set: set[str] = set()


def is_duplicate(message_id: str) -> bool:
    if message_id in _seen_set:
        return True
    if len(_seen_ids) == _seen_ids.maxlen:
        _seen_set.discard(_seen_ids[0])
    _seen_ids.append(message_id)
    _seen_set.add(message_id)
    return False


def _is_configured(url: str) -> bool:
    """A placeholder host is not configuration. Treat it as absent so the
    service degrades to local logging instead of retrying a hostname that will
    never resolve."""
    return bool(url) and "your-cluster" not in url


class EdgeMqtt:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.client_id = edge_client_id(self.settings.jurisdiction_id)
        self.connected = False
        self._loop: asyncio.AbstractEventLoop | None = None

        self.client = paho.Client(
            paho.CallbackAPIVersion.VERSION2,
            client_id=self.client_id,
            clean_session=False,
            transport="websockets",
        )
        self.client.on_connect = self._on_connect
        self.client.on_message = self._on_message
        self.client.on_disconnect = self._on_disconnect

        if self.settings.mqtt_username and self.settings.mqtt_password:
            self.client.username_pw_set(
                self.settings.mqtt_username, self.settings.mqtt_password
            )
        if self.settings.mqtt_url and self.settings.mqtt_url.startswith(("wss://", "mqtts://", "ssl://")):
            self.client.tls_set()

    # -- paho callbacks (all on paho's thread) ---------------------------

    def _on_connect(self, client, userdata, flags, reason_code, properties=None):
        if reason_code == 0:
            self.connected = True
            client.subscribe("vaidhya/consult/+/doctor_to_patient", qos=1)
            logger.info("mqtt: connected as %s", self.client_id)
        else:
            self.connected = False
            logger.error("mqtt: connect refused (%s)", reason_code)

    def _on_disconnect(self, client, userdata, flags=None, reason_code=None, properties=None):
        self.connected = False
        logger.warning("mqtt: disconnected (%s) — paho will retry", reason_code)

    def _on_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode())
        except (ValueError, UnicodeDecodeError):
            logger.error("mqtt: undecodable payload on %s", msg.topic)
            return

        message_id = payload.get("message_id", "")
        if message_id and is_duplicate(message_id):
            return

        # topic: vaidhya/consult/{visit_id}/doctor_to_patient
        parts = msg.topic.split("/")
        if len(parts) < 4:
            return
        visit_id = parts[2]

        if self._loop is None:
            logger.warning("mqtt: message arrived before startup, dropped")
            return

        from consult import handle_doctor_question

        asyncio.run_coroutine_threadsafe(
            handle_doctor_question(visit_id, payload), self._loop
        )

    # -- lifecycle -------------------------------------------------------

    def connect(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

        url = self.settings.mqtt_url
        if not _is_configured(url):
            logger.warning(
                "mqtt: no broker configured — consult relay will log locally. "
                "Set MQTT_URL/MQTT_USERNAME/MQTT_PASSWORD to enable Seam B."
            )
            return

        try:
            host = url.replace("wss://", "").replace("ws://", "").split("/")[0]
            port = 8884 if url.startswith("wss://") else 8000
            if ":" in host:
                host, raw_port = host.rsplit(":", 1)
                port = int(raw_port)

            self.client.ws_set_options(path="/mqtt")
            self.client.connect_async(host, port, keepalive=60)
            self.client.loop_start()
            logger.info("mqtt: connecting to %s:%s", host, port)
        except Exception:
            logger.exception("mqtt: connect failed")

    def stop(self) -> None:
        try:
            self.client.loop_stop()
            self.client.disconnect()
        except Exception:
            pass

    # -- publish ---------------------------------------------------------

    def publish(self, topic: str, payload: dict, *, retain: bool = False) -> None:
        if not _is_configured(self.settings.mqtt_url):
            logger.info("mqtt[offline]: would publish %s %s", topic, payload)
            return
        try:
            self.client.publish(topic, json.dumps(payload), qos=1, retain=retain)
        except Exception:
            logger.exception("mqtt: publish to %s failed", topic)

    def healthy(self) -> bool:
        return self.connected


mqtt = EdgeMqtt()
