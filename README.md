# OpenCode Studio - Hosting Guide

OpenCode Studio is a lightweight, AI-powered IDE interface designed to run on **Bun**. This guide explains how to host it locally or publicly using Docker and Cloudflare Tunnels.

## Prerequisites

- [Docker](https://www.docker.com/) & Docker Compose
- A [Google Gemini API Key](https://aistudio.google.com/app/apikey)

## Quick Start (Local Network)

1. **Create a `.env` file** in the project root:
   ```bash
   API_KEY=your_gemini_api_key_here
   # Leave TUNNEL_TOKEN empty if you only want local access
   TUNNEL_TOKEN=
   ```

2. **Run with Docker Compose**:
   ```bash
   docker compose up -d
   ```

3. **Access the App**:
   Open `http://localhost:3000` (or your server's IP address).

## Public Access via Cloudflare Tunnel

To access your instance securely from the internet without opening ports on your router:

1. Go to the [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/).
2. Navigate to **Access > Tunnels** and create a new tunnel.
3. Choose **Docker** as your environment.
4. Copy the **token** from the installation command (it's the long string after `--token`).
5. Update your `.env` file:
   ```bash
   API_KEY=your_gemini_api_key_here
   TUNNEL_TOKEN=eyJhIjoi...
   ```
6. In the Cloudflare Dashboard "Public Hostnames" tab:
   - **Subdomain**: `opencode` (or whatever you prefer)
   - **Domain**: `yourdomain.com`
   - **Service**: `http://opencode:3000` (Note: use the service name `opencode` defined in docker-compose)

7. Restart your containers:
   ```bash
   docker compose up -d --force-recreate
   ```

## Development

The `./workspace` directory is mounted to the container. Any files you edit inside the IDE (or drop into that folder) will be persisted on your host machine.
