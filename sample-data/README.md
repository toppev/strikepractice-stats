# Demo database

`demo.db` is what the site shows when `DATABASE_URL` is not set. It's a slice of real fights from the
StrikePractice public test server (`strikepractice.toppe.dev`), in the plugin's own SQLite schema:
450 fights (ranked and unranked; 1.8-era and 26.1 item formats), their players, and the stats rows
of everyone involved plus the top of each ladder.

**Anonymized:** every player except one (the plugin author's own account, `toppev`) has a random
UUID and a generated name (`SwiftFox`, `IronHeron`, …), in every table and inside the JSON. Skins
therefore show as default skins.

Rebuild it from any StrikePractice database with:

```sh
DATABASE_URL=mysql://user:pass@host:3306/strikepractice \
  npm run sample-data -- --out sample-data/demo.db --fights 450 --keep <uuid-to-keep-as-is>
```

The script fails instead of writing a file if any original name or UUID is left in the output.
