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
built from your checkout.

`config.yml` is tracked in git. If you edited it and `git pull` complains, commit your changes first
(`git commit -am "my settings"`) and pull again, or keep your settings in a fork.

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
