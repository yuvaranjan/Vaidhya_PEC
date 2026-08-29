"use client";

/**
 * Browser MQTT client — the doctor side of Seam B.
 *
 * The doctor's laptop cannot reach the edge service over HTTP, so the queue and
 * the whole consult conversation ride on MQTT. Broker is HiveMQ Cloud over WSS.
 *
 * Reference: Docs/Project_Vaidhya_V1_Build_Plan.md §2.2
 */

import mqtt, { type MqttClient } from "mqtt";
import { QOS_AT_LEAST_ONCE, clientId, createDedupe, topics } from "@vaidhya/shared";

export { topics, clientId, createDedupe };

let client: MqttClient | null = null;

/**
 * Connect once per tab and reuse. `clean: false` + a stable client id is what
 * makes the broker queue QoS-1 messages across a disconnect — that is most of
 * the "not lost" guarantee, bought with configuration instead of code.
 */
export function getMqttClient(doctorId: string): MqttClient | null {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_MQTT_URL;
  // No broker configured is a normal state — the consult screen falls back to
  // polling. Throwing here took the whole doctor queue down with it.
  if (!url || url.includes("your-cluster")) {
    console.warn("[mqtt] NEXT_PUBLIC_MQTT_URL not set — live consult disabled");
    return null;
  }

  client = mqtt.connect(url, {
    clientId: clientId.doctor(doctorId),
    username: process.env.NEXT_PUBLIC_MQTT_USERNAME,
    password: process.env.NEXT_PUBLIC_MQTT_PASSWORD,
    clean: false,
    protocolVersion: 5,
    reconnectPeriod: 2000,
    connectTimeout: 10_000,
  });

  client.on("error", (err) => console.error("[mqtt]", err.message));
  return client;
}

export function disconnectMqtt() {
  client?.end(true);
  client = null;
}

/** Subscribe to a topic and get parsed JSON payloads. Returns an unsubscribe fn. */
export function subscribeJson<T>(
  c: MqttClient,
  topic: string,
  onMessage: (payload: T, topic: string) => void,
): () => void {
  c.subscribe(topic, { qos: QOS_AT_LEAST_ONCE });

  const handler = (t: string, buf: Buffer) => {
    if (!topicMatches(topic, t)) return;
    try {
      onMessage(JSON.parse(buf.toString()) as T, t);
    } catch {
      console.error("[mqtt] non-JSON payload on", t);
    }
  };

  c.on("message", handler);
  return () => {
    c.off("message", handler);
    c.unsubscribe(topic);
  };
}

export function publishJson(c: MqttClient, topic: string, payload: unknown) {
  c.publish(topic, JSON.stringify(payload), { qos: QOS_AT_LEAST_ONCE });
}

/** MQTT wildcard match, so one handler per subscription doesn't cross-fire. */
function topicMatches(filter: string, topic: string): boolean {
  const f = filter.split("/");
  const t = topic.split("/");
  for (let i = 0; i < f.length; i++) {
    if (f[i] === "#") return true;
    if (f[i] !== "+" && f[i] !== t[i]) return false;
  }
  return f.length === t.length;
}
