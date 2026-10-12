# Deploying

The site is one Docker container that reads the plugin's database. Any machine with Docker works:
the Minecraft host itself, a VPS, a home server. It needs to reach the database (MySQL/MariaDB over
the network, or the SQLite file on the same machine).

## 1. Try it with the demo data

```sh
git clone <this repository> stats && cd stats
docker compose up -d --build
# open http://localhost:3000
```

With no `DATABASE_URL` the site shows the bundled, anonymized demo database. Every page works, so
it's a quick check that the container runs before you connect anything.

## 2. Connect your database

### MySQL / MariaDB (recommended)

The plugin's `config.yml` has `database.type: mysql` (or `mysql: true`).

1. Create a read-only user for the site (on the database server):

   ```sql
   CREATE USER 'stats'@'%' IDENTIFIED BY 'a-long-random-password';
   GRANT SELECT ON strikepractice.* TO 'stats'@'%';
   ```

   Replace `strikepractice` with `database.name` from the plugin's config, and `%` with the address
   the site connects from if you want to be stricter.

2. Copy `.env.example` to `.env` and set:

   ```sh
   # database on the same machine as Docker
   DATABASE_URL=mysql://stats:a-long-random-password@host.docker.internal:3306/strikepractice
   ```

   Special characters in the password must be URL-encoded (`@` → `%40`, `#` → `%23`, `/` → `%2F`).

3. `docker compose up -d` and check with `docker compose exec stats node scripts/doctor.cjs`.

**Database in another container?** Put the stats container on the same Docker network and use the
database container's name as the host: `mysql://stats:…@strikepractice-database:3306/strikepractice`.
In `docker-compose.yml`:

```yaml
services:
  stats:
    # ...
    networks: [default, minecraft]
networks:
  minecraft:
    external: true
    name: <the network your database is on>   # docker network ls
```

**MySQL listening on 127.0.0.1 only?** `host.docker.internal` reaches the host's network interface,
not its loopback. Either let MySQL listen on the Docker bridge too, or run the stats container with
`network_mode: host` and use `127.0.0.1` in `DATABASE_URL` (Linux only; drop `ports:` then, and the
site listens on port 3000 of the host).

### SQLite

The plugin's `config.yml` has `database.type: sqlite`; the file is
`plugins/StrikePractice/sqlite/database.db`. The site has to run on the same machine as the
Minecraft server.

In `docker-compose.yml`, uncomment the volume and point it at the plugin's folder:

```yaml
    volumes:
      - /path/to/server/plugins/StrikePractice/sqlite:/data
```

and in `.env`:

```sh
DATABASE_URL=sqlite:///data/database.db
```

The site opens the file read-only and reads while the plugin writes; that's fine at the sizes SQLite
servers have. Mount the **folder**, not just the file: SQLite keeps `-wal` and `-shm` files next to it.

**"unable to open database file":** the container runs as uid 1000. If the Minecraft server's files
belong to another user, run the container as that user:

```yaml
    user: "1001:1001"   # ls -n plugins/StrikePractice/sqlite  shows the numbers
```

Big or busy server? Move the plugin to MySQL/MariaDB (`/strikepractice sqlitetomysql`).

## 3. Your settings

Edit `config.yml` (server name, IP, colors, kit names) and put images in `branding/`. Both are
mounted into the container, so changes show up on the next page load. **Exception:** some editors
save by replacing the file, which a single-file Docker mount doesn't follow. If an edit doesn't show
up, `docker compose restart`.

See [CUSTOMIZING.md](CUSTOMIZING.md).

## 4. Put it on a domain (HTTPS)

Run a reverse proxy in front of port 3000. With [Caddy](https://caddyserver.com) (automatic HTTPS):

```
stats.example.net {
    reverse_proxy localhost:3000
}
```

nginx:

```nginx
server {
    server_name stats.example.net;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

When the site is only reached through the proxy, publish the port on localhost only:
`ports: ["127.0.0.1:3000:3000"]`. Set `site.url` in `config.yml` to the public address.

### Fight links from the game and Discord

The plugin can link each fight to the site: the chat message after a fight (its `config.yml`) and
the fight webhook (`discord-webhooks.json`). Both give the fight's start time, which
`/fight/<start time>` accepts and redirects to the fight's page:

```yaml
match-link-after-fight: true
match-link: '&9Match link: https://stats.example.net/fight/<started>'
```

```json
"url": "https://stats.example.net/fight/<fight_id>"
```

The plugin sends the link a moment before it saves the fight, so a click within the first seconds
can show "Fight not found"; a refresh then finds it.

### Rate limit

> **For real protection against bots and DDoS, put the site behind Cloudflare** (the free plan is
> enough) or a similar CDN, and set `behindCloudflare: true`. The built-in limit below is only a
> safety net against one misbehaving script; it does nothing against traffic from many addresses.

Each visitor (IP address) may load `rateLimitPerMinute` pages a minute (config.yml, default 600),
and the search box gets 4 times that on a count of its own, so looking up many players doesn't
use up page views. Past that they get "429 Too many requests" until the minute is over. It's high on
purpose: many players can share one address (school networks, mobile carriers), and all it has to
do is stop one crawler or script from keeping the database busy for everyone.

The site needs each visitor's own address for this. It reads it from the `X-Forwarded-For` header
your proxy adds (the nginx and Caddy setups above do), and uses the connecting address when there's
no proxy. When all it sees is a private address (a proxy that doesn't add the header, or Docker's
port forwarding for IPv6 visitors), it can't tell visitors apart and doesn't limit them rather than
limit everyone together. So behind a proxy, make sure it sends `X-Forwarded-For`.

- **Behind Cloudflare:** set `behindCloudflare: true` in `config.yml`, so the site reads Cloudflare's
  `CF-Connecting-IP`. Only when the site can't be reached around Cloudflare: otherwise anyone can
  send that header with a made-up address. It's off by default for that reason.
- **No proxy at all:** visitors can send their own `X-Forwarded-For`, which then counts as their
  address, so the limit only stops scripts that don't try. You need a proxy for HTTPS anyway.

It's per address: it won't stop traffic from many addresses at once. That's a job for a CDN in
front (Cloudflare, see above) or your proxy (nginx `limit_req`).

## 5. Indexes (big databases)

```sh
docker compose exec stats node scripts/doctor.cjs
```

lists indexes the site's queries want that your database lacks (older plugin versions created
fewer) and prints the `CREATE INDEX` statements. Run them with a user that may alter the tables (not
the read-only one). They only make reads faster; the plugin doesn't mind them.

## Updating

```sh
git pull
docker compose up -d --build
```

There is no published image on purpose: your copy is meant to carry your own changes, so it's
built from your checkout. Rebuilding now and then also picks up security fixes in the base image
(`docker compose build --pull`).

The container runs as an unprivileged user with a read-only filesystem and no Linux capabilities
(see `docker-compose.yml`). The site only reads, so it doesn't notice; if you add something that
writes files, mount a volume for it, or use `/tmp`.

`config.yml` is tracked in git (not shipped as a `.example`: forks keep their settings in git, and
Docker would mount a missing file as an empty directory). If you edited it and `git pull` complains,
commit your changes first (`git commit -am "my settings"`) and pull again, or keep your settings in a
fork.

## Without Docker

Node.js 22.13 or newer:

```sh
npm ci
npm run build
DATABASE_URL=mysql://… npm start          # port 3000; PORT=8080 npm start for another
```

Keep it running with systemd, pm2 or similar. `npm run doctor` checks the setup.

## Environment variables

| Variable | Default | |
|---|---|---|
| `DATABASE_URL` | (demo database) | `mysql://user:pass@host:3306/db`, `mariadb://…`, `sqlite:///path/file.db`. Add `?connectionLimit=10` for a bigger MySQL pool (default 5). |
| `CONFIG_PATH` | `./config.yml` | |
| `BRANDING_DIR` | `./branding` | Served at `/branding/...` |
| `PORT` | `3000` | |
