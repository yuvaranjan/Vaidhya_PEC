# Project Vaidhya — Multi-Agent & Lane Protocol

This directory contains configuration, prompts, and status artifacts for parallel multi-agent workflows across the Vaidhya system lanes.

## Lanes Overview

- **T1**: Edge AI service, voicebot pipeline, offline SQLite engine, outbox sync worker.
- **T2**: Next.js patient & doctor web apps, queue management, live MQTT communication.
- **T3**: Pharmacy portal, stock management, specialist AI panel, claim workflow.
- **T4**: Database schemas, seed data (Actian VectorAI DB), analytics dashboard, reminders.

## Database Backend

The central data tier is powered by **Actian VectorAI DB**.
- Vector point-based CRUD and search
- Deterministic UUIDv5 point IDs mapping domain entities
- Local SQLite outbox synchronization on reconnect
